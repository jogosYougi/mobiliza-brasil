// Função Netlify: lê dados PÚBLICOS de sites oficiais e devolve um JSON simples para o site.
//   GET /.netlify/functions/stats?url=<link oficial da proposta>
//
// Por que existe: os navegadores bloqueiam a leitura direta das páginas do Senado (CORS) e
// assim também guardamos o resultado em cache (o Netlify repete a resposta por ~30 min).
//
// Suporta:
//   • Câmara dos Deputados — API de Dados Abertos: situação, autoria, ementa e a última
//     votação com votos Sim/Não dos DEPUTADOS (não é enquete popular).
//   • Senado e-Cidadania — Ideia Legislativa: número de apoios e meta.
// Qualquer outro endereço devolve { ok:false } e o site simplesmente não mostra números.
//
// Segurança: só buscamos em hosts fixos e montamos as URLs nós mesmos a partir de um id numérico.

const UA = "MobilizaBrasil/1.0 (leitura de dados publicos)";
const TIMEOUT_MS = 8000;
const CAM = "https://dadosabertos.camara.leg.br/api/v2";

async function http(url, accept) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), TIMEOUT_MS);
  try {
    const r = await fetch(url, { signal: ctl.signal, headers: { "user-agent": UA, accept: accept || "*/*" } });
    if (!r.ok) throw new Error("HTTP " + r.status);
    return r;
  } finally { clearTimeout(t); }
}
const getJson = async (u) => (await http(u, "application/json")).json();

const norm = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();
const num = (v) => (typeof v === "number" && isFinite(v) ? v : 0);
const isoDate = (s) => (s ? String(s).slice(0, 10) : null);
const cut = (s, n) => (s && s.length > n ? s.slice(0, n - 1).trimEnd() + "…" : s || null);

/* ---------- identifica o tipo de link ---------- */
function classify(raw) {
  let u;
  try { u = new URL(String(raw || "")); } catch { return null; }
  if (u.protocol !== "https:" || u.username || u.password) return null;
  const h = u.hostname.toLowerCase();
  if (h === "www.camara.leg.br" || h === "camara.leg.br") {
    let id = u.searchParams.get("idProposicao");
    if (!id) { const m = u.pathname.match(/\/propostas-legislativas\/(\d+)/i); if (m) id = m[1]; }
    return id && /^\d{1,9}$/.test(id) ? { kind: "camara", id } : null;
  }
  if (/^(www12|www25|www)\.senado\.(leg|gov)\.br$/.test(h) && /\/ecidadania\/visualizacaoideia/i.test(u.pathname)) {
    const id = u.searchParams.get("id");
    return id && /^\d{1,9}$/.test(id) ? { kind: "ideia", id } : null;
  }
  return null;
}

/* ---------- Câmara ---------- */
async function camaraLista(id) {
  for (const u of [`${CAM}/proposicoes/${id}/votacoes?ordem=DESC&ordenarPor=dataHoraRegistro`, `${CAM}/proposicoes/${id}/votacoes`]) {
    try { return (await getJson(u)).dados || []; } catch { /* tenta sem parâmetros */ }
  }
  return [];
}

async function camaraVotos(votId) {
  if (!/^[\w-]{1,40}$/.test(String(votId))) return null;
  let j = null;
  for (const u of [`${CAM}/votacoes/${votId}/votos?itens=600`, `${CAM}/votacoes/${votId}/votos`]) {
    try { j = await getJson(u); break; } catch { /* próxima */ }
  }
  if (!j) return null;
  let sim = 0, nao = 0, outros = 0;
  for (let page = 0; page < 8 && j; page++) {
    for (const v of j.dados || []) {
      const t = norm(v.tipoVoto);
      if (t === "sim") sim++; else if (t === "nao") nao++; else if (t) outros++;
    }
    const next = (j.links || []).find((l) => l.rel === "next");
    if (!next) break;
    try {
      if (new URL(next.href).hostname !== "dadosabertos.camara.leg.br") break;
      j = await getJson(next.href);
    } catch { break; }
  }
  return { sim, nao, outros };
}

