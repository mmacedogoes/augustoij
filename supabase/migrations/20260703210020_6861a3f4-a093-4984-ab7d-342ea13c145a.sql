create table if not exists public.chat_cache (
  id uuid primary key default gen_random_uuid(),
  condominio_id uuid not null references public.condominios(id) on delete cascade,
  pergunta_hash text not null,
  pergunta text not null,
  resposta text not null,
  hit_count integer not null default 0,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '48 hours'),
  last_hit_at timestamptz
);
create index if not exists chat_cache_lookup_idx on public.chat_cache (condominio_id, pergunta_hash, expires_at desc);
grant select, insert, update on public.chat_cache to authenticated;
grant all on public.chat_cache to service_role;
alter table public.chat_cache enable row level security;
drop policy if exists "chat_cache_members_select" on public.chat_cache;
create policy "chat_cache_members_select" on public.chat_cache for select to authenticated using (public.is_condominio_member(condominio_id, auth.uid()));
drop policy if exists "chat_cache_members_insert" on public.chat_cache;
create policy "chat_cache_members_insert" on public.chat_cache for insert to authenticated with check (public.is_condominio_member(condominio_id, auth.uid()));
drop policy if exists "chat_cache_members_update" on public.chat_cache;
create policy "chat_cache_members_update" on public.chat_cache for update to authenticated using (public.is_condominio_member(condominio_id, auth.uid()));