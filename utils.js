// Funções utilitárias compartilhadas
window.MB = (function () {
  const STATES = [
    ["AC", "Acre"], ["AL", "Alagoas"], ["AP", "Amapá"], ["AM", "Amazonas"], ["BA", "Bahia"], ["CE", "Ceará"],
    ["DF", "Distrito Federal"], ["ES", "Espírito Santo"], ["GO", "Goiás"], ["MA", "Maranhão"], ["MT", "Mato Grosso"],
    ["MS", "Mato Grosso do Sul"], ["MG", "Minas Gerais"], ["PA", "Pará"], ["PB", "Paraíba"], ["PR", "Paraná"],
    ["PE", "Pernambuco"], ["PI", "Piauí"], ["RJ", "Rio de Janeiro"], ["RN", "Rio Grande do Norte"],
    ["RS", "Rio Grande do Sul"], ["RO", "Rondônia"], ["RR", "Roraima"], ["SC", "Santa Catarina"],
    ["SP", "São Paulo"], ["SE", "Sergipe"], ["TO", "Tocantins"]
  ];

  const MONTHS = ["JAN", "FEV", "MAR", "ABR", "MAI", "JUN", "JUL", "AGO", "SET", "OUT", "NOV", "DEZ"];

  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const todayISO = () => {
    const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset());
    return d.toISOString().slice(0, 10);
  };

  const fmtDate = (iso) => { const [y, m, d] = iso.split("-"); return `${d}/${m}/${y}`; };
  const fmtTime = (t) => { const [h, m] = t.split(":"); return m === "00" ? `${h}h` : `${h}h${m}`; };
  const dayOf = (iso) => iso.split("-")[2];
  const monthOf = (iso) => MONTHS[parseInt(iso.split("-")[1], 10) - 1];
  const weekday = (iso) => {
    const [y, m, d] = iso.split("-").map(Number);
    return ["domingo", "segunda", "terça", "quarta", "quinta", "sexta", "sábado"][new Date(y, m - 1, d).getDay()];
  };

  // Só aceita links https de endereços do Google Maps
  const MAPS_HOSTS = /^(www\.)?google\.(com|com\.br)$|^maps\.google\.(com|com\.br)$|^maps\.app\.goo\.gl$|^goo\.gl$/i;
  function parseMapsLink(raw) {
    let u;
    try { u = new URL(String(raw).trim()); } catch { return null; }
    if (u.protocol !== "https:" || !MAPS_HOSTS.test(u.hostname)) return null;
    if (u.hostname === "goo.gl" && !u.pathname.startsWith("/maps")) return null;
    if (/^(www\.)?google\./i.test(u.hostname) && !u.pathname.startsWith("/maps")) return null;
    let lat = null, lng = null, m;
    const s = decodeURIComponent(u.href);
    if ((m = s.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)) || (m = s.match(/[?&](?:q|ll|query|center)=(-?\d+\.\d+),(-?\d+\.\d+)/)) || (m = s.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/))) {
      lat = parseFloat(m[1]); lng = parseFloat(m[2]);
    }
    return { url: u.href, lat, lng };
  }

  const mapsFromCoords = (lat, lng) => `https://www.google.com/maps?q=${lat},${lng}`;
  const mapsFromText = (m) => `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${m.venue}, ${m.city} - ${m.state}, Brasil`)}`;
  const mapsLink = (m) => m.maps_url || (m.lat != null && m.lng != null ? mapsFromCoords(m.lat, m.lng) : mapsFromText(m));

  function toast(msg) {
    let t = document.getElementById("toast");
    if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add("show");
    clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove("show"), 2600);
  }

  const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

  return { STATES, esc, todayISO, fmtDate, fmtTime, dayOf, monthOf, weekday, parseMapsLink, mapsFromCoords, mapsLink, toast, norm };
})();
