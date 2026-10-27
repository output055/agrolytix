-- =============================================================================
-- Agrolytix · Branch Chat + Automatic Cash Reconciliation
-- -----------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste ALL → Run.
-- The script is idempotent: it is safe to run again after edits.
--
-- Identity model
--   Users do NOT live in Supabase Auth. The `agx-chat` Edge Function validates
--   the user's Laravel (Sanctum) token against the Agrolytix API and mints a
--   short-lived Supabase JWT with these custom claims:
--     agx_uid       Laravel user id
--     org_id        HQ business id (parent_id ?? business id) → tenant boundary
--     business_id   the user's own business / branch id
--     business_name, name, app_role ('Admin' | 'Worker' | ...)
--     is_hq         user belongs to the headquarters business
--     is_hq_admin   Admin of the headquarters business
--   Every RLS policy below is driven by those claims.
--
-- Room keys (text)
--   general               → one shared group per organisation (HQ + all branches)
--   recon:<business_id>   → private cash-reconciliation thread of one branch
--                           (that branch's users + HQ admins)
--   dm:<a>:<b>            → private branch-to-branch DM, a < b (business ids)
-- =============================================================================

create extension if not exists pgcrypto;

-- ─── Claim helpers ───────────────────────────────────────────────────────────
create or replace function public.agx_claim(p_name text)
returns text
language sql stable
set search_path = public
as $$
  select nullif(coalesce(auth.jwt() ->> p_name, ''), '')
$$;

create or replace function public.agx_org_id()      returns bigint  language sql stable set search_path = public as $$ select public.agx_claim('org_id')::bigint $$;
create or replace function public.agx_business_id() returns bigint  language sql stable set search_path = public as $$ select public.agx_claim('business_id')::bigint $$;
create or replace function public.agx_user_id()     returns bigint  language sql stable set search_path = public as $$ select public.agx_claim('agx_uid')::bigint $$;
create or replace function public.agx_is_hq_admin() returns boolean language sql stable set search_path = public as $$ select coalesce(public.agx_claim('is_hq_admin')::boolean, false) $$;
create or replace function public.agx_is_admin()    returns boolean language sql stable set search_path = public as $$ select coalesce(public.agx_claim('app_role'), '') = 'Admin' $$;

-- Can the current JWT read/write messages in this room?
create or replace function public.agx_can_access_room(p_org bigint, p_room text)
returns boolean
language plpgsql stable
set search_path = public
as $$
declare
  v_org   bigint := public.agx_org_id();
  v_biz   bigint := public.agx_business_id();
  v_parts text[];
begin
  if v_org is null or p_org is distinct from v_org then
    return false;
  end if;

  if p_room = 'general' then
    return true;
  end if;

  v_parts := string_to_array(p_room, ':');

  if v_parts[1] = 'recon' then
    return public.agx_is_hq_admin() or v_parts[2]::bigint = v_biz;
  elsif v_parts[1] = 'dm' then
    return v_parts[2]::bigint = v_biz or v_parts[3]::bigint = v_biz;
  end if;

  return false;
end
$$;

-- ─── Tables ──────────────────────────────────────────────────────────────────

-- Directory of businesses in an organisation (used for DM list + HQ status board).
-- Maintained by the Edge Function (service role) whenever users open the chat.
create table if not exists public.chat_businesses (
  business_id bigint primary key,
  org_id      bigint      not null,
  name        text        not null,
  is_hq       boolean     not null default false,
  updated_at  timestamptz not null default now()
);
create index if not exists chat_businesses_org_idx on public.chat_businesses (org_id);

create table if not exists public.chat_messages (
  id                   uuid primary key default gen_random_uuid(),
  org_id               bigint not null,
  room                 text   not null
                         check (room ~ '^(general|recon:[0-9]+|dm:[0-9]+:[0-9]+)$'),
  sender_user_id       bigint,                 -- null = system / auditor bot
  sender_name          text   not null,
  sender_business_id   bigint,
  sender_business_name text,
  sender_role          text,
  kind                 text   not null
                         check (kind in ('text', 'image', 'cash_declaration', 'recon_result', 'recon_status', 'system')),
  body                 text   check (body is null or char_length(body) <= 4000),
  image_url            text   check (image_url is null or image_url like 'https://res.cloudinary.com/%'),
  meta                 jsonb  not null default '{}'::jsonb,
  created_at           timestamptz not null default now(),
  constraint chat_messages_text_has_body  check (kind <> 'text'  or (body is not null and char_length(btrim(body)) > 0)),
  constraint chat_messages_image_has_url  check (kind <> 'image' or image_url is not null)
);
create index if not exists chat_messages_room_idx on public.chat_messages (org_id, room, created_at desc);
create index if not exists chat_messages_recent_idx on public.chat_messages (created_at desc);

create table if not exists public.cash_declarations (
  id                  uuid primary key default gen_random_uuid(),
  org_id              bigint        not null,
  business_id         bigint        not null,
  business_name       text,
  user_id             bigint        not null,
  user_name           text,
  business_date       date          not null,
  declared            numeric(14,2) not null check (declared >= 0),
  expected            numeric(14,2) not null,
  retail_revenue      numeric(14,2) not null default 0,
  wholesale_collected numeric(14,2) not null default 0,
  expenses            numeric(14,2) not null default 0,
  difference          numeric(14,2) not null,
  tolerance           numeric(14,2) not null default 1,
  status              text          not null check (status in ('balanced', 'short', 'over')),
  attempt             int           not null default 1,
  source              text          not null default 'sales',   -- 'sales' | 'today_stats' (fallback)
  note                text          check (note is null or char_length(note) <= 500),
  image_url           text,
  created_at          timestamptz   not null default now()
);
create index if not exists cash_declarations_day_idx on public.cash_declarations (org_id, business_date, business_id, created_at desc);

create table if not exists public.chat_reads (
  user_id      bigint      not null,
  room         text        not null,
  org_id       bigint      not null,
  last_read_at timestamptz not null default now(),
  primary key (user_id, room)
);

-- ─── Trigger: stamp sender identity from the verified JWT ────────────────────
-- Clients can never spoof who they are: for non-service-role inserts every
-- identity column is overwritten with values from the JWT claims.
create or replace function public.agx_chat_messages_before_insert()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_parts text[];
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    new.id                   := gen_random_uuid();
    new.org_id               := public.agx_org_id();
    new.sender_user_id       := public.agx_user_id();
    new.sender_name          := coalesce(public.agx_claim('name'), 'User');
    new.sender_business_id   := public.agx_business_id();
    new.sender_business_name := public.agx_claim('business_name');
    new.sender_role          := public.agx_claim('app_role');
    new.meta                 := '{}'::jsonb;
    new.created_at           := now();
  end if;

  if new.room like 'dm:%' then
    v_parts := string_to_array(new.room, ':');
    if v_parts[2]::bigint >= v_parts[3]::bigint then
      raise exception 'Invalid DM room key %, expected dm:<lower_id>:<higher_id>', new.room;
    end if;
  end if;

  return new;
end
$$;

drop trigger if exists chat_messages_before_insert on public.chat_messages;
create trigger chat_messages_before_insert
  before insert on public.chat_messages
  for each row execute function public.agx_chat_messages_before_insert();

-- ─── Row Level Security ──────────────────────────────────────────────────────
alter table public.chat_businesses   enable row level security;
alter table public.chat_messages     enable row level security;
alter table public.cash_declarations enable row level security;
alter table public.chat_reads        enable row level security;

-- chat_businesses: anyone in the org can see the directory
drop policy if exists chat_businesses_select on public.chat_businesses;
create policy chat_businesses_select on public.chat_businesses
  for select to authenticated
  using (org_id = public.agx_org_id());

-- chat_messages: read rooms you belong to
drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
  for select to authenticated
  using (public.agx_can_access_room(org_id, room));

-- chat_messages: users may only post plain text / images into rooms they belong to.
-- Declarations and auditor replies are written exclusively by the Edge Function.
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert to authenticated
  with check (
    kind in ('text', 'image')
    and public.agx_can_access_room(org_id, room)
  );

-- cash_declarations (full expected/revenue/expense breakdown):
-- HQ admins see every branch; a branch Admin sees their own branch only.
drop policy if exists cash_declarations_select on public.cash_declarations;
create policy cash_declarations_select on public.cash_declarations
  for select to authenticated
  using (
    org_id = public.agx_org_id()
    and (
      public.agx_is_hq_admin()
      or (public.agx_is_admin() and business_id = public.agx_business_id())
    )
  );

-- chat_reads: each user manages their own read markers
drop policy if exists chat_reads_select on public.chat_reads;
create policy chat_reads_select on public.chat_reads
  for select to authenticated
  using (user_id = public.agx_user_id());

drop policy if exists chat_reads_insert on public.chat_reads;
create policy chat_reads_insert on public.chat_reads
  for insert to authenticated
  with check (user_id = public.agx_user_id() and org_id = public.agx_org_id());

drop policy if exists chat_reads_update on public.chat_reads;
create policy chat_reads_update on public.chat_reads
  for update to authenticated
  using (user_id = public.agx_user_id())
  with check (user_id = public.agx_user_id() and org_id = public.agx_org_id());

-- ─── Grants (anon gets nothing) ──────────────────────────────────────────────
revoke all on public.chat_businesses, public.chat_messages, public.cash_declarations, public.chat_reads from anon;
grant select                 on public.chat_businesses   to authenticated;
grant select, insert         on public.chat_messages     to authenticated;
grant select                 on public.cash_declarations to authenticated;
grant select, insert, update on public.chat_reads        to authenticated;

-- ─── Unread counters ─────────────────────────────────────────────────────────
-- SECURITY INVOKER → RLS on chat_messages still applies, so users only count
-- messages in rooms they can read. Public `recon_status` pills are excluded
-- (they appear in the chat but are not notifications).
create or replace function public.agx_unread_counts()
returns table (room text, unread bigint, last_at timestamptz)
language sql stable
security invoker
set search_path = public
as $$
  select m.room,
         count(*) filter (
           where m.created_at > coalesce(r.last_read_at, '-infinity'::timestamptz)
             and m.sender_user_id is distinct from public.agx_user_id()
             and m.kind <> 'recon_status'
         ) as unread,
         max(m.created_at) as last_at
  from public.chat_messages m
  left join public.chat_reads r
         on r.room = m.room
        and r.user_id = public.agx_user_id()
  where m.created_at > now() - interval '60 days'
  group by m.room
$$;

revoke all on function public.agx_unread_counts() from anon;
grant execute on function public.agx_unread_counts() to authenticated;

-- ─── Realtime ────────────────────────────────────────────────────────────────
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'chat_messages'
  ) then
    alter publication supabase_realtime add table public.chat_messages;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'cash_declarations'
  ) then
    alter publication supabase_realtime add table public.cash_declarations;
  end if;
end
$$;

alter table public.chat_messages     replica identity full;
alter table public.cash_declarations replica identity full;

-- =============================================================================
-- Done. Quick sanity check (should list 4 tables with rowsecurity = true):
--   select tablename, rowsecurity from pg_tables
--   where schemaname = 'public' and tablename like any (array['chat_%','cash_%']);
-- =============================================================================
