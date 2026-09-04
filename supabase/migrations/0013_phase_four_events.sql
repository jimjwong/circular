-- Phase 4: tenant-safe events, registrations, capacity enforcement, and realtime updates.

create unique index events_id_tenant_idx on public.events (id, tenant_id);

alter table public.events
  add column updated_at timestamptz not null default now(),
  add constraint events_space_tenant_fk
    foreign key (space_id, tenant_id) references public.spaces(id, tenant_id) on delete cascade,
  add constraint events_title_length check (length(trim(title)) between 3 and 160),
  add constraint events_time_order check (ends_at is null or ends_at > starts_at),
  add constraint events_capacity_positive check (capacity is null or capacity > 0),
  add constraint events_location_type_check check (location_type in ('live_room', 'virtual', 'in_person')),
  add constraint events_status_check check (status in ('draft', 'scheduled', 'cancelled', 'completed'));

alter table public.event_rsvps
  add constraint event_rsvps_event_tenant_fk
    foreign key (event_id, tenant_id) references public.events(id, tenant_id) on delete cascade,
  add constraint event_rsvps_status_check check (status in ('going', 'waitlisted'));

create index event_rsvps_tenant_user_idx on public.event_rsvps (tenant_id, user_id);
create index event_rsvps_event_status_idx on public.event_rsvps (event_id, status);

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
  if selected_event.id is null or not public.is_tenant_member(selected_event.tenant_id) then
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

create or replace function private.audit_event_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform private.write_audit_log(
    coalesce(new.tenant_id, old.tenant_id),
    (select auth.uid()),
    case when tg_op = 'INSERT' then 'event.created'
         when tg_op = 'DELETE' then 'event.deleted'
         else 'event.updated' end,
    'event',
    coalesce(new.id, old.id)::text,
    jsonb_build_object('title', coalesce(new.title, old.title), 'status', coalesce(new.status, old.status))
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_event_change
after insert or update or delete on public.events
for each row execute function private.audit_event_change();

alter table public.events replica identity full;
alter table public.event_rsvps replica identity full;

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'events') then
    alter publication supabase_realtime add table public.events;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'event_rsvps') then
    alter publication supabase_realtime add table public.event_rsvps;
  end if;
end $$;

revoke all on function public.toggle_event_registration(uuid) from public;
grant execute on function public.toggle_event_registration(uuid) to authenticated;
