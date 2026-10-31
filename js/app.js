(function () {
  const { esc, STATES, fmtDate, fmtTime, dayOf, monthOf, weekday, todayISO, parseMapsLink, mapsFromCoords, mapsLink, toast, norm } = window.MB;
  const api = window.MobilizaAPI;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const ICON = {
    pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-6.5 8-12a8 8 0 10-16 0c0 5.5 8 12 8 12z"/><circle cx="12" cy="10" r="3"/></svg>',
    clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4L3 6v14l6-2 6 2 6-2V4l-6 2-6-2zM9 4v14M15 6v14"/></svg>'
  };

  let ALL = [];
  let current = null;       // ato em compartilhamento / exclusão
  let loc = { url: null, lat: null, lng: null };
  let locMode = "auto";
  const deepLinkId = new URLSearchParams(location.search).get("ato");

  /* ---------- helpers ---------- */
  const isPast = (m) => m.event_date < todayISO();   // atos de hoje continuam aparecendo até o fim do dia

  function baseUrl() { const u = new URL(location.href); u.search = ""; u.hash = ""; return u.href; }
  const shareUrl = (m) => `${baseUrl()}?ato=${encodeURIComponent(m.id)}`;
  const shareText = (m) =>
    `📍 ${m.title}\n🗓️ ${weekday(m.event_date)}, ${fmtDate(m.event_date).slice(0, 5)} às ${fmtTime(m.event_time)}\n📌 ${m.venue} — ${m.city}/${m.state}\n\nParticipe e compartilhe! 👇`;

  function openModal(id) { $(id).classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeModals() { $$(".modal.open").forEach(m => m.classList.remove("open")); document.body.style.overflow = ""; }
  $$(".modal").forEach(m => m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-close]")) closeModals(); }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModals(); });

  /* ---------- render ---------- */
  function fillStateSelects() {
    const opt = STATES.map(([uf, n]) => `<option value="${uf}">${uf} — ${esc(n)}</option>`).join("");
    $("#fState").insertAdjacentHTML("beforeend", opt);
    $("#state").insertAdjacentHTML("beforeend", opt);
  }

  function refreshCityFilter() {
    const uf = $("#fState").value;
    const cities = [...new Set(ALL.filter(m => !uf || m.state === uf).map(m => m.city))].sort((a, b) => a.localeCompare(b, "pt-BR"));
    const sel = $("#fCity"), prev = sel.value;
    sel.innerHTML = '<option value="">Todas as cidades</option>' + cities.map(c => `<option>${esc(c)}</option>`).join("");
    if (cities.includes(prev)) sel.value = prev;
  }

  function stats() {
    const act = ALL.filter(m => !isPast(m));
    $("#statTotal").textContent = act.length;
    $("#statCities").textContent = new Set(act.map(m => m.city + m.state)).size;
    $("#statStates").textContent = new Set(act.map(m => m.state)).size;
  }

  function filtered() {
    const q = norm($("#fSearch").value), uf = $("#fState").value, city = $("#fCity").value, past = $("#fPast").checked;
    return ALL.filter(m =>
      (past || !isPast(m) || m.id === deepLinkId) &&
      (!uf || m.state === uf) && (!city || m.city === city) &&
      (!q || norm([m.title, m.city, m.venue, m.description, m.state].join(" ")).includes(q)));
  }

  // Eventos que o mapa mostra: respeitam busca e "mostrar encerradas", mas não o filtro de estado/cidade
  function mapEvents() {
    const q = norm($("#fSearch").value), past = $("#fPast").checked;
    return ALL.filter(m => (past || !isPast(m)) &&
      (!q || norm([m.title, m.city, m.venue, m.description, m.state].join(" ")).includes(q)));
  }

  function selectFromMap({ uf, city }) {
    $("#fState").value = uf || "";
    refreshCityFilter();
    $("#fCity").value = city || "";
    render();
  }

  function card(m) {
    const past = isPast(m);
    return `
    <article class="card" id="ato-${esc(m.id)}" data-id="${esc(m.id)}">
      <div class="card-top">
        <div class="date-badge"><b>${dayOf(m.event_date)}</b><small>${monthOf(m.event_date)}</small></div>
        <div style="min-width:0">
          <span class="tag ${past ? "past" : ""}">${past ? "Encerrada" : esc(weekday(m.event_date))}</span>
          <h3>${esc(m.title)}</h3>
        </div>
      </div>
      <div class="meta">
        <div>${ICON.clock}<span>${fmtDate(m.event_date)} às ${fmtTime(m.event_time)}</span></div>
        <div>${ICON.pin}<span><b>${esc(m.venue)}</b><br>${esc(m.city)}/${esc(m.state)}</span></div>
      </div>
      <p class="desc">${esc(m.description)}</p>
      ${m.description.length > 140 ? '<button class="more" data-act="more">Ler mais</button>' : ""}
      <div class="card-actions">
        <button class="btn btn-primary btn-sm" data-act="share">${ICON.share} Compartilhar</button>
        <a class="btn btn-ghost btn-sm" href="${esc(mapsLink(m))}" target="_blank" rel="noopener noreferrer">${ICON.map} Ver no mapa</a>
      </div>
      <button class="link-danger" data-act="del">Solicitar exclusão</button>
    </article>`;
  }

  function render() {
    const list = filtered();
    $("#grid").innerHTML = list.length ? list.map(card).join("") :
      `<div class="empty"><b>Nenhuma mobilização encontrada</b>Seja o primeiro a cadastrar na sua cidade.<br><br><button class="btn btn-primary" data-open-form>Cadastrar mobilização</button></div>`;
    if (window.MBMap) MBMap.update({ events: mapEvents(), uf: $("#fState").value, city: $("#fCity").value });
  }

  async function load() {
    $("#grid").innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    try {
      ALL = await api.list();
      if (deepLinkId && !ALL.some(m => m.id === deepLinkId)) {
        const one = await api.get(deepLinkId); if (one) ALL.push(one);
      }
    } catch (e) {
      console.error(e);
      $("#grid").innerHTML = '<div class="empty"><b>Não foi possível carregar</b>Verifique sua conexão e a configuração do Supabase.</div>';
      return;
    }
    stats(); refreshCityFilter(); render();
    if (deepLinkId) {
      const el = document.getElementById("ato-" + deepLinkId);
      if (el) { el.classList.add("highlight"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
      else toast("Esta mobilização não está mais disponível.");
    }
  }

  /* ---------- eventos da lista ---------- */
  $("#grid").addEventListener("click", (e) => {
    const openBtn = e.target.closest("[data-open-form]"); if (openBtn) { openForm(); return; }
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const id = btn.closest(".card").dataset.id;
    const m = ALL.find(x => x.id === id);
    if (btn.dataset.act === "more") { const d = btn.previousElementSibling; d.classList.toggle("open"); btn.textContent = d.classList.contains("open") ? "Mostrar menos" : "Ler mais"; }
    if (btn.dataset.act === "share") openShare(m);
    if (btn.dataset.act === "del") openDelete(m);
  });
  ["#fSearch", "#fCity", "#fPast"].forEach(s => $(s).addEventListener("input", render));
  $("#fState").addEventListener("input", () => { refreshCityFilter(); render(); });
  $$("[data-open-form]").forEach(b => b.addEventListener("click", openForm));

  /* ---------- compartilhar ---------- */
  function openShare(m) {
    current = m;
    const url = shareUrl(m), text = shareText(m), full = `${text}\n${url}`;
    $("#shareSub").textContent = `${m.title} — ${m.city}/${m.state}`;
    $("#sharePreview").textContent = full;
    const eu = encodeURIComponent, et = eu(text), eurl = eu(url), efull = eu(full);
    const items = [
      { n: "WhatsApp", c: "#25D366", i: "W", href: `https://wa.me/?text=${efull}` },
      { n: "Telegram", c: "#229ED9", i: "T", href: `https://t.me/share/url?url=${eurl}&text=${et}` },
      { n: "X (Twitter)", c: "#111", i: "X", href: `https://twitter.com/intent/tweet?text=${et}&url=${eurl}` },
      { n: "Facebook", c: "#1877F2", i: "f", href: `https://www.facebook.com/sharer/sharer.php?u=${eurl}&quote=${et}` },
      { n: "E-mail", c: "#6b7280", i: "@", href: `mailto:?subject=${eu(m.title)}&body=${efull}` },
      { n: "SMS", c: "#10b981", i: "✉", href: `sms:?&body=${efull}` },
      { n: "Copiar mensagem + link", c: "#f59e0b", i: "⧉", copy: full, hint: "Cole no Instagram, Direct, TikTok, Signal…" }
    ];

    let html = "";
    if (navigator.share) html += `<button data-native><span class="dot" style="background:var(--brand)">↗</span>Mais apps…</button>`;
    html += items.map((x, k) => x.href
      ? `<a href="${esc(x.href)}" target="_blank" rel="noopener noreferrer"><span class="dot" style="background:${x.c}">${x.i}</span>${x.n}</a>`
      : `<button data-copy="${k}"><span class="dot" style="background:${x.c}">${x.i}</span>${x.n}</button>`).join("");
    html += `<button data-copylink><span class="dot" style="background:#64748b">🔗</span>Copiar só o link</button>`;
    const list = $("#shareList"); list.innerHTML = html;

    list.onclick = async (e) => {
      if (e.target.closest("[data-native]")) { try { await navigator.share({ title: m.title, text, url }); } catch { } }
      const c = e.target.closest("[data-copy]"); if (c) { await copy(full); toast("Mensagem copiada! Cole no app que quiser."); }
      if (e.target.closest("[data-copylink]")) { await copy(url); toast("Link copiado!"); }
    };
    openModal("#mShare");
  }
  async function copy(t) {
    try { await navigator.clipboard.writeText(t); }
    catch { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
  }

  /* ---------- pedir exclusão ---------- */
  function openDelete(m) {
    current = m; $("#delSub").textContent = `${m.title} — ${m.city}/${m.state}`;
    $("#delForm").reset(); $("#delErr").classList.add("hidden"); openModal("#mDel");
  }
  $("#delForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#delErr"); err.classList.add("hidden");
    if ($("#delWebsite").value) { closeModals(); return; }              // honeypot
    const reason = $("#delReason").value.trim();
    if (reason.length < 5) { err.textContent = "Explique o motivo (mínimo 5 caracteres)."; err.classList.remove("hidden"); return; }
    const b = $("#btnDel"); b.disabled = true;
    try {
      await api.requestDeletion({ mobilization_id: current.id, reason, contact: $("#delContact").value.trim() || null });
      closeModals(); toast("Pedido enviado. Um moderador vai analisar.");
    } catch (ex) { console.error(ex); err.textContent = "Não foi possível enviar. Tente novamente."; err.classList.remove("hidden"); }
    b.disabled = false;
  });

  /* ---------- cadastro ---------- */
  function openForm() {
    $("#form").reset(); clearLoc(); setMode("auto"); $("#formErr").classList.add("hidden");
    $("#date").min = todayISO(); openModal("#mForm");
  }
  function setMode(m) {
    locMode = m;
    $$("#locSeg button").forEach(b => b.classList.toggle("on", b.dataset.mode === m));
    $("#locAuto").classList.toggle("hidden", m !== "auto");
    $("#locLink").classList.toggle("hidden", m !== "link");
  }
  $("#locSeg").addEventListener("click", e => { const b = e.target.closest("button"); if (b) setMode(b.dataset.mode); });

  function showLoc(text) { $("#locOkText").textContent = text; $("#locOk").classList.remove("hidden"); }
  function clearLoc() { loc = { url: null, lat: null, lng: null }; $("#locOk").classList.add("hidden"); $("#mapsUrl").value = ""; }
  $("#locClear").addEventListener("click", clearLoc);

  $("#btnGeo").addEventListener("click", () => {
    const err = $("#formErr"); err.classList.add("hidden");
    if (!navigator.geolocation) { err.textContent = "Seu navegador não suporta localização. Use o link do Google Maps."; err.classList.remove("hidden"); return; }
    const b = $("#btnGeo"); b.disabled = true; const old = b.innerHTML; b.textContent = "Detectando…";
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const lat = +pos.coords.latitude.toFixed(6), lng = +pos.coords.longitude.toFixed(6);
      loc = { url: mapsFromCoords(lat, lng), lat, lng };
      showLoc(`Localização detectada (${lat.toFixed(4)}, ${lng.toFixed(4)})`);
      b.disabled = false; b.innerHTML = old;
      // tenta preencher cidade/UF (OpenStreetMap Nominatim)
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=14&accept-language=pt-BR&lat=${lat}&lon=${lng}`);
        const j = await r.json(), a = j.address || {};
        const city = a.city || a.town || a.village || a.municipality;
        const uf = (a["ISO3166-2-lvl4"] || "").replace("BR-", "");
        if (city && !$("#city").value) $("#city").value = city;
        if (uf && STATES.some(s => s[0] === uf) && !$("#state").value) $("#state").value = uf;
        if (a.road && !$("#venue").value) $("#venue").placeholder = `Perto de: ${a.road}`;
      } catch { /* sem problema: o usuário preenche manualmente */ }
    }, (er) => {
      b.disabled = false; b.innerHTML = old;
      err.textContent = er.code === 1 ? "Permissão negada. Libere a localização no navegador ou use o link do Google Maps." : "Não foi possível obter a localização. Tente o link do Google Maps.";
      err.classList.remove("hidden");
    }, { enableHighAccuracy: true, timeout: 12000 });
  });

  $("#mapsUrl").addEventListener("input", () => {
    const v = $("#mapsUrl").value.trim();
    if (!v) { loc = { url: null, lat: null, lng: null }; $("#locOk").classList.add("hidden"); return; }
    const p = parseMapsLink(v);
    if (p) { loc = p; showLoc(p.lat != null ? "Link válido (coordenadas encontradas)" : "Link do Google Maps válido"); }
    else { loc = { url: null, lat: null, lng: null }; $("#locOk").classList.add("hidden"); }
  });

  $("#form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#formErr"); err.classList.add("hidden");
    if ($("#website").value) { closeModals(); return; }                  // honeypot anti-robô
    const d = {
      title: $("#title").value.trim(), description: $("#description").value.trim(), venue: $("#venue").value.trim(),
      city: $("#city").value.trim(), state: $("#state").value, event_date: $("#date").value, event_time: $("#time").value
    };
    const fail = (t) => { err.textContent = t; err.classList.remove("hidden"); err.scrollIntoView({ block: "nearest" }); };
    if (d.title.length < 3) return fail("Informe um título (mínimo 3 caracteres).");
    if (d.description.length < 5) return fail("Escreva uma descrição.");
    if (d.venue.length < 2) return fail("Informe o local de encontro.");
    if (d.city.length < 2) return fail("Informe a cidade.");
    if (!d.state) return fail("Escolha o estado (UF).");
    if (!d.event_date || !d.event_time) return fail("Informe data e horário.");
    if (d.event_date < todayISO()) return fail("A data não pode estar no passado.");
    if (locMode === "link" && $("#mapsUrl").value.trim() && !loc.url) return fail("Link inválido. Use um link do Google Maps (maps.app.goo.gl ou google.com/maps).");

    const payload = { ...d, maps_url: loc.url || null, lat: loc.lat, lng: loc.lng, map_lat: loc.lat, map_lng: loc.lng };
    const b = $("#btnSubmit"); b.disabled = true; b.textContent = "Publicando…";
    try {
      // ponto da cidade para o mapa (não altera o botão "Ver no mapa"); se demorar, publica sem ele
      if (payload.map_lat == null && window.MBMap) {
        const c = await Promise.race([MBMap.coordsFor(d.city, d.state), new Promise(r => setTimeout(() => r(null), 3500))]);
        if (c) { payload.map_lat = c[0]; payload.map_lng = c[1]; }
      }
      await api.create(payload);
      closeModals(); toast("Mobilização publicada! 🎉");
      await load();
      $("#atos").scrollIntoView({ behavior: "smooth" });
    } catch (ex) { console.error(ex); fail("Não foi possível publicar agora. Tente novamente em instantes."); }
    b.disabled = false; b.textContent = "Publicar mobilização";
  });

  /* ---------- init ---------- */
  $("#year").textContent = new Date().getFullYear();
  if (!api.live) $("#demoBanner").classList.remove("hidden");
  fillStateSelects();
  if (window.MBMap) MBMap.init($("#brMap"), { onSelect: selectFromMap });
  load();
})();
