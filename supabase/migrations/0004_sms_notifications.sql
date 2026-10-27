-- =============================================================================
-- Agrolytix · SMS Notifications & Arkesel Config (Migration 0004)
-- -----------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste ALL → Run.
-- =============================================================================

-- 1. Table to store SMS alert configuration per organization (HQ admins can update)
create table if not exists public.chat_sms_settings (
  org_id bigint primary key,
  arkesel_api_key text,
  sender_id text default 'Agrolytix',
  enabled boolean default true,
  alert_stock_intake boolean default true,
  alert_cash_declaration boolean default true,
  alert_cash_balanced boolean default true,
  alert_cash_imbalance boolean default true,
  alert_price_change boolean default true,
  alert_missing_cash boolean default true,
  alert_daily_summary boolean default true,
  alert_low_balance boolean default true,
  low_balance_threshold numeric(10,2) default 10.00,
  last_low_balance_alert_at timestamptz,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.chat_sms_settings enable row level security;

-- Policies: only authenticated members of org can view, only HQ admin can update/insert
drop policy if exists chat_sms_settings_select on public.chat_sms_settings;
create policy chat_sms_settings_select on public.chat_sms_settings
  for select to authenticated
  using (org_id = public.agx_org_id());

drop policy if exists chat_sms_settings_upsert on public.chat_sms_settings;
create policy chat_sms_settings_upsert on public.chat_sms_settings
  for all to authenticated
  using (org_id = public.agx_org_id() and public.agx_is_hq_admin())
  with check (org_id = public.agx_org_id() and public.agx_is_hq_admin());

-- 2. Table to audit dispatched SMS logs
create table if not exists public.chat_sms_logs (
  id uuid primary key default gen_random_uuid(),
  org_id bigint not null,
  event_type text not null,
  recipients text[] not null,
  message text not null,
  status text not null, -- 'success', 'failed', 'skipped'
  response jsonb,
  error_message text,
  created_at timestamptz default now()
);

alter table public.chat_sms_logs enable row level security;

drop policy if exists chat_sms_logs_select on public.chat_sms_logs;
create policy chat_sms_logs_select on public.chat_sms_logs
  for select to authenticated
  using (org_id = public.agx_org_id() and public.agx_is_admin());

-- 3. Cache table for workers/contacts with phone numbers in the org
-- This allows the Edge Function or triggers to reliably target phones
create table if not exists public.chat_contacts (
  user_id bigint not null,
  org_id bigint not null,
  business_id bigint not null,
  name text not null,
  role text not null,
  phone text,
  updated_at timestamptz default now(),
  primary key (user_id, org_id)
);

alter table public.chat_contacts enable row level security;

drop policy if exists chat_contacts_select on public.chat_contacts;
create policy chat_contacts_select on public.chat_contacts
  for select to authenticated
  using (org_id = public.agx_org_id());

drop policy if exists chat_contacts_upsert on public.chat_contacts;
create policy chat_contacts_upsert on public.chat_contacts
  for all to authenticated
  using (org_id = public.agx_org_id())
  with check (org_id = public.agx_org_id());

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';
