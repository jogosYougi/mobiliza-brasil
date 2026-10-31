(function () {
  const { esc, parseGovLink, toast, norm } = window.MB;
  const api = window.MobilizaAPI;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const KINDS = ["PL", "PEC", "PLP", "PDL", "Ideia legislativa", "Consulta pública", "Outro"];
  const STANCE_TXT = { favor: "Sugerem votar a favor", contra: "Sugerem votar contra", informativo: "Informativo" };
  const STANCE_SHARE = { favor: "👍 Sugestão: votar A FAVOR", contra: "👎 Sugestão: votar CONTRA", informativo: "ℹ️ Fique por dentro e decida o seu voto" };
  const ICON = {
    share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4"/></svg>',
    out: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V7a1 1 0 011-1h5"/></svg>'
  };

  let ALL = [];
  let current = null;
  const deepLinkId = new URLSearchParams(location.search).get("proposta");

  function baseUrl() { const u = new URL(location.href); u.search = ""; u.hash = ""; return u.href; }
  const shareUrl = (p) => `${baseUrl()}?proposta=${encodeURIComponent(p.id)}`;
  const label = (p) => [p.kind, p.reference].filter(Boolean).join(" ");
  const shareText = (p) =>
    `🗳️ ${label(p) ? label(p) + " — " : ""}${p.title}\n${STANCE_SHARE[p.stance] || ""}\n\nVeja e vote no site oficial do governo 👇`;

  function openModal(id) { $(id).classList.add("open"); document.body.style.overflow = "hidden"; }
  function closeModals() { $$(".modal.open").forEach(m => m.classList.remove("open")); document.body.style.overflow = ""; }
  $$(".modal").forEach(m => m.addEventListener("click", e => { if (e.target === m || e.target.closest("[data-close]")) closeModals(); }));
  document.addEventListener("keydown", e => { if (e.key === "Escape") closeModals(); });

  /* ---------- lista ---------- */
  function fillKinds() {
    $("#fKind").insertAdjacentHTML("beforeend", KINDS.map(k => `<option>${esc(k)}</option>`).join(""));
    $("#kind").innerHTML = KINDS.map(k => `<option>${esc(k)}</option>`).join("");
  }

  function filtered() {
    const q = norm($("#fSearch").value), k = $("#fKind").value, s = $("#fStance").value;
    return ALL.filter(p => (!k || p.kind === k) && (!s || p.stance === s) &&
      (!q || norm([p.title, p.reference, p.summary, p.kind].join(" ")).includes(q)));
  }

  function card(p) {
    const g = parseGovLink(p.link);                       // revalida ao exibir (defesa em profundidade)
    const host = g ? g.host : null;
    return `
    <article class="card" id="prop-${esc(p.id)}" data-id="${esc(p.id)}">
      <div>
        <div class="pills">
          <span class="pill kind">${esc(p.kind)}</span>
          <span class="pill ${esc(p.stance)}">${esc(STANCE_TXT[p.stance] || "")}</span>
        </div>
        ${p.reference ? `<div class="ref">${esc(p.reference)}</div>` : ""}
        <h3>${esc(p.title)}</h3>
      </div>
      <p class="desc">${esc(p.summary)}</p>
      ${p.summary.length > 140 ? '<button class="more" data-act="more">Ler mais</button>' : ""}
      <div class="card-actions">
        ${g ? `<a class="btn btn-primary btn-sm" href="${esc(g.url)}" target="_blank" rel="noopener noreferrer">${ICON.out} Votar no site oficial</a>` : ""}
        <button class="btn btn-ghost btn-sm" data-act="share">${ICON.share} Compartilhar</button>
      </div>
      ${g ? `<div class="official" data-of="${esc(g.url)}"></div>` : ""}
      ${host ? `<div class="host">Abre em ${esc(host)}</div>` : ""}
      <button class="link-danger" data-act="del">Solicitar exclusão</button>
    </article>`;
  }

  function render() {
    const list = filtered();
    $("#grid").innerHTML = list.length ? list.map(card).join("") :
      `<div class="empty"><b>Nenhuma proposta encontrada</b>Cadastre a primeira.<br><br><button class="btn btn-primary" data-open-form>Cadastrar proposta</button></div>`;
    hydrate();
  }

  // Carrega os dados oficiais só dos cartões que aparecem na tela
  let io = null;
  function hydrate() {
    if (!window.MBOficial || !("IntersectionObserver" in window)) return;
    if (!io) io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue;
        io.unobserve(en.target);                                   // observamos o cartão inteiro (o bloco vazio é invisível)
        const el = en.target.querySelector(".official[data-of]");
        if (!el || el.dataset.loaded) continue;
        el.dataset.loaded = "1";
        el.innerHTML = '<div class="skeleton-line"></div>';
        MBOficial.get(el.dataset.of).then((d) => { el.innerHTML = MBOficial.html(d); });
      }
    }, { rootMargin: "240px" });
    $$(".card").forEach((c) => { if (c.querySelector(".official[data-of]")) io.observe(c); });
  }

  async function load() {
    $("#grid").innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    try {
      ALL = await api.listProposals();
      if (deepLinkId && !ALL.some(p => p.id === deepLinkId)) {
        const one = await api.getProposal(deepLinkId); if (one) ALL.unshift(one);
      }
    } catch (e) {
      console.error(e);
      $("#grid").innerHTML = '<div class="empty"><b>Não foi possível carregar</b>Confira a conexão e se o arquivo database/propostas.sql foi executado no Supabase.</div>';
      return;
    }
    render();
    if (deepLinkId) {
      const el = document.getElementById("prop-" + deepLinkId);
      if (el) { el.classList.add("highlight"); el.scrollIntoView({ block: "center", behavior: "smooth" }); }
      else toast("Esta proposta não está mais disponível.");
    }
  }

  $("#grid").addEventListener("click", (e) => {
    if (e.target.closest("[data-open-form]")) { openForm(); return; }
    const btn = e.target.closest("[data-act]"); if (!btn) return;
    const p = ALL.find(x => x.id === btn.closest(".card").dataset.id);
    if (btn.dataset.act === "more") { const d = btn.previousElementSibling; d.classList.toggle("open"); btn.textContent = d.classList.contains("open") ? "Mostrar menos" : "Ler mais"; }
    if (btn.dataset.act === "share") openShare(p);
    if (btn.dataset.act === "del") openDelete(p);
  });
  ["#fSearch", "#fKind", "#fStance"].forEach(s => $(s).addEventListener("input", render));
  $$("[data-open-form]").forEach(b => b.addEventListener("click", openForm));

  /* ---------- compartilhar ---------- */
  async function copy(t) {
    try { await navigator.clipboard.writeText(t); }
    catch { const ta = document.createElement("textarea"); ta.value = t; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
  }
  function openShare(p) {
    const url = shareUrl(p), text = shareText(p), full = `${text}\n${url}`;
    $("#shareSub").textContent = p.title;
    $("#sharePreview").textContent = full;
    const eu = encodeURIComponent, et = eu(text), eurl = eu(url), efull = eu(full);
    const items = [
      { n: "WhatsApp", c: "#25D366", i: "W", href: `https://wa.me/?text=${efull}` },
      { n: "Telegram", c: "#229ED9", i: "T", href: `https://t.me/share/url?url=${eurl}&text=${et}` },
      { n: "X (Twitter)", c: "#111", i: "X", href: `https://twitter.com/intent/tweet?text=${et}&url=${eurl}` },
      { n: "Facebook", c: "#1877F2", i: "f", href: `https://www.facebook.com/sharer/sharer.php?u=${eurl}&quote=${et}` },
      { n: "E-mail", c: "#6b7280", i: "@", href: `mailto:?subject=${eu(p.title)}&body=${efull}` },
      { n: "SMS", c: "#10b981", i: "✉", href: `sms:?&body=${efull}` },
      { n: "Copiar mensagem + link", c: "#f59e0b", i: "⧉", copy: true }
    ];
    let html = "";
    if (navigator.share) html += `<button data-native><span class="dot" style="background:var(--brand)">↗</span>Mais apps…</button>`;
    html += items.map(x => x.href
      ? `<a href="${esc(x.href)}" target="_blank" rel="noopener noreferrer"><span class="dot" style="background:${x.c}">${x.i}</span>${x.n}</a>`
      : `<button data-copy><span class="dot" style="background:${x.c}">${x.i}</span>${x.n}</button>`).join("");
    html += `<button data-copylink><span class="dot" style="background:#64748b">🔗</span>Copiar só o link</button>`;
    const list = $("#shareList"); list.innerHTML = html;
    list.onclick = async (e) => {
      if (e.target.closest("[data-native]")) { try { await navigator.share({ title: p.title, text, url }); } catch { } }
      if (e.target.closest("[data-copy]")) { await copy(full); toast("Mensagem copiada! Cole no app que quiser."); }
      if (e.target.closest("[data-copylink]")) { await copy(url); toast("Link copiado!"); }
    };
    openModal("#mShare");
  }

  /* ---------- pedir exclusão ---------- */
  function openDelete(p) {
    current = p; $("#delSub").textContent = p.title;
    $("#delForm").reset(); $("#delErr").classList.add("hidden"); openModal("#mDel");
  }
  $("#delForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#delErr"); err.classList.add("hidden");
    if ($("#delWebsite").value) { closeModals(); return; }
    const reason = $("#delReason").value.trim();
    if (reason.length < 5) { err.textContent = "Explique o motivo (mínimo 5 caracteres)."; err.classList.remove("hidden"); return; }
    const b = $("#btnDel"); b.disabled = true;
    try {
      await api.requestProposalDeletion({ proposal_id: current.id, reason, contact: $("#delContact").value.trim() || null });
      closeModals(); toast("Pedido enviado. Um moderador vai analisar.");
    } catch (ex) { console.error(ex); err.textContent = "Não foi possível enviar. Tente novamente."; err.classList.remove("hidden"); }
    b.disabled = false;
  });

  /* ---------- ao colar o link, tenta ler os dados oficiais ---------- */
  // Aviso por "toast" (flutuante) para não mexer no layout do formulário e fazer o clique em "Publicar" falhar.
  $("#link").addEventListener("change", async () => {
    const g = parseGovLink($("#link").value);
    if (!g || !window.MBOficial) return;
    const d = await MBOficial.get(g.url);
    if (!d || (!d.reference && !d.ementa && d.kind !== "ideia")) return;
    if (d.reference && !$("#reference").value) $("#reference").value = d.reference;
    if (d.ementa && !$("#summary").value) $("#summary").value = d.ementa;
    const k = d.reference ? d.reference.split(" ")[0] : "";
    if (KINDS.includes(k)) $("#kind").value = k;
    if (d.kind === "ideia") $("#kind").value = "Ideia legislativa";
    toast("Encontramos no site oficial" + (d.reference ? ": " + d.reference : "") + ". Preenchemos o que estava vazio; confira.");
  });

  /* ---------- cadastro ---------- */
  function openForm() { $("#form").reset(); $("#stance").value = "informativo"; $("#formErr").classList.add("hidden"); openModal("#mForm"); }

  $("#form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#formErr"); err.classList.add("hidden");
    if ($("#website").value) { closeModals(); return; }
    const fail = (t) => { err.textContent = t; err.classList.remove("hidden"); err.scrollIntoView({ block: "nearest" }); };
    const d = {
      title: $("#title").value.trim(), kind: $("#kind").value, reference: $("#reference").value.trim() || null,
      summary: $("#summary").value.trim(), stance: $("#stance").value
    };
    if (d.title.length < 3) return fail("Informe um título (mínimo 3 caracteres).");
    if (!KINDS.includes(d.kind)) return fail("Escolha o tipo da proposta.");
    if (d.summary.length < 5) return fail("Escreva um resumo.");
    const g = parseGovLink($("#link").value);
    if (!g) return fail("Link inválido. Use um endereço oficial https que termine em .gov.br ou .leg.br (ex.: camara.leg.br, senado.leg.br).");
    const b = $("#btnSubmit"); b.disabled = true; b.textContent = "Publicando…";
    try {
      await api.createProposal({ ...d, link: g.url });
      closeModals(); toast("Proposta publicada! 🎉");
      await load(); $("#lista").scrollIntoView({ behavior: "smooth" });
    } catch (ex) { console.error(ex); fail("Não foi possível publicar agora. Confira se o propostas.sql foi executado no Supabase."); }
    b.disabled = false; b.textContent = "Publicar proposta";
  });

  /* ---------- init ---------- */
  $("#year").textContent = new Date().getFullYear();
  if (!api.live) $("#demoBanner").classList.remove("hidden");
  fillKinds();
  load();
})();
