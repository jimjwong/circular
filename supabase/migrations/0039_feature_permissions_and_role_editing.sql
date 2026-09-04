-- Feature-level navigation and management permissions, editable per tenant role.

insert into public.access_permissions (key, name, description, category, position) values
  ('dashboard.view', 'View admin dashboard', 'Open the workspace administration dashboard.', 'Workspace', 5),
  ('settings.manage', 'Manage workspace settings', 'Change community identity, discoverability, themes, and branding.', 'Workspace', 15),
  ('spaces.manage', 'Manage spaces', 'Create, organize, configure, archive, and moderate spaces.', 'Community', 35),
  ('events.manage', 'Manage events', 'Create, edit, hide, cancel, and manage event attendees.', 'Events', 55),
  ('communications.manage', 'Manage email and audience', 'Manage audience records, broadcasts, and email communication.', 'Growth', 100),
  ('workflows.manage', 'Manage workflows', 'Create and operate workspace automations.', 'Growth', 110),
  ('agents.manage', 'Manage AI agents', 'Configure AI agents for this workspace.', 'Growth', 120),
  ('website.manage', 'Manage website', 'Create and publish community website pages.', 'Growth', 130),
  ('billing.manage', 'Manage billing and payments', 'Manage offers, payments, subscription, and billing settings.', 'Business', 140),
  ('analytics.view', 'View analytics', 'View workspace, community, course, and event analytics.', 'Business', 150)
on conflict (key) do update set name = excluded.name, description = excluded.description,
  category = excluded.category, position = excluded.position;

-- Admin and the launch-phase Moderator preset receive the complete catalog.
insert into public.tenant_access_role_permissions (tenant_id, role_id, permission_key)
select role.tenant_id, role.id, permission.key
from public.tenant_access_roles role cross join public.access_permissions permission
where role.slug in ('admin', 'moderator')
on conflict do nothing;

insert into public.tenant_access_role_permissions (tenant_id, role_id, permission_key)
select role.tenant_id, role.id, permission.key
from public.tenant_access_roles role
join public.access_permissions permission on permission.key = any(case role.slug
  when 'course-chair' then array['dashboard.view','courses.create','courses.manage_all','courses.manage_assigned','instructors.manage']
  when 'course-instructor' then array['dashboard.view','courses.manage_assigned']
  when 'editor' then array['dashboard.view','content.edit','content.moderate']
  else array[]::text[] end)
where role.slug in ('course-chair','course-instructor','editor')
on conflict do nothing;

create or replace function public.get_my_tenant_permissions(check_tenant_id uuid)
returns table(permission_key text)
language sql stable security definer set search_path = '' as $$
  select permission.key
  from public.access_permissions permission
  where private.has_tenant_permission(check_tenant_id, permission.key)
  order by permission.position, permission.key;
$$;

create or replace function public.update_tenant_access_role(
  check_tenant_id uuid,
  check_role_id uuid,
  role_name text,
  role_description text,
  permission_keys text[]
)
returns void language plpgsql security definer set search_path = '' as $$
declare clean_name text := nullif(trim(role_name), '');
begin
  if not private.has_tenant_permission(check_tenant_id, 'roles.manage') then
    raise exception 'Role management permission is required';
  end if;
  if clean_name is null or length(clean_name) > 80 then raise exception 'Enter a valid role name'; end if;
  if not exists (select 1 from public.tenant_access_roles where id = check_role_id and tenant_id = check_tenant_id) then
    raise exception 'Role not found';
  end if;
  if exists (select 1 from unnest(permission_keys) permission_key where not exists (
    select 1 from public.access_permissions permission where permission.key = permission_key
  )) then raise exception 'Unknown permission'; end if;

  update public.tenant_access_roles set name = clean_name,
    description = nullif(trim(role_description), ''), updated_at = now()
  where id = check_role_id and tenant_id = check_tenant_id;
  delete from public.tenant_access_role_permissions where tenant_id = check_tenant_id and role_id = check_role_id;
  insert into public.tenant_access_role_permissions (tenant_id, role_id, permission_key)
    select check_tenant_id, check_role_id, permission_key from unnest(permission_keys) permission_key;
  perform private.write_audit_log(check_tenant_id, (select auth.uid()), 'role.updated', 'access_role', check_role_id::text,
    jsonb_build_object('name', clean_name, 'permissions', permission_keys));
