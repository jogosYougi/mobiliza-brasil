-- =====================================================================
--  MOBILIZA BRASIL — Módulo "Propostas" (PL, PEC, ideias legislativas)
--  RODE DEPOIS do schema.sql:  Supabase > SQL Editor > New query > cole TUDO > Run.
--  Pode rodar mais de uma vez sem quebrar.
--
--  O site NÃO registra votos. Cada proposta guarda apenas o link do site
--  oficial do governo (Câmara, Senado, gov.br...) onde a pessoa vota.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1) TABELA DE PROPOSTAS
-- ---------------------------------------------------------------------
create table if not exists public.proposals (
  id          uuid primary key default gen_random_uuid(),
  title       text not null check (char_length(title) between 3 and 140),
  kind        text not null check (kind in
                ('PL','PEC','PLP','PDL','Ideia legislativa','Consulta pública','Outro')),
  reference   text check (reference is null or char_length(reference) <= 60),   -- ex.: "PL 1234/2025"
  summary     text not null check (char_length(summary) between 5 and 2000),
  link        text not null check (
                char_length(link) <= 500 and
                link ~* '^https://([a-z0-9-]+\.)*(leg|gov)\.br(/|$|\?|#)'),     -- só sites oficiais
  stance      text not null default 'informativo' check (stance in ('favor','contra','informativo')),
  status      text not null default 'active' check (status in ('active','removed')),
  created_at  timestamptz not null default now()
);

create index if not exists proposals_status_created_idx on public.proposals (status, created_at desc);

alter table public.proposals enable row level security;

drop policy if exists "public read active proposals" on public.proposals;
drop policy if exists "public insert proposals"      on public.proposals;
drop policy if exists "admin read all proposals"     on public.proposals;
drop policy if exists "admin update proposals"       on public.proposals;

create policy "public read active proposals" on public.proposals
  for select to anon, authenticated using (status = 'active');

create policy "public insert proposals" on public.proposals
  for insert to anon, authenticated with check (status = 'active');

create policy "admin read all proposals" on public.proposals
  for select to authenticated using (public.is_admin());

create policy "admin update proposals" on public.proposals
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 2) PEDIDOS DE EXCLUSÃO TAMBÉM PARA PROPOSTAS
--    (reaproveita a tabela deletion_requests)
-- ---------------------------------------------------------------------
alter table public.deletion_requests
  add column if not exists proposal_id uuid references public.proposals(id) on delete cascade;

alter table public.deletion_requests alter column mobilization_id drop not null;

alter table public.deletion_requests drop constraint if exists deletion_requests_one_target;
alter table public.deletion_requests add constraint deletion_requests_one_target
  check ((mobilization_id is not null)::int + (proposal_id is not null)::int = 1);

-- ---------------------------------------------------------------------
-- 3) FUNÇÃO DE MODERAÇÃO ATUALIZADA (atos E propostas)
-- ---------------------------------------------------------------------
create or replace function public.resolve_deletion_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mob  uuid;
  v_prop uuid;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;

  select mobilization_id, proposal_id into v_mob, v_prop
  from public.deletion_requests
  where id = p_request_id and status = 'pending';

  if not found then
    raise exception 'Pedido não encontrado ou já resolvido';
  end if;

  update public.deletion_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         resolved_at = now()
   where id = p_request_id;

  if p_approve then
    if v_mob is not null then
      update public.mobilizations set status = 'removed' where id = v_mob;
      update public.deletion_requests set status = 'approved', resolved_at = now()
       where mobilization_id = v_mob and status = 'pending';
    else
      update public.proposals set status = 'removed' where id = v_prop;
      update public.deletion_requests set status = 'approved', resolved_at = now()
       where proposal_id = v_prop and status = 'pending';
    end if;
  end if;
end;
$$;

revoke all on function public.resolve_deletion_request(uuid, boolean) from public, anon;
grant execute on function public.resolve_deletion_request(uuid, boolean) to authenticated;
