-- =============================================================================
-- Agrolytix · Stock Arrival Intake Feature (Batch Multi-Item Delivery Intake)
-- -----------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste ALL → Run.
-- =============================================================================

-- 1. Relax or update the kind check constraint on chat_messages to include 'stock_intake'
alter table public.chat_messages drop constraint if exists chat_messages_kind_check;
alter table public.chat_messages add constraint chat_messages_kind_check
  check (kind in ('text', 'image', 'cash_declaration', 'recon_result', 'recon_status', 'system', 'stock_intake'));

-- 2. Update agx_chat_messages_before_insert to preserve stock_intake metadata
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

    -- Preserve metadata: reply_to or stock_intake or cash_declaration
    if new.meta is not null then
      if new.meta ? 'reply_to_id' then
        new.meta := jsonb_build_object(
          'reply_to_id',     new.meta->>'reply_to_id',
          'reply_to_sender', new.meta->>'reply_to_sender',
          'reply_to_body',   left(coalesce(new.meta->>'reply_to_body', ''), 200)
        );
      -- Otherwise keep new.meta as passed by client for stock_intake / other kinds
      end if;
    else
      new.meta := '{}'::jsonb;
    end if;

    new.created_at := now();
  end if;

  if new.room like 'dm:%' then
    v_parts := string_to_array(new.room, ':');
    if v_parts[2]::bigint >= v_parts[3]::bigint then
      raise exception 'Invalid DM room key %, expected dm:<lower_id>:<higher_id>', new.room;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists chat_messages_before_insert on public.chat_messages;
create trigger chat_messages_before_insert
  before insert on public.chat_messages
  for each row execute function public.agx_chat_messages_before_insert();

-- 3. Update agx_chat_messages_before_update to allow Admin approval/rejection of stock_intake
create or replace function public.agx_chat_messages_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    -- Case A: Message edit (not a delete, not a stock intake approval)
    if coalesce(new.is_deleted, false) is false and coalesce(old.is_deleted, false) is false and old.kind <> 'stock_intake' then
      -- Enforce 5-minute edit window from original created_at
      if old.created_at < now() - interval '5 minutes' then
        raise exception 'Messages can only be edited within 5 minutes of sending';
      end if;

      -- Only original sender can edit
      if old.sender_user_id <> public.agx_user_id() then
        raise exception 'You can only edit your own messages';
      end if;

      if old.kind <> 'text' then
        raise exception 'Only text messages can be edited';
      end if;

      new.is_edited := true;
      new.edited_at := now();
    end if;

    -- Case B: Message deletion (leaving a watermark)
    if new.is_deleted is true and coalesce(old.is_deleted, false) is false then
      -- Only original sender can delete their message
      if old.sender_user_id <> public.agx_user_id() then
        raise exception 'You can only delete your own messages';
      end if;

      new.is_deleted := true;
      new.deleted_at := coalesce(new.deleted_at, now());
      new.deleted_by_name := coalesce(public.agx_claim('name'), new.deleted_by_name, 'User');
      new.image_url := null;
      new.body := coalesce(new.body, '[This message was deleted]');
    end if;

    -- Case C: Stock intake approval or rejection by Admin
    if old.kind = 'stock_intake' then
      if not public.agx_is_admin() then
        raise exception 'Only administrators can approve or reject stock intake reports';
      end if;
      -- Retain all immutable audit columns
      new.sender_user_id := old.sender_user_id;
      new.sender_name := old.sender_name;
      new.created_at := old.created_at;
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists chat_messages_before_update on public.chat_messages;
create trigger chat_messages_before_update
  before update on public.chat_messages
  for each row execute function public.agx_chat_messages_before_update();

-- 4. Update RLS policy to allow Admins to update stock_intake messages (approval/rejection)
drop policy if exists chat_messages_update on public.chat_messages;
create policy chat_messages_update on public.chat_messages
  for update to authenticated
  using (
    public.agx_can_access_room(org_id, room)
    and (
      sender_user_id = public.agx_user_id()
      or (kind = 'stock_intake' and public.agx_is_admin())
    )
  )
  with check (
    public.agx_can_access_room(org_id, room)
  );

-- Refresh schema cache for PostgREST
notify pgrst, 'reload schema';
