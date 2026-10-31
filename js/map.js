// Mapa interativo do Brasil (SVG puro, sem bibliotecas).
// Geometria dos estados: API pública do IBGE, carregada no navegador e guardada em cache.
// Se o IBGE não responder, usa uma grade de estados (mapa de reserva) que também é clicável.
(function () {
  const { esc, norm, STATES } = window.MB;
  const NAME = Object.fromEntries(STATES);

  const IBGE_UF = { 11: "RO", 12: "AC", 13: "AM", 14: "RR", 15: "PA", 16: "AP", 17: "TO", 21: "MA", 22: "PI", 23: "CE", 24: "RN", 25: "PB",
    26: "PE", 27: "AL", 28: "SE", 29: "BA", 31: "MG", 32: "ES", 33: "RJ", 35: "SP", 41: "PR", 42: "SC", 43: "RS", 50: "MS", 51: "MT", 52: "GO", 53: "DF" };
  const GEO_URLS = [
    "data/brasil-estados.geojson",   // opcional: cópia local (carrega na hora)
    "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?intrarregiao=UF&qualidade=minima&formato=application/vnd.geo+json",
    "https://servicodados.ibge.gov.br/api/v2/malhas/BR?resolucao=2&qualidade=minima&formato=application/vnd.geo+json"
  ];
  const GEO_CACHE = "mb_geo_v1";

  // Capitais: aparecem no mapa na hora, sem consultar nada.
  const CAPITALS = {
    "rio branco|AC": [-9.9747, -67.81], "maceio|AL": [-9.6658, -35.7353], "macapa|AP": [0.0349, -51.0664], "manaus|AM": [-3.119, -60.0217],
    "salvador|BA": [-12.9714, -38.5014], "fortaleza|CE": [-3.7319, -38.5267], "brasilia|DF": [-15.7939, -47.8828], "vitoria|ES": [-20.3155, -40.3128],
    "goiania|GO": [-16.6869, -49.2648], "sao luis|MA": [-2.5307, -44.3068], "cuiaba|MT": [-15.6014, -56.0979], "campo grande|MS": [-20.4697, -54.6201],
    "belo horizonte|MG": [-19.9167, -43.9345], "belem|PA": [-1.4558, -48.5044], "joao pessoa|PB": [-7.1195, -34.845], "curitiba|PR": [-25.4284, -49.2733],
    "recife|PE": [-8.0476, -34.877], "teresina|PI": [-5.0892, -42.8019], "rio de janeiro|RJ": [-22.9068, -43.1729], "natal|RN": [-5.7945, -35.211],
    "porto alegre|RS": [-30.0346, -51.2177], "porto velho|RO": [-8.7619, -63.9039], "boa vista|RR": [2.8235, -60.6758], "florianopolis|SC": [-27.5954, -48.548],
    "sao paulo|SP": [-23.5505, -46.6333], "aracaju|SE": [-10.9091, -37.0677], "palmas|TO": [-10.1689, -48.3317]
  };

  // Projeção equiretangular simples, ajustada ao Brasil
  const LNG0 = -74.5, LAT0 = 6, K = 14, COS = Math.cos(15 * Math.PI / 180), W = 545, H = 565;
  const proj = (lng, lat) => [(lng - LNG0) * COS * K, (LAT0 - lat) * K];
  const inBrazil = (la, ln) => la > -34.5 && la < 5.5 && ln > -74.5 && ln < -34;

  // Grade de reserva (coluna, linha)
  const TILES = { RR: [2, 0], AP: [4, 0], AM: [2, 1], PA: [3, 1], MA: [4, 1], CE: [5, 1], RN: [6, 1], AC: [1, 2], RO: [2, 2], MT: [3, 2], TO: [4, 2],
    PI: [5, 2], PB: [6, 2], MS: [2, 3], GO: [3, 3], DF: [4, 3], BA: [5, 3], PE: [6, 3], SP: [3, 4], MG: [4, 4], ES: [5, 4], AL: [6, 4],
    PR: [3, 5], RJ: [4, 5], SE: [6, 5], SC: [3, 6], RS: [3, 7] };

  /* ---------- geometria ---------- */
  function geomToPath(g) {
    const polys = g.type === "Polygon" ? [g.coordinates] : g.type === "MultiPolygon" ? g.coordinates : [];
    let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, d = "";
    for (const poly of polys) for (const ring of poly) {
      ring.forEach((p, i) => {
        const [x, y] = proj(p[0], p[1]);
        if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
        d += (i ? "L" : "M") + x.toFixed(1) + " " + y.toFixed(1);
      });
      d += "Z";
    }
    return d ? { d, bbox: [x0, y0, x1, y1] } : null;
  }

  function buildStates(gj) {
    const out = {};
    for (const f of (gj && gj.features) || []) {
      const p = f.properties || {};
      const code = String(p.codarea || p.CD_UF || p.id || "").slice(0, 2);
      const uf = IBGE_UF[code];
      if (!uf || !f.geometry) continue;
      const g = geomToPath(f.geometry);
      if (g) out[uf] = g;
    }
    return out;
  }

  async function loadGeo() {
    try {
      const c = JSON.parse(localStorage.getItem(GEO_CACHE));
      if (c && c.v === 1 && c.states && Object.keys(c.states).length >= 26) return c.states;
    } catch { }
    for (const url of GEO_URLS) {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), url.startsWith('http') ? 4000 : 3000);
        const r = await fetch(url, { signal: ctl.signal }); clearTimeout(t);
        if (!r.ok) continue;
        const states = buildStates(await r.json());
        if (Object.keys(states).length >= 26) {
          try { localStorage.setItem(GEO_CACHE, JSON.stringify({ v: 1, states })); } catch { }
          return states;
        }
      } catch { /* tenta a próxima */ }
    }
    return null;
  }

  /* ---------- coordenadas das cidades ---------- */
  const GC = "mb_geocache_v1";
  let gcache = {};
  try { gcache = JSON.parse(localStorage.getItem(GC)) || {}; } catch { }
  const saveGC = () => { try { localStorage.setItem(GC, JSON.stringify(gcache)); } catch { } };
  const ckey = (city, uf) => norm(city).trim() + "|" + uf;

  async function geocode(city, uf) {
    const k = ckey(city, uf);
    if (CAPITALS[k]) return CAPITALS[k];
    if (k in gcache) return gcache[k] || null;
    try {
      const q = encodeURIComponent(`${city}, ${NAME[uf] || uf}, Brasil`);
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&countrycodes=br&accept-language=pt-BR&q=${q}`);
      if (!r.ok) return null;
      const j = await r.json();
      let c = 0;
      if (j[0]) { const la = +j[0].lat, ln = +j[0].lon; if (inBrazil(la, ln)) c = [+la.toFixed(5), +ln.toFixed(5)]; }
      gcache[k] = c; saveGC();
      return c || null;
    } catch { return null; }
  }

  function pointOf(ev) {
    const la = ev.map_lat ?? ev.lat, ln = ev.map_lng ?? ev.lng;
    if (la != null && ln != null && inBrazil(la, ln)) return [la, ln];
    const k = ckey(ev.city, ev.state);
    return CAPITALS[k] || gcache[k] || null;
  }

  // busca coordenadas faltantes aos poucos (1 por segundo, política do serviço gratuito)
  const wanted = new Set(); let geoBusy = false, geoCount = 0;
  async function drain() {
    if (geoBusy) return; geoBusy = true;
    while (wanted.size && geoCount < 30) {
      const k = [...wanted][0]; wanted.delete(k);
      const [cn, uf] = k.split("|"); const city = S.cityNames[k] || cn;
      geoCount++;
      const c = await geocode(city, uf);
      if (c) drawDots();
      await new Promise(r => setTimeout(r, 1100));
    }
    geoBusy = false;
  }

  /* ---------- estado do componente ---------- */
  const S = { mode: "loading", states: null, events: [], uf: "", city: "", vb: [0, 0, W, H], raf: 0, cityNames: {}, onSelect: () => { }, root: null };
  const $ = (s) => S.root && S.root.querySelector(s);

  function aggregate() {
    const agg = {}; S.cityNames = {};
    for (const ev of S.events) {
      if (!ev.state || !ev.city) continue;
      const k = ckey(ev.city, ev.state);
      const a = agg[k] || (agg[k] = { city: ev.city, uf: ev.state, n: 0, pts: [], k });
      a.n++; S.cityNames[k] = ev.city;
      const p = pointOf(ev); if (p) a.pts.push(p);
    }
    for (const a of Object.values(agg)) {
      if (a.pts.length) { a.lat = a.pts.reduce((s, p) => s + p[0], 0) / a.pts.length; a.lng = a.pts.reduce((s, p) => s + p[1], 0) / a.pts.length; }
      else if (!(a.k in gcache)) wanted.add(a.k);
    }
    return agg;
  }

  const countByUF = () => { const c = {}; for (const e of S.events) c[e.state] = (c[e.state] || 0) + 1; return c; };

  /* ---------- desenho ---------- */
  function skeleton() {
    S.root.innerHTML = `
      <div class="map-head">
        <div><b>Mapa das mobilizações</b><small id="mapSub">Clique em um estado para filtrar</small></div>
        <button class="btn btn-ghost btn-sm hidden" id="mapClear" type="button">Limpar</button>
      </div>
      <div class="map-stage"><div class="map-loading" id="mapLoad">Carregando mapa…</div>
        <svg id="mapSvg" class="hidden" viewBox="0 0 ${W} ${H}" role="group" aria-label="Mapa do Brasil por estado" preserveAspectRatio="xMidYMid meet"></svg></div>
      <div class="map-legend"><span><i class="lg has"></i>estado com atos</span><span><i class="lg dot"></i>cidade com ato</span></div>`;
    $("#mapClear").addEventListener("click", () => S.onSelect({ uf: "", city: "" }));
    const svg = $("#mapSvg");
    svg.addEventListener("click", (e) => {
      const c = e.target.closest("[data-city]");
      if (c) { S.onSelect({ uf: c.dataset.uf, city: S.uf === c.dataset.uf && S.city === c.dataset.cityname ? "" : c.dataset.cityname }); return; }
      const s = e.target.closest("[data-uf]");
      if (s) S.onSelect({ uf: S.uf === s.dataset.uf ? "" : s.dataset.uf, city: "" });
    });
    svg.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      const s = e.target.closest("[data-uf]"); if (!s) return;
      e.preventDefault(); S.onSelect({ uf: S.uf === s.dataset.uf ? "" : s.dataset.uf, city: "" });
    });
  }

  function drawBase() {
    const svg = $("#mapSvg"); const cnt = countByUF();
    let h = "";
    if (S.mode === "geo") {
      h += '<g class="states">';
      for (const [uf, g] of Object.entries(S.states)) {
        const n = cnt[uf] || 0;
        h += `<path class="st" data-uf="${uf}" d="${g.d}" tabindex="0" role="button" aria-label="${esc(NAME[uf])}: ${n} mobilização(ões)"><title>${esc(NAME[uf])} — ${n} mobilização(ões)</title></path>`;
      }
      h += "</g>";
    } else {
      h += '<g class="states tiles">';
      for (const [uf, [c, r]] of Object.entries(TILES)) {
        const x = c * 68 + 6, y = r * 68 + 6, n = cnt[uf] || 0;
        h += `<g data-uf="${uf}" tabindex="0" role="button" aria-label="${esc(NAME[uf])}: ${n} mobilização(ões)"><title>${esc(NAME[uf])} — ${n} mobilização(ões)</title>
          <rect class="st" x="${x}" y="${y}" width="62" height="62" rx="12"/><text class="tl" x="${x + 31}" y="${y + 38}" text-anchor="middle">${uf}</text>
          <g class="badge ${n ? "" : "hidden"}"><circle cx="${x + 52}" cy="${y + 10}" r="10"/><text x="${x + 52}" y="${y + 14}" text-anchor="middle">${n}</text></g></g>`;
      }
      h += "</g>";
    }
    h += '<g class="dots" id="mapDots"></g>';
    svg.innerHTML = h;
    $("#mapLoad").classList.add("hidden"); svg.classList.remove("hidden");
    svg.setAttribute("viewBox", S.mode === "geo" ? S.vb.join(" ") : `0 0 ${7 * 68 + 6} ${8 * 68 + 6}`);
  }

  function paintStates() {
    const svg = $("#mapSvg"); if (!svg || S.mode === "loading") return;
    const cnt = countByUF();
    svg.querySelectorAll("[data-uf]").forEach(el => {
      const uf = el.dataset.uf, shape = el.classList.contains("st") ? el : el.querySelector(".st");
      if (!shape) return;
      shape.classList.toggle("has", !!cnt[uf]);
      shape.classList.toggle("sel", S.uf === uf);
      shape.classList.toggle("dim", !!S.uf && S.uf !== uf);
      el.setAttribute("aria-pressed", S.uf === uf ? "true" : "false");
    });
    const n = S.uf ? (cnt[S.uf] || 0) : S.events.length;
    $("#mapSub").textContent = S.uf
      ? `${NAME[S.uf]}: ${n} mobilização(ões)${S.city ? " · " + S.city : ""}`
      : `${n} mobilização(ões) no país — clique em um estado`;
    $("#mapClear").classList.toggle("hidden", !S.uf);
  }

  function drawDots() {
    const g = $("#mapDots"); if (!g || S.mode !== "geo") return;
    const zoom = S.vb[2] / W;
    const cities = Object.values(aggregate()).filter(a => a.lat != null && (!S.uf || a.uf === S.uf));
    let h = "", labels = 0;
    cities.sort((a, b) => b.n - a.n);
    for (const a of cities) {
      const [x, y] = proj(a.lng, a.lat);
      const r = (S.uf ? 5.5 : 3.8) * zoom + Math.min(8, 1.6 * Math.sqrt(a.n)) * zoom;
      const sel = S.uf === a.uf && S.city === a.city;
      h += `<circle class="dot ${sel ? "sel" : ""}" data-city data-uf="${a.uf}" data-cityname="${esc(a.city)}" cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(2)}"
              tabindex="0" role="button" aria-label="${esc(a.city)}/${a.uf}: ${a.n} mobilização(ões)"><title>${esc(a.city)}/${a.uf} — ${a.n} mobilização(ões)</title></circle>`;
      if (S.uf && labels++ < 14)
        h += `<text class="dl" x="${(x + r + 3 * zoom).toFixed(1)}" y="${(y + 3.5 * zoom).toFixed(1)}" style="font-size:${(11 * zoom).toFixed(2)}px">${esc(a.city)}</text>`;
    }
    g.innerHTML = h;
    drain();
  }

  function zoomTarget() {
    if (!S.uf || S.mode !== "geo" || !S.states[S.uf]) return [0, 0, W, H];
    const [x0, y0, x1, y1] = S.states[S.uf].bbox;
    let w = x1 - x0, h = y1 - y0; const pad = 0.14 * Math.max(w, h); w += 2 * pad; h += 2 * pad;
    const asp = W / H; if (w / h > asp) h = w / asp; else w = h * asp;
    const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
    return [cx - w / 2, cy - h / 2, w, h];
  }

  function applyZoom() {
    const svg = $("#mapSvg"); if (!svg || S.mode !== "geo") { drawDots(); return; }
    const to = zoomTarget(), from = S.vb.slice();
    cancelAnimationFrame(S.raf);
    drawDots();   // mostra já só as cidades do estado escolhido; o ponto é redimensionado ao fim do zoom
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) { S.vb = to; svg.setAttribute("viewBox", to.join(" ")); drawDots(); return; }
    const t0 = performance.now(), D = 380;
    const step = (t) => {
      const p = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - p, 3);
      S.vb = from.map((v, i) => v + (to[i] - v) * e);
      svg.setAttribute("viewBox", S.vb.join(" "));
      if (p < 1) S.raf = requestAnimationFrame(step); else { S.vb = to; drawDots(); }
    };
    S.raf = requestAnimationFrame(step);
  }

  /* ---------- API pública ---------- */
  let ready = false, lastUF = null;
  function update({ events, uf, city }) {
    S.events = events || []; S.uf = uf || ""; S.city = city || "";
    if (!ready) return;
    paintStatesAndData();
  }
  let sig = "";
  function paintStatesAndData() {
    // refaz a base só quando a contagem por estado muda; assim o foco do teclado não se perde ao selecionar
    const s = JSON.stringify(countByUF()) + S.mode;
    const svg = $("#mapSvg");
    if (s !== sig || !svg.querySelector(".states")) { sig = s; drawBase(); }
    paintStates();
    if (lastUF !== S.uf) { lastUF = S.uf; applyZoom(); } else drawDots();
  }

  async function init(root, { onSelect }) {
    S.root = root; S.onSelect = onSelect || (() => { });
    skeleton();
    const states = await loadGeo();
    if (states) { S.mode = "geo"; S.states = states; } else { S.mode = "tiles"; }
    ready = true; lastUF = null;
    S.vb = zoomTarget();
    paintStatesAndData();
  }

  window.MBMap = { init, update, coordsFor: geocode, _test: { buildStates, proj, geomToPath, CAPITALS, TILES, ckey } };
})();
