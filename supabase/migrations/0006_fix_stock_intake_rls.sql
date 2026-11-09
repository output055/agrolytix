-- =============================================================================
-- Agrolytix · Fix Stock Intake RLS Insert Policy
-- -----------------------------------------------------------------------------
-- HOW TO RUN: Supabase Dashboard → SQL Editor → New query → paste ALL → Run.
-- =============================================================================

-- Allow authenticated users to insert 'stock_intake' messages in rooms they can access
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert to authenticated
  with check (
    kind in ('text', 'image', 'stock_intake')
    and public.agx_can_access_room(org_id, room)
  );

-- Refresh PostgREST schema cache
notify pgrst, 'reload schema';