async function camara(id) {
  const [det, aut, vots] = await Promise.allSettled([
    getJson(`${CAM}/proposicoes/${id}`),
    getJson(`${CAM}/proposicoes/${id}/autores`),
    camaraLista(id)
  ]);
  const d = det.status === "fulfilled" && det.value && det.value.dados;
  if (!d) throw new Error("proposição não encontrada");
  const st = d.statusProposicao || {};
  const nomes = aut.status === "fulfilled" ? ((aut.value && aut.value.dados) || []).map((a) => a.nome).filter(Boolean) : [];
  const out = {
    kind: "camara",
    fonte: "Câmara dos Deputados",
    reference: [d.siglaTipo, d.numero && d.ano ? `${d.numero}/${d.ano}` : null].filter(Boolean).join(" ") || null,
    ementa: cut(d.ementa, 420),
    situacao: st.descricaoSituacao || null,
    orgao: st.siglaOrgao || null,
    apresentacao: isoDate(d.dataApresentacao),
    autor: nomes.length ? (nomes.length > 1 ? `${nomes[0]} e mais ${nomes.length - 1}` : nomes[0]) : null,
    votacao: null
  };
  const lista = vots.status === "fulfilled" ? vots.value.slice() : [];
  const dt = (v) => String(v.dataHoraRegistro || v.data || "");
  lista.sort((a, b) => dt(b).localeCompare(dt(a)));
  const cand = [...lista.filter((v) => v.siglaOrgao === "PLEN"), ...lista.filter((v) => v.siglaOrgao !== "PLEN")].slice(0, 4);
  for (const v of cand) {
    let sim = num(v.votosSim), nao = num(v.votosNao), outros = num(v.votosOutros);
    if (!(sim + nao > 0)) { const c = await camaraVotos(v.id); if (c) ({ sim, nao, outros } = c); }
    if (sim + nao > 0) {
      out.votacao = {
        data: isoDate(v.dataHoraRegistro || v.data), descricao: cut(v.descricao, 220), orgao: v.siglaOrgao || null,
        sim, nao, outros, aprovacao: v.aprovacao === 1 ? true : v.aprovacao === 0 ? false : null
      };
      break;
    }
  }
  return out;
}

/* ---------- Senado e-Cidadania: Ideia Legislativa ---------- */
function parseIdeia(html) {
  const text = String(html)
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ");
  const m = text.match(/(\d{1,3}(?:\.\d{3})+|\d+)\s+apoios?\s+confirmados?/i);
  if (!m) return null;
  const meta = text.match(/meta[^0-9]{0,80}(\d{1,3}(?:\.\d{3})+)/i);
  return {
    apoios: parseInt(m[1].replace(/\./g, ""), 10),
    meta: meta ? parseInt(meta[1].replace(/\./g, ""), 10) : 20000,   // 20 mil apoios: regra do e-Cidadania
    encerrado: /prazo de apoios encerrado/i.test(text)
  };
}

async function ideia(id) {
  const html = await (await http(`https://www12.senado.leg.br/ecidadania/visualizacaoideia?id=${id}`, "text/html")).text();
  const p = parseIdeia(html);
  if (!p) throw new Error("apoios não encontrados na página");
  return { kind: "ideia", fonte: "Senado Federal — e-Cidadania", ...p };
}

/* ---------- handler ---------- */
exports.handler = async (event) => {
  const base = { "content-type": "application/json; charset=utf-8" };
  const ok = { ...base, "cache-control": "public, max-age=600", "netlify-cdn-cache-control": "public, s-maxage=1800, stale-while-revalidate=3600" };
  const no = { ...base, "cache-control": "no-store" };
  const c = classify((event.queryStringParameters || {}).url);
  if (!c) return { statusCode: 200, headers: ok, body: JSON.stringify({ ok: false, reason: "unsupported" }) };
  try {
    const data = c.kind === "camara" ? await camara(c.id) : await ideia(c.id);
    return { statusCode: 200, headers: ok, body: JSON.stringify({ ok: true, ...data, lidoEm: new Date().toISOString() }) };
  } catch (e) {
    return { statusCode: 200, headers: no, body: JSON.stringify({ ok: false, reason: "upstream" }) };
  }
};

exports.__test = { classify, parseIdeia, camara, ideia };
