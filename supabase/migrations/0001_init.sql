-- Al Qema Solar Quote Tool — complete backend schema.
-- Portable: run this on any fresh Supabase project to recreate the backend.
-- (Identical to the migration originally applied on 2026-08-11.)

-- Leads: every completed quote, auto-saved from the public site.
create table public.leads (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  name text not null check (char_length(name) between 1 and 200),
  whatsapp text not null check (char_length(whatsapp) between 4 and 40),
  city text not null default '' check (char_length(city) <= 200),
  property_type text not null default '' check (char_length(property_type) <= 100),
  lang text not null default 'ar' check (lang in ('ar', 'en')),
  config_version text not null check (char_length(config_version) <= 100),
  tier text not null check (char_length(tier) <= 20),
  price_from numeric,
  is_custom boolean not null default false,
  confidence text not null default 'high' check (confidence in ('high', 'low')),
  form jsonb not null,
  result jsonb not null,
  constraint payload_size check (
    pg_column_size(form) < 200000 and pg_column_size(result) < 200000
  )
);

alter table public.leads enable row level security;

-- The public site can only write; only signed-in company staff can read.
create policy anon_insert_leads on public.leads
  for insert to anon with check (true);
create policy auth_select_leads on public.leads
  for select to authenticated using (true);

-- Versioned pricing configs; exactly one active at a time.
create table public.pricing_configs (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  version text not null unique check (char_length(version) <= 100),
  config jsonb not null,
  is_active boolean not null default false
);

create unique index one_active_pricing_config
  on public.pricing_configs (is_active) where is_active;

alter table public.pricing_configs enable row level security;

create policy anon_read_active_config on public.pricing_configs
  for select to anon using (is_active);
create policy auth_all_configs on public.pricing_configs
  for all to authenticated using (true) with check (true);

-- Atomic activate: both flips in one statement-level transaction.
create or replace function public.activate_pricing_config(target uuid)
returns void
language sql
security definer
set search_path = public
as $$
  update pricing_configs set is_active = false where is_active and id <> target;
  update pricing_configs set is_active = true where id = target;
$$;

revoke execute on function public.activate_pricing_config(uuid) from public, anon;
grant execute on function public.activate_pricing_config(uuid) to authenticated;
