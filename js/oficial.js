// Dados oficiais das propostas (Câmara / Senado), lidos pela função Netlify /.netlify/functions/stats.
// Se a função não existir (outro serviço de hospedagem, modo local), nada é mostrado e o site segue normal.
window.MBOficial = (function () {
  const { esc } = window.MB;
  const ENDPOINT = "/.netlify/functions/stats?url=";
  const TTL = 30 * 60 * 1000;
  let unavailable = false;
  const memo = new Map();

  const nf = (n) => Number(n).toLocaleString("pt-BR");
  const dmy = (iso) => (iso ? iso.slice(0, 10).split("-").reverse().join("/") : "");

  function get(url) {
    if (unavailable) return Promise.resolve(null);
    const key = "mb_of_" + url;
    try { const c = JSON.parse(sessionStorage.getItem(key)); if (c && Date.now() - c.t < TTL) return Promise.resolve(c.d); } catch { }
    if (memo.has(url)) return memo.get(url);
    const p = (async () => {
      try {
        const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 14000);
        const r = await fetch(ENDPOINT + encodeURIComponent(url), { signal: ctl.signal }); clearTimeout(t);
        const ct = r.headers.get("content-type") || "";
        if (!ct.includes("json")) { unavailable = true; return null; }          // função não existe nesta hospedagem
        if (!r.ok) return null;
        const d = await r.json();
        if (!d || !d.ok) return null;
        try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), d })); } catch { }
        return d;
      } catch { return null; }
    })();
    memo.set(url, p);
    return p;
  }

  const row = (k, v) => `<div class="row"><span class="k">${esc(k)}</span><b>${esc(v)}</b></div>`;

  function html(d) {
    if (!d || !d.ok) return "";
    let body = "";
    if (d.kind === "camara") {
      if (d.enquete) {
        const e = d.enquete, cls = ["y", "y2", "m", "n2", "n"];
        body += `<div class="enq"><b>Enquete pública da Câmara</b> · ${nf(e.total)} participações${e.desde ? " desde " + esc(e.desde) : ""}
          ${e.itens.map((i, k) => `<div class="eq"><span>${esc(i.rotulo)}</span><span>${nf(i.votos)} (${String(i.pct).replace(".", ",")}%)</span>
            <div class="vbar"><i class="${cls[k]}" style="width:${i.pct}%"></i></div></div>`).join("")}
          <div class="src">Opinião de quem participou da enquete; não é a votação dos deputados.</div></div>`;
      }
      if (d.situacao) body += row("Situação", d.situacao);
      if (d.orgao) body += row("Onde está", d.orgao);
      if (d.autor) body += row("Autoria", d.autor);
      if (d.apresentacao) body += row("Apresentada em", dmy(d.apresentacao));
      const v = d.votacao;
      if (v) {
        const tot = v.sim + v.nao, y = Math.round((v.sim / tot) * 100), n = 100 - y;
        body += `<div class="vlegend"><span class="y">Sim ${nf(v.sim)} (${y}%)</span><span class="n">Não ${nf(v.nao)} (${n}%)</span></div>
          <div class="vbar" role="img" aria-label="Sim ${y}%, Não ${n}%"><i class="y" style="width:${y}%"></i><i class="n" style="width:${n}%"></i></div>
          <div class="src">Votos dos <b>deputados</b>${v.data ? " em " + dmy(v.data) : ""}${v.orgao ? " (" + esc(v.orgao) + ")" : ""}${v.outros ? " · outros: " + nf(v.outros) : ""}
          ${v.descricao ? "<br>" + esc(v.descricao) : ""}</div>`;
      } else {
        body += `<div class="src">Ainda sem votação nominal registrada.</div>`;
      }
    } else if (d.kind === "ideia") {
      const pct = Math.min(100, Math.round((d.apoios / d.meta) * 100));
      body += row("Apoios", `${nf(d.apoios)} de ${nf(d.meta)}`) +
        `<div class="prog" role="img" aria-label="${pct}% da meta"><i style="width:${Math.max(pct, 1)}%"></i></div>
         <div class="src">${d.encerrado ? "Prazo de apoios encerrado." : "Ideia recebendo apoios."} Meta de ${nf(d.meta)} apoios para virar sugestão legislativa.</div>`;
    } else return "";
    const hora = d.lidoEm ? new Date(d.lidoEm).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : "";
    return `<div class="box">${body}<div class="src">Fonte: ${esc(d.fonte || "site oficial")}${hora ? " · lido em " + hora : ""}. Pode haver atraso.</div></div>`;
  }

  return { get, html };
})();
