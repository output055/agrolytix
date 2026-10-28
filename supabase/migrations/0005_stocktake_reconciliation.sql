-- =============================================================================
-- Agrolytix · Smart Stocktake (Inventory Audit & Salary Deduction Reconciliation)
-- -----------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste ALL → Run.
-- =============================================================================

create table if not exists public.stocktake_sessions (
  id                    uuid primary key default gen_random_uuid(),
  org_id                bigint not null,
  business_id           bigint not null,
  business_name         text,
  inventory_type        text not null check (inventory_type in ('retail', 'wholesale')),
  status                text not null default 'draft' check (status in ('draft', 'completed', 'cancelled')),
  title                 text not null,
  counted_by_id         bigint,
  counted_by_name       text not null,
  total_products        integer not null default 0,
  counted_products      integer not null default 0,
  balanced_count        integer not null default 0,
  shortage_count        integer not null default 0,
  overage_count         integer not null default 0,
  total_cost_variance   numeric not null default 0,
  total_sell_variance   numeric not null default 0,
  gross_shortage_value  numeric not null default 0,
  gross_overage_value   numeric not null default 0,
  offset_amount         numeric not null default 0,
  deduction_amount      numeric not null default 0,
  deduction_responsible text,
  deduction_notes       text,
  notes                 text,
  started_at            timestamptz not null default now(),
  completed_at          timestamptz,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists stocktake_sessions_org_biz_idx
  on public.stocktake_sessions (org_id, business_id, created_at desc);

create table if not exists public.stocktake_items (
  id                    uuid primary key default gen_random_uuid(),
  session_id           uuid not null references public.stocktake_sessions(id) on delete cascade,
  product_id            bigint not null,
  product_name          text not null,
  category              text,
  base_unit             text not null default 'unit',
  cost_price            numeric not null default 0,
  sell_price            numeric not null default 0,
  system_quantity       numeric not null default 0,
  physical_quantity     numeric,
  variance              numeric not null default 0,
  cost_variance         numeric not null default 0,
  sell_variance         numeric not null default 0,
  status                text not null default 'uncounted' check (status in ('uncounted', 'balanced', 'shortage', 'overage')),
  discrepancy_reason    text check (discrepancy_reason is null or discrepancy_reason in ('breakage', 'expired', 'theft', 'miscount', 'unrecorded_sale', 'swapped_product', 'other')),
  offset_status         text not null default 'none' check (offset_status in ('none', 'offset_with_overage', 'waived', 'deducted')),
  offset_notes          text,
  notes                 text,
  unit_breakdown        jsonb,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create index if not exists stocktake_items_session_idx
  on public.stocktake_items (session_id);

create index if not exists stocktake_items_prod_idx
  on public.stocktake_items (session_id, product_id);

-- ─── Automatic updated_at Trigger ───────────────────────────────────────────
create or replace function public.agx_stocktake_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists stocktake_sessions_updated_at on public.stocktake_sessions;
create trigger stocktake_sessions_updated_at
  before update on public.stocktake_sessions
  for each row execute function public.agx_stocktake_set_updated_at();

drop trigger if exists stocktake_items_updated_at on public.stocktake_items;
create trigger stocktake_items_updated_at
  before update on public.stocktake_items
  for each row execute function public.agx_stocktake_set_updated_at();

-- ─── Row Level Security ─────────────────────────────────────────────────────
alter table public.stocktake_sessions enable row level security;
alter table public.stocktake_items enable row level security;

-- Sessions policies
drop policy if exists stocktake_sessions_select on public.stocktake_sessions;
create policy stocktake_sessions_select on public.stocktake_sessions
  for select to authenticated
  using (
    org_id = public.agx_org_id()
    and (public.agx_is_admin() or business_id = public.agx_business_id())
  );

drop policy if exists stocktake_sessions_insert on public.stocktake_sessions;
create policy stocktake_sessions_insert on public.stocktake_sessions
  for insert to authenticated
  with check (
    org_id = public.agx_org_id()
    and public.agx_is_admin()
  );

drop policy if exists stocktake_sessions_update on public.stocktake_sessions;
create policy stocktake_sessions_update on public.stocktake_sessions
  for update to authenticated
  using (
    org_id = public.agx_org_id()
    and public.agx_is_admin()
  )
  with check (
    org_id = public.agx_org_id()
    and public.agx_is_admin()
  );

drop policy if exists stocktake_sessions_delete on public.stocktake_sessions;
create policy stocktake_sessions_delete on public.stocktake_sessions
  for delete to authenticated
  using (
    org_id = public.agx_org_id()
    and public.agx_is_admin()
  );

-- Items policies
drop policy if exists stocktake_items_select on public.stocktake_items;
create policy stocktake_items_select on public.stocktake_items
  for select to authenticated
  using (
    exists (
      select 1 from public.stocktake_sessions s
      where s.id = stocktake_items.session_id
        and s.org_id = public.agx_org_id()
        and (public.agx_is_admin() or s.business_id = public.agx_business_id())
    )
  );

drop policy if exists stocktake_items_insert on public.stocktake_items;
create policy stocktake_items_insert on public.stocktake_items
  for insert to authenticated
  with check (
    exists (
      select 1 from public.stocktake_sessions s
      where s.id = stocktake_items.session_id
        and s.org_id = public.agx_org_id()
        and public.agx_is_admin()
    )
  );

drop policy if exists stocktake_items_update on public.stocktake_items;
create policy stocktake_items_update on public.stocktake_items
  for update to authenticated
  using (
    exists (
      select 1 from public.stocktake_sessions s
      where s.id = stocktake_items.session_id
        and s.org_id = public.agx_org_id()
        and public.agx_is_admin()
    )
  )
  with check (
    exists (
      select 1 from public.stocktake_sessions s
      where s.id = stocktake_items.session_id
        and s.org_id = public.agx_org_id()
        and public.agx_is_admin()
    )
  );

drop policy if exists stocktake_items_delete on public.stocktake_items;
create policy stocktake_items_delete on public.stocktake_items
  for delete to authenticated
  using (
    exists (
      select 1 from public.stocktake_sessions s
      where s.id = stocktake_items.session_id
        and s.org_id = public.agx_org_id()
        and public.agx_is_admin()
    )
  );

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';
