-- YC Office Hours — Supabase Schema
-- Run this in the Supabase SQL Editor

-- ═══════════════════════════════════════════
-- 1. Tables
-- ═══════════════════════════════════════════

create table sessions (
  id text not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  mode text not null check (mode in ('startup', 'builder')),
  history jsonb not null default '[]',
  design_doc text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (id, user_id)
);

create index idx_sessions_user_time on sessions(user_id, updated_at desc);

create table user_preferences (
  user_id uuid references auth.users(id) on delete cascade primary key,
  api_provider text default 'claude',
  api_endpoint text,
  api_model text,
  use_proxy boolean default false,
  preferred_lang text default 'en',
  updated_at timestamptz default now()
);

-- ═══════════════════════════════════════════
-- 2. Explicit GRANTs (required since 2026-04-28)
--    New tables are NOT auto-exposed to Data API.
--    Only grant to authenticated — anon has no access.
-- ═══════════════════════════════════════════

grant select, insert, update, delete on public.sessions to authenticated;
grant select, insert, update, delete on public.user_preferences to authenticated;

-- ═══════════════════════════════════════════
-- 3. RLS + Policies (bundled with GRANTs)
-- ═══════════════════════════════════════════

alter table sessions enable row level security;
alter table user_preferences enable row level security;

create policy "own_sessions" on sessions for all using (auth.uid() = user_id);
create policy "own_prefs" on user_preferences for all using (auth.uid() = user_id);

-- ═══════════════════════════════════════════
-- 4. updated_at auto-refresh trigger
-- ═══════════════════════════════════════════

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_sessions_updated_at
  before update on sessions
  for each row execute function public.handle_updated_at();

create trigger set_prefs_updated_at
  before update on user_preferences
  for each row execute function public.handle_updated_at();
