-- =============================================================================
-- Agrolytix · Edit & Delete Message Support with Watermark & 5-minute Edit Window
-- -----------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste ALL → Run.
-- =============================================================================

-- 1. Add edit and soft-delete watermark columns to chat_messages
alter table public.chat_messages
  add column if not exists is_edited boolean not null default false,
  add column if not exists edited_at timestamptz,
  add column if not exists is_deleted boolean not null default false,
  add column if not exists deleted_by_name text,
  add column if not exists deleted_at timestamptz;

-- 2. Relax check constraints so soft-deleted messages do not trigger constraint violations
alter table public.chat_messages drop constraint if exists chat_messages_text_has_body;
alter table public.chat_messages add constraint chat_messages_text_has_body
  check (is_deleted is true or kind <> 'text' or (body is not null and char_length(btrim(body)) > 0));

alter table public.chat_messages drop constraint if exists chat_messages_image_has_url;
alter table public.chat_messages add constraint chat_messages_image_has_url
  check (is_deleted is true or kind <> 'image' or image_url is not null);

-- 3. Trigger function to enforce the 5-minute edit rule and watermark on deletion
create or replace function public.agx_chat_messages_before_update()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    -- Case A: Message edit (not a delete)
    if coalesce(new.is_deleted, false) is false and coalesce(old.is_deleted, false) is false then
      -- Enforce 5-minute edit window from original created_at
      if old.created_at < now() - interval '5 minutes' then
        raise exception 'Messages can only be edited within 5 minutes of sending';
      end if;

      -- Only original sender can edit
      if old.sender_user_id <> public.agx_user_id() then
        raise exception 'You can only edit your own messages';
      end if;

      -- Prevent editing non-text messages (e.g. cash declarations or recon results)
      if old.kind <> 'text' then
        raise exception 'Only text messages can be edited';
      end if;

      new.is_edited := true;
      new.edited_at := now();
    end if;

    -- Case B: Message deletion (leaving a watermark)
    if new.is_deleted is true and coalesce(old.is_deleted, false) is false then
      -- Only the original sender can delete their message
      if old.sender_user_id <> public.agx_user_id() then
        raise exception 'You can only delete your own messages';
      end if;

      new.is_deleted := true;
      new.deleted_at := coalesce(new.deleted_at, now());
      new.deleted_by_name := coalesce(public.agx_claim('name'), new.deleted_by_name, 'User');
      -- Clear image and keep placeholder body
      new.image_url := null;
      new.body := coalesce(new.body, '[This message was deleted]');
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists chat_messages_before_update on public.chat_messages;
create trigger chat_messages_before_update
  before update on public.chat_messages
  for each row execute function public.agx_chat_messages_before_update();

-- 4. Row Level Security policy for UPDATE
drop policy if exists chat_messages_update on public.chat_messages;
create policy chat_messages_update on public.chat_messages
  for update to authenticated
  using (
    public.agx_can_access_room(org_id, room)
    and sender_user_id = public.agx_user_id()
  )
  with check (
    public.agx_can_access_room(org_id, room)
  );

-- 5. Grant UPDATE permissions to authenticated users
grant update on public.chat_messages to authenticated;

-- 6. Helper function to check if cash has already been declared for a business date
create or replace function public.agx_is_cash_declared(p_business_id bigint, p_date date)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  return exists (
    select 1 from public.cash_declarations
    where business_id = p_business_id
      and business_date = p_date
      and org_id = public.agx_org_id()
  );
end;
$$;

revoke all on function public.agx_is_cash_declared(bigint, date) from anon;
grant execute on function public.agx_is_cash_declared(bigint, date) to authenticated;

-- 7. Database trigger enforcing STRICTLY ONE declaration per business date
create or replace function public.agx_cash_declarations_before_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if exists (
    select 1 from public.cash_declarations
    where business_id = new.business_id
      and business_date = new.business_date
  ) then
    raise exception 'Cash has already been declared for this branch on %', new.business_date;
  end if;
  return new;
end;
$$;

drop trigger if exists cash_declarations_before_insert on public.cash_declarations;
create trigger cash_declarations_before_insert
  before insert on public.cash_declarations
  for each row execute function public.agx_cash_declarations_before_insert();

-- 8. Allow admins to delete cash declarations and clean up associated recon messages
create or replace function public.agx_delete_cash_declaration(p_declaration_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_decl public.cash_declarations%rowtype;
  v_admin_name text := coalesce(public.agx_claim('name'), 'Admin');
begin
  if not (public.agx_is_hq_admin() or public.agx_is_admin()) then
    raise exception 'Only administrators can delete cash declarations';
  end if;

  select * into v_decl from public.cash_declarations
  where id = p_declaration_id and org_id = public.agx_org_id();

  if not found then
    raise exception 'Cash declaration not found';
  end if;

  if not public.agx_is_hq_admin() and v_decl.business_id <> public.agx_business_id() then
    raise exception 'Cannot delete cash declaration for another branch';
  end if;

  -- 1. Mark chat_messages as deleted with watermark
  update public.chat_messages
  set is_deleted = true,
      deleted_at = now(),
      deleted_by_name = v_admin_name,
      body = '[Cash declaration deleted by ' || v_admin_name || ']'
  where (meta->>'declaration_id')::uuid = p_declaration_id
     or id = p_declaration_id;

  -- 2. Delete from cash_declarations so the date is freed up!
  delete from public.cash_declarations where id = p_declaration_id;
end;
$$;

revoke all on function public.agx_delete_cash_declaration(uuid) from anon;
grant execute on function public.agx_delete_cash_declaration(uuid) to authenticated;

-- Allow authenticated admins to delete from cash_declarations
grant delete on public.cash_declarations to authenticated;
drop policy if exists cash_declarations_delete on public.cash_declarations;
create policy cash_declarations_delete on public.cash_declarations
  for delete to authenticated
  using (
    org_id = public.agx_org_id()
    and (
      public.agx_is_hq_admin()
      or (public.agx_is_admin() and business_id = public.agx_business_id())
    )
  );

-- 9. Update agx_chat_messages_before_insert to preserve user reply metadata
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

    -- Preserve reply_to metadata if provided by the client
    if new.meta is not null and new.meta ? 'reply_to_id' then
      new.meta               := jsonb_build_object(
        'reply_to_id',     new.meta->>'reply_to_id',
        'reply_to_sender', new.meta->>'reply_to_sender',
        'reply_to_body',   left(coalesce(new.meta->>'reply_to_body', ''), 200)
      );
    else
      new.meta               := '{}'::jsonb;
    end if;

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

-- Refresh schema cache for PostgREST
notify pgrst, 'reload schema';