end;
$$;

grant execute on function public.get_my_tenant_permissions(uuid) to authenticated;
grant execute on function public.update_tenant_access_role(uuid, uuid, text, text, text[]) to authenticated;

-- Make feature-specific permission holders effective at the RLS layer.
create policy "settings managers update tenant" on public.tenants for update to authenticated
  using (private.has_tenant_permission(id, 'settings.manage'))
  with check (private.has_tenant_permission(id, 'settings.manage'));
create policy "event managers insert events" on public.events for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'events.manage'));
create policy "event managers update events" on public.events for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'events.manage'))
  with check (private.has_tenant_permission(tenant_id, 'events.manage'));
create policy "event managers delete events" on public.events for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'events.manage'));
create policy "event managers manage attendees" on public.event_rsvps for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'events.manage'));
create policy "member managers manage memberships" on public.tenant_memberships for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'members.manage'))
  with check (private.has_tenant_permission(tenant_id, 'members.manage'));
create policy "member managers manage invitations" on public.organization_invitations for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'members.manage'))
  with check (private.has_tenant_permission(tenant_id, 'members.manage'));
create policy "access managers read audit log" on public.audit_logs for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'members.manage') or private.has_tenant_permission(tenant_id, 'roles.manage'));

-- The space management RPCs predate configurable roles. Replace only their
-- owner/admin authorization expression with the specific feature permission.
do $$
declare function_record record; original_definition text; updated_definition text;
begin
  for function_record in
    select procedure.oid
    from pg_proc procedure join pg_namespace namespace on namespace.oid = procedure.pronamespace
    where namespace.nspname = 'public' and procedure.proname = any(array[
      'create_space_group','rename_space_group','set_space_group','reorder_spaces',
      'update_space_content_permissions','update_space_layout','update_space_status',
      'update_space_appearance','update_space_membership_mode','set_space_member_access',
      'set_space_moderator','create_space_from_template'
    ])
  loop
    original_definition := pg_get_functiondef(function_record.oid);
    updated_definition := regexp_replace(original_definition,
      'private\.has_tenant_role\(([^,]+), array\[''owner''\s*,\s*''admin''\]::public\.tenant_role\[\]\)',
      'private.has_tenant_permission(\1, ''spaces.manage'')', 'g');
    if updated_definition <> original_definition then execute updated_definition; end if;
  end loop;
end;
$$;

create policy "space managers insert groups" on public.space_groups for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'spaces.manage'));
create policy "space managers update groups" on public.space_groups for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'spaces.manage')) with check (private.has_tenant_permission(tenant_id, 'spaces.manage'));
create policy "space managers delete groups" on public.space_groups for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'spaces.manage'));
create policy "space managers insert spaces" on public.spaces for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'spaces.manage'));
create policy "space managers update spaces" on public.spaces for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'spaces.manage')) with check (private.has_tenant_permission(tenant_id, 'spaces.manage'));
create policy "space managers delete spaces" on public.spaces for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'spaces.manage'));

create or replace function private.can_access_event(check_event_id uuid, check_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.events event
    where event.id = check_event_id and event.tenant_id = check_tenant_id
      and public.is_tenant_member(event.tenant_id)
      and (private.has_tenant_permission(event.tenant_id, 'events.manage')
        or (event.status <> 'draft' and not private.has_tenant_role(event.tenant_id, event.hidden_roles)))
  );
$$;

revoke all on function private.can_access_event(uuid, uuid) from public;
grant execute on function private.can_access_event(uuid, uuid) to authenticated;
