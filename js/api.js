// Camada de dados: usa Supabase quando configurado; senão, modo demonstração (localStorage).
(function () {
  const cfg = window.MOBILIZA_CONFIG || {};
  const LIVE = !!(cfg.SUPABASE_URL && cfg.SUPABASE_ANON_KEY &&
    !cfg.SUPABASE_URL.includes("SEU-PROJETO") && window.supabase);
  const sb = LIVE ? window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_ANON_KEY) : null;

  // ---------- modo demonstração ----------
  const K_MOB = "mb_demo_mobilizations", K_REQ = "mb_demo_requests", K_PROP = "mb_demo_proposals";
  const read = (k, d) => { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } };
  const write = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));

  function seed() {
    if (read(K_MOB, null)) return;
    const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
    write(K_MOB, [
      { id: uid(), title: "Encontro de exemplo — Belém", description: "Este é um cadastro de demonstração. Cadastre o seu!", venue: "Praça da República", city: "Belém", state: "PA", event_date: d(3), event_time: "09:00", maps_url: null, lat: null, lng: null, status: "active", created_at: new Date().toISOString() },
      { id: uid(), title: "Encontro de exemplo — São Paulo", description: "Cadastro de demonstração. Leve água e chegue com antecedência.", venue: "Praça Roosevelt", city: "São Paulo", state: "SP", event_date: d(5), event_time: "12:00", maps_url: null, lat: null, lng: null, status: "active", created_at: new Date().toISOString() },
      { id: uid(), title: "Encontro de exemplo — Recife", description: "Cadastro de demonstração para testar compartilhamento e filtros.", venue: "Praça do Arsenal", city: "Recife", state: "PE", event_date: d(7), event_time: "16:00", maps_url: null, lat: null, lng: null, status: "active", created_at: new Date().toISOString() }
    ]);
    write(K_REQ, []);
  }
  function seedProposals() {
    if (read(K_PROP, null)) return;
    const now = new Date().toISOString();
    write(K_PROP, [
      { id: uid(), title: "Exemplo: consulta pública no Senado", kind: "Ideia legislativa", reference: null, summary: "Cadastro de demonstração. O botão leva ao portal oficial de participação do Senado, onde a pessoa vota.", link: "https://www12.senado.leg.br/ecidadania", stance: "informativo", status: "active", created_at: now },
      { id: uid(), title: "Exemplo: acompanhe proposições na Câmara", kind: "PL", reference: "PL 0000/2026", summary: "Cadastro de demonstração. Cole o link da proposição no site da Câmara dos Deputados.", link: "https://www.camara.leg.br/", stance: "favor", status: "active", created_at: now }
    ]);
  }
  if (!LIVE) { seed(); seedProposals(); }

  const byDate = (a, b) => (a.event_date + a.event_time).localeCompare(b.event_date + b.event_time);

  const api = {
    live: LIVE,

    async list() {
      if (!LIVE) return read(K_MOB, []).filter(m => m.status === "active").sort(byDate);
      const { data, error } = await sb.from("mobilizations").select("*").eq("status", "active")
        .order("event_date").order("event_time").limit(1000);
      if (error) throw error;
      return data;
    },

    async get(id) {
      if (!LIVE) return read(K_MOB, []).find(m => m.id === id && m.status === "active") || null;
      const { data, error } = await sb.from("mobilizations").select("*").eq("id", id).eq("status", "active").maybeSingle();
      if (error) throw error;
      return data;
    },

    async create(m) {
      if (!LIVE) {
        const all = read(K_MOB, []);
        all.push({ ...m, id: uid(), status: "active", created_at: new Date().toISOString() });
        write(K_MOB, all); return;
      }
      const { error } = await sb.from("mobilizations").insert(m);
      if (error) throw error;
    },

    async requestDeletion(r) {
      if (!LIVE) {
        const all = read(K_REQ, []);
        all.push({ ...r, id: uid(), status: "pending", created_at: new Date().toISOString() });
        write(K_REQ, all); return;
      }
      const { error } = await sb.from("deletion_requests").insert(r);
      if (error) throw error;
    },

    // ---------- propostas ----------
    async listProposals() {
      if (!LIVE) return read(K_PROP, []).filter(p => p.status === "active").sort((a, b) => b.created_at.localeCompare(a.created_at));
      const { data, error } = await sb.from("proposals").select("*").eq("status", "active")
        .order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
    async getProposal(id) {
      if (!LIVE) return read(K_PROP, []).find(p => p.id === id && p.status === "active") || null;
      const { data, error } = await sb.from("proposals").select("*").eq("id", id).eq("status", "active").maybeSingle();
      if (error) throw error;
      return data;
    },
    async createProposal(p) {
      if (!LIVE) {
        const all = read(K_PROP, []);
        all.push({ ...p, id: uid(), status: "active", created_at: new Date().toISOString() });
        write(K_PROP, all); return;
      }
      const { error } = await sb.from("proposals").insert(p);
      if (error) throw error;
    },
    async requestProposalDeletion(r) {
      if (!LIVE) {
        const all = read(K_REQ, []);
        all.push({ ...r, id: uid(), status: "pending", created_at: new Date().toISOString() });
        write(K_REQ, all); return;
      }
      const { error } = await sb.from("deletion_requests").insert(r);
      if (error) throw error;
    },
    async listAllProposals() {
      if (!LIVE) return read(K_PROP, []).sort((a, b) => b.created_at.localeCompare(a.created_at));
      const { data, error } = await sb.from("proposals").select("*").order("created_at", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },
    async setProposalStatus(id, status) {
      if (!LIVE) {
        const props = read(K_PROP, []); const p = props.find(x => x.id === id);
        if (p) p.status = status; write(K_PROP, props); return;
      }
      const { error } = await sb.from("proposals").update({ status }).eq("id", id);
      if (error) throw error;
    },

    // ---------- admin ----------
    async session() {
      if (!LIVE) return { demo: true };
      const { data } = await sb.auth.getSession();
      return data.session;
    },
    async login(email, password) {
      if (!LIVE) return;
      const { error } = await sb.auth.signInWithPassword({ email, password });
      if (error) throw error;
    },
    async logout() { if (LIVE) await sb.auth.signOut(); },
    async isAdmin() {
      if (!LIVE) return true;
      const { data, error } = await sb.rpc("is_admin");
      if (error) return false;
      return !!data;
    },

    async listRequests() {
      if (!LIVE) {
        const mobs = read(K_MOB, []), props = read(K_PROP, []);
        return read(K_REQ, []).map(r => ({
          ...r,
          mobilizations: mobs.find(m => m.id === r.mobilization_id) || null,
          proposals: props.find(p => p.id === r.proposal_id) || null
        })).sort((a, b) => b.created_at.localeCompare(a.created_at));
      }
      const { data, error } = await sb.from("deletion_requests").select("*, mobilizations(*), proposals(*)")
        .order("created_at", { ascending: false }).limit(500);
      if (error) throw error;
      return data;
    },

    async resolveRequest(id, approve) {
      if (!LIVE) {
        const reqs = read(K_REQ, []); const r = reqs.find(x => x.id === id); if (!r) return;
        r.status = approve ? "approved" : "rejected"; r.resolved_at = new Date().toISOString();
        if (approve) {
          if (r.proposal_id) {
            const props = read(K_PROP, []); const p = props.find(x => x.id === r.proposal_id);
            if (p) p.status = "removed"; write(K_PROP, props);
          } else {
            const mobs = read(K_MOB, []); const m = mobs.find(x => x.id === r.mobilization_id);
            if (m) m.status = "removed"; write(K_MOB, mobs);
          }
        }
        write(K_REQ, reqs); return;
      }
      const { error } = await sb.rpc("resolve_deletion_request", { p_request_id: id, p_approve: approve });
      if (error) throw error;
    },

    async listAll() {
      if (!LIVE) return read(K_MOB, []).sort(byDate);
      const { data, error } = await sb.from("mobilizations").select("*")
        .order("event_date", { ascending: false }).limit(1000);
      if (error) throw error;
      return data;
    },

    async setStatus(id, status) {
      if (!LIVE) {
        const mobs = read(K_MOB, []); const m = mobs.find(x => x.id === id);
        if (m) m.status = status; write(K_MOB, mobs); return;
      }
      const { error } = await sb.from("mobilizations").update({ status }).eq("id", id);
      if (error) throw error;
    }
  };

  window.MobilizaAPI = api;
})();
