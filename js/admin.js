(function () {
  const { esc, fmtDate, fmtTime, mapsLink, toast } = window.MB;
  const api = window.MobilizaAPI;
  const $ = (s) => document.querySelector(s);
  const show = (s, on = true) => $(s).classList.toggle("hidden", !on);
  const STATUS_TXT = { pending: "Pendente", approved: "Aprovado", rejected: "Recusado", active: "Ativa", removed: "Removida" };

  async function init() {
    if (!api.live) show("#demoBanner");
    const s = await api.session();
    if (!s) { show("#loginView"); show("#panelView", false); show("#btnLogout", false); return; }
    if (!(await api.isAdmin())) { show("#loginView", false); show("#denied"); show("#btnLogout"); return; }
    show("#loginView", false); show("#denied", false); show("#panelView"); show("#btnLogout", api.live);
    await refresh();
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault(); show("#loginErr", false);
    const b = $("#btnLogin"); b.disabled = true;
    try { await api.login($("#email").value.trim(), $("#password").value); await init(); }
    catch (ex) {
      const msg = String((ex && ex.message) || ex || "");
      let t = "Não foi possível entrar: " + msg;
      if (/invalid login credentials/i.test(msg)) t = "E-mail ou senha inválidos.";
      else if (/not confirmed/i.test(msg)) t = "E-mail ainda não confirmado no Supabase.";
      else if (/api key|apikey|jwt/i.test(msg)) t = "Chave do Supabase inválida. Confira a chave anon public em js/config.js.";
      else if (/failed to fetch|network/i.test(msg)) t = "Sem conexão com o Supabase. Confira a URL em js/config.js.";
      console.error("Erro de login:", ex);
      $("#loginErr").textContent = t; show("#loginErr");
    }
    b.disabled = false;
  });
  $("#btnLogout").addEventListener("click", async () => { await api.logout(); location.reload(); });

  document.querySelector(".tabs").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    document.querySelectorAll(".tabs button").forEach(x => x.classList.toggle("on", x === b));
    show("#tabReq", b.dataset.tab === "req"); show("#tabAll", b.dataset.tab === "all"); show("#tabProps", b.dataset.tab === "props");
  });
  $("#showResolved").addEventListener("input", refresh);

  const safeLink = (u) => { const g = window.MB.parseGovLink(u); return g ? g.url : null; };

  function reqCard(r) {
    const m = r.mobilizations, p = r.proposals;
    const pending = r.status === "pending";
    const title = p ? `🗳️ ${esc(p.title)}` : (m ? esc(m.title) : "(item não encontrado)");
    let body = "";
    if (m) body = `<div style="color:var(--muted);font-size:.9rem">${esc(m.venue)} · ${esc(m.city)}/${esc(m.state)} · ${fmtDate(m.event_date)} às ${fmtTime(m.event_time)}
        · <a href="${esc(mapsLink(m))}" target="_blank" rel="noopener noreferrer">mapa</a></div>
        <div style="font-size:.92rem;white-space:pre-line">${esc(m.description)}</div>`;
    if (p) body = `<div style="color:var(--muted);font-size:.9rem">${esc(p.kind)}${p.reference ? " · " + esc(p.reference) : ""}
        ${safeLink(p.link) ? ` · <a href="${esc(safeLink(p.link))}" target="_blank" rel="noopener noreferrer">link oficial</a>` : ""}</div>
        <div style="font-size:.92rem;white-space:pre-line">${esc(p.summary)}</div>`;
    return `
    <div class="panel req" data-id="${esc(r.id)}">
      <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center">
        <b>${title}</b>
        <span class="status-pill st-${esc(r.status)}">${STATUS_TXT[r.status] || esc(r.status)}</span>
      </div>
      ${body}
      <div class="reason"><b>Motivo:</b> ${esc(r.reason)}${r.contact ? `<br><b>Contato:</b> ${esc(r.contact)}` : ""}</div>
      <small style="color:var(--muted)">Pedido em ${new Date(r.created_at).toLocaleString("pt-BR")}</small>
      ${pending ? `<div class="actions">
        <button class="btn btn-danger btn-sm" data-act="approve">Aprovar e remover ato</button>
        <button class="btn btn-ghost btn-sm" data-act="reject">Recusar pedido</button></div>` : ""}
    </div>`;
  }

  async function refresh() {
    try {
      const [reqs, all, props] = await Promise.all([api.listRequests(), api.listAll(), api.listAllProposals()]);
      const pend = reqs.filter(r => r.status === "pending");
      $("#badge").textContent = pend.length; show("#badge", pend.length > 0);
      const list = $("#showResolved").checked ? reqs : pend;
      $("#reqList").innerHTML = list.length ? list.map(reqCard).join("") :
        `<div class="empty"><b>Nenhum pedido ${$("#showResolved").checked ? "" : "pendente"}</b>Tudo em dia 🎉</div>`;
      $("#allBody").innerHTML = all.map(m => `
        <tr data-id="${esc(m.id)}">
          <td><b>${esc(m.title)}</b></td>
          <td>${esc(m.venue)}<br><small style="color:var(--muted)">${esc(m.city)}/${esc(m.state)}</small></td>
          <td>${fmtDate(m.event_date)}<br><small style="color:var(--muted)">${fmtTime(m.event_time)}</small></td>
          <td><span class="status-pill st-${esc(m.status)}">${STATUS_TXT[m.status] || esc(m.status)}</span></td>
          <td>${m.status === "active"
            ? '<button class="btn btn-ghost btn-sm" data-act="remove">Remover</button>'
            : '<button class="btn btn-ghost btn-sm" data-act="restore">Restaurar</button>'}</td>
        </tr>`).join("") || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:30px">Nada cadastrado ainda.</td></tr>';
      $("#propsBody").innerHTML = props.map(p => `
        <tr data-id="${esc(p.id)}">
          <td><b>${esc(p.title)}</b>${p.reference ? `<br><small style="color:var(--muted)">${esc(p.reference)}</small>` : ""}</td>
          <td>${esc(p.kind)}</td>
          <td>${safeLink(p.link) ? `<a href="${esc(safeLink(p.link))}" target="_blank" rel="noopener noreferrer">abrir</a>` : "—"}</td>
          <td><span class="status-pill st-${esc(p.status)}">${STATUS_TXT[p.status] || esc(p.status)}</span></td>
          <td>${p.status === "active"
            ? '<button class="btn btn-ghost btn-sm" data-act="premove">Remover</button>'
            : '<button class="btn btn-ghost btn-sm" data-act="prestore">Restaurar</button>'}</td>
        </tr>`).join("") || '<tr><td colspan="5" style="text-align:center;color:var(--muted);padding:30px">Nenhuma proposta cadastrada.</td></tr>';
    } catch (e) { console.error(e); toast("Erro ao carregar. Você é moderador? O propostas.sql foi executado?"); }
  }

  document.addEventListener("click", async (e) => {
    const b = e.target.closest("[data-act]"); if (!b) return;
    const id = b.closest("[data-id]").dataset.id, act = b.dataset.act;
    if (act === "approve" && !confirm("Remover este ato do site?")) return;
    if (act === "remove" && !confirm("Remover este ato do site?")) return;
    if (act === "premove" && !confirm("Remover esta proposta do site?")) return;
    b.disabled = true;
    try {
      if (act === "approve") await api.resolveRequest(id, true);
      if (act === "reject") await api.resolveRequest(id, false);
      if (act === "remove") await api.setStatus(id, "removed");
      if (act === "restore") await api.setStatus(id, "active");
      if (act === "premove") await api.setProposalStatus(id, "removed");
      if (act === "prestore") await api.setProposalStatus(id, "active");
      toast("Feito."); await refresh();
    } catch (ex) { console.error(ex); toast("Não foi possível concluir a ação."); b.disabled = false; }
  });

  init();
})();
