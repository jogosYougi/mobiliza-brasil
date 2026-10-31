-- =====================================================================
--  MOBILIZA BRASIL — Banco de dados (PostgreSQL / Supabase)
--  Como usar: Supabase > SQL Editor > New query > cole TUDO > Run.
--  Pode rodar mais de uma vez sem quebrar (usa IF NOT EXISTS / OR REPLACE).
-- =====================================================================

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------
-- 1) TABELA PRINCIPAL: mobilizações
-- ---------------------------------------------------------------------
create table if not exists public.mobilizations (
  id           uuid primary key default gen_random_uuid(),
  title        text        not null check (char_length(title) between 3 and 120),
  description  text        not null check (char_length(description) between 5 and 2000),
  venue        text        not null check (char_length(venue) between 2 and 160),   -- local de encontro
  city         text        not null check (char_length(city) between 2 and 80),
  state        char(2)     not null check (state in (
                 'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG',
                 'PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO')),
  event_date   date        not null,
  event_time   time        not null,
  maps_url     text        check (maps_url is null or (
                 char_length(maps_url) <= 500 and maps_url ~* '^https://')),
  lat          double precision check (lat between -90  and 90),
  lng          double precision check (lng between -180 and 180),
  status       text        not null default 'active' check (status in ('active','removed')),
  created_at   timestamptz not null default now()
);

create index if not exists mobilizations_status_date_idx on public.mobilizations (status, event_date);
create index if not exists mobilizations_state_idx       on public.mobilizations (state);

-- ---------------------------------------------------------------------
-- 2) PEDIDOS DE EXCLUSÃO
-- ---------------------------------------------------------------------
create table if not exists public.deletion_requests (
  id               uuid primary key default gen_random_uuid(),
  mobilization_id  uuid not null references public.mobilizations(id) on delete cascade,
  reason           text not null check (char_length(reason) between 5 and 1000),
  contact          text check (contact is null or char_length(contact) <= 160),  -- opcional
  status           text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at       timestamptz not null default now(),
  resolved_at      timestamptz
);

create index if not exists deletion_requests_status_idx on public.deletion_requests (status, created_at);

-- ---------------------------------------------------------------------
-- 3) ADMINISTRADORES (quem pode moderar)
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create or replace function public.is_admin()
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------------
-- 4) SEGURANÇA (Row Level Security)
--    Visitantes (anon): leem atos ativos, cadastram atos, pedem exclusão.
--    Admins: leem tudo e moderam.
-- ---------------------------------------------------------------------
alter table public.mobilizations     enable row level security;
alter table public.deletion_requests enable row level security;
alter table public.admins            enable row level security;   -- sem policies = ninguém acessa pela API

drop policy if exists "public read active"      on public.mobilizations;
drop policy if exists "public insert"           on public.mobilizations;
drop policy if exists "admin read all"          on public.mobilizations;
drop policy if exists "admin update"            on public.mobilizations;
drop policy if exists "public request deletion" on public.deletion_requests;
drop policy if exists "admin read requests"     on public.deletion_requests;

create policy "public read active" on public.mobilizations
  for select to anon, authenticated
  using (status = 'active');

create policy "public insert" on public.mobilizations
  for insert to anon, authenticated
  with check (status = 'active');

create policy "admin read all" on public.mobilizations
  for select to authenticated
  using (public.is_admin());

create policy "admin update" on public.mobilizations
  for update to authenticated
  using (public.is_admin())
  with check (public.is_admin());

create policy "public request deletion" on public.deletion_requests
  for insert to anon, authenticated
  with check (status = 'pending');

create policy "admin read requests" on public.deletion_requests
  for select to authenticated
  using (public.is_admin());

-- ---------------------------------------------------------------------
-- 5) FUNÇÃO DE MODERAÇÃO: aprovar ou recusar um pedido de exclusão
--    Aprovar => o ato passa a status 'removed' (some do site, fica no banco).
-- ---------------------------------------------------------------------
create or replace function public.resolve_deletion_request(p_request_id uuid, p_approve boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_mob uuid;
begin
  if not public.is_admin() then
    raise exception 'Acesso negado';
  end if;

  select mobilization_id into v_mob
  from public.deletion_requests
  where id = p_request_id and status = 'pending';

  if v_mob is null then
    raise exception 'Pedido não encontrado ou já resolvido';
  end if;

  update public.deletion_requests
     set status = case when p_approve then 'approved' else 'rejected' end,
         resolved_at = now()
   where id = p_request_id;

  if p_approve then
    update public.mobilizations set status = 'removed' where id = v_mob;
    -- encerra outros pedidos pendentes do mesmo ato
    update public.deletion_requests
       set status = 'approved', resolved_at = now()
     where mobilization_id = v_mob and status = 'pending';
  end if;
end;
$$;

revoke all on function public.resolve_deletion_request(uuid, boolean) from public, anon;
grant execute on function public.resolve_deletion_request(uuid, boolean) to authenticated;

-- ---------------------------------------------------------------------
-- 6) COMO CRIAR O PRIMEIRO ADMIN
--    a) Supabase > Authentication > Users > Add user (e-mail + senha)
--    b) Rode o comando abaixo trocando pelo e-mail criado:
--
--    insert into public.admins (user_id)
--    select id from auth.users where email = 'SEU-EMAIL@exemplo.com'
--    on conflict do nothing;
-- ---------------------------------------------------------------------
