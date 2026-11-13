-- =============================================================================
-- Agrolytix · Communications Table & Automated SMS Controls (Migration 0007)
-- -----------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste ALL → Run.
-- =============================================================================

-- 1. Create the communications table to control & audit SMS to workers & clients
create table if not exists public.communications (
  id uuid primary key default gen_random_uuid(),
  org_id bigint not null,
  business_id bigint,
  audience text not null check (audience in ('worker', 'client', 'admin', 'all')),
  mode text not null default 'manual' check (mode in ('manual', 'automated')),
  event_type text not null default 'custom_sms',
  recipient_ids bigint[] default '{}',
  recipient_names text[] default '{}',
  recipients text[] not null default '{}',
  message text not null,
  status text not null default 'sent' check (status in ('sent', 'failed', 'skipped')),
  sent_by_id bigint,
  sent_by_name text,
  error_message text,
  response jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_communications_org_created
  on public.communications (org_id, created_at desc);

create index if not exists idx_communications_audience
  on public.communications (org_id, audience, mode);

-- Enable RLS
alter table public.communications enable row level security;

drop policy if exists communications_select on public.communications;
create policy communications_select on public.communications
  for select to authenticated
  using (org_id = public.agx_org_id() and public.agx_is_admin());

drop policy if exists communications_insert on public.communications;
create policy communications_insert on public.communications
  for insert to authenticated
  with check (org_id = public.agx_org_id() and public.agx_is_admin());

-- 2. Extend chat_sms_settings with worker & client automated SMS controls
alter table public.chat_sms_settings
  add column if not exists alert_worker_cash_balanced_profit boolean default true,
  add column if not exists alert_client_sale_receipt boolean default false,
  add column if not exists alert_client_debt_reminder boolean default false,
  add column if not exists alert_client_debt_payment boolean default true;

-- Allow any Admin of the org (not only HQ Admin) to update SMS settings
drop policy if exists chat_sms_settings_upsert on public.chat_sms_settings;
create policy chat_sms_settings_upsert on public.chat_sms_settings
  for all to authenticated
  using (org_id = public.agx_org_id() and public.agx_is_admin())
  with check (org_id = public.agx_org_id() and public.agx_is_admin());

-- 3. Custom Automated SMS Rules table (allows Admins to create/manage automated SMS rules)
create table if not exists public.communication_rules (
  id uuid primary key default gen_random_uuid(),
  org_id bigint not null,
  business_id bigint,
  name text not null,
  audience text not null check (audience in ('worker', 'client', 'debtors', 'admin', 'custom')),
  target_ids bigint[] not null default '{}',
  target_names text[] not null default '{}',
  trigger_event text not null,
  schedule_time text,
  message_template text not null,
  message_templates text[] not null default '{}',
  enabled boolean not null default true,
  created_by_id bigint,
  created_by_name text,
  last_run_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Safe column upgrades if communication_rules already existed
alter table public.communication_rules drop constraint if exists communication_rules_audience_check;
alter table public.communication_rules add constraint communication_rules_audience_check
  check (audience in ('worker', 'client', 'debtors', 'admin', 'custom'));
alter table public.communication_rules add column if not exists target_ids bigint[] not null default '{}';
alter table public.communication_rules add column if not exists target_names text[] not null default '{}';
alter table public.communication_rules add column if not exists message_templates text[] not null default '{}';

create index if not exists idx_communication_rules_org
  on public.communication_rules (org_id, enabled);

alter table public.communication_rules enable row level security;

drop policy if exists communication_rules_all on public.communication_rules;
create policy communication_rules_all on public.communication_rules
  for all to authenticated
  using (org_id = public.agx_org_id() and public.agx_is_admin())
  with check (org_id = public.agx_org_id() and public.agx_is_admin());

-- Reload PostgREST schema cache
notify pgrst, 'reload schema';

