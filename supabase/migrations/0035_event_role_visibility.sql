-- Role-targeted event visibility. Owners and admins always retain management access.

alter table public.events
  add column if not exists hidden_roles public.tenant_role[] not null default '{}'::public.tenant_role[];

alter table public.events drop constraint if exists events_hidden_roles_check;
alter table public.events add constraint events_hidden_roles_check
  check (hidden_roles <@ array['moderator', 'member']::public.tenant_role[]);

create or replace function private.can_access_event(check_event_id uuid, check_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.events event
    where event.id = check_event_id
      and event.tenant_id = check_tenant_id
      and public.is_tenant_member(event.tenant_id)
      and (
        private.has_tenant_role(event.tenant_id, array['owner', 'admin']::public.tenant_role[])
        or (
          event.status <> 'draft'
          and not private.has_tenant_role(event.tenant_id, event.hidden_roles)
        )
      )
  );
$$;

drop policy if exists "members read published events" on public.events;
create policy "members read visible events"
on public.events for select to authenticated
using (private.can_access_event(id, tenant_id));

create or replace function public.toggle_event_registration(check_event_id uuid)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  selected_event public.events%rowtype;
  registration_count integer;
begin
  select * into selected_event from public.events where id = check_event_id for update;
  if selected_event.id is null or not private.can_access_event(selected_event.id, selected_event.tenant_id) then
    raise exception 'Event access is required';
  end if;
  if selected_event.status <> 'scheduled' or selected_event.starts_at <= now() then
    raise exception 'Registration is closed for this event';
  end if;

  if exists (
    select 1 from public.event_rsvps
    where event_id = check_event_id and user_id = caller_id and status = 'going'
  ) then
    delete from public.event_rsvps where event_id = check_event_id and user_id = caller_id;
    return false;
  end if;

  select count(*) into registration_count
  from public.event_rsvps where event_id = check_event_id and status = 'going';
  if selected_event.capacity is not null and registration_count >= selected_event.capacity then
    raise exception 'This event has reached capacity';
  end if;

  insert into public.event_rsvps (event_id, tenant_id, user_id, status)
  values (check_event_id, selected_event.tenant_id, caller_id, 'going')
  on conflict (event_id, user_id) do update set status = 'going', created_at = now();
  return true;
end;
$$;

revoke all on function private.can_access_event(uuid, uuid) from public;
grant execute on function private.can_access_event(uuid, uuid) to authenticated;
