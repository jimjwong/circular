-- Configurable tenant roles plus independent Guest / AM / PM membership access.

alter table public.tenant_memberships
  add column if not exists membership_tier text not null default 'associate';
alter table public.tenant_memberships drop constraint if exists tenant_memberships_membership_tier_check;
alter table public.tenant_memberships add constraint tenant_memberships_membership_tier_check
  check (membership_tier in ('guest', 'associate', 'professional'));

create table if not exists public.access_permissions (
  key text primary key,
  name text not null,
  description text not null,
  category text not null,
  position integer not null default 0
);

insert into public.access_permissions (key, name, description, category, position) values
  ('workspace.full_access', 'Full workspace access', 'Manage every tenant feature except ownership transfer.', 'Workspace', 10),
  ('members.manage', 'Manage members', 'Invite, suspend, remove, and update members.', 'Workspace', 20),
  ('roles.manage', 'Manage roles', 'Create roles and assign role permissions.', 'Workspace', 30),
  ('content.moderate', 'Moderate content', 'Moderate posts, comments, and community activity.', 'Community', 40),
  ('content.edit', 'Edit content', 'Create and edit tenant-managed content.', 'Community', 50),
  ('courses.create', 'Create courses', 'Create new courses for the organization.', 'Courses', 60),
  ('courses.manage_all', 'Manage all courses', 'Edit and manage every course in the organization.', 'Courses', 70),
  ('courses.manage_assigned', 'Manage assigned courses', 'Edit courses assigned to this user as an instructor.', 'Courses', 80),
  ('instructors.manage', 'Manage instructors', 'Assign and remove course instructors.', 'Courses', 90)
on conflict (key) do update set name = excluded.name, description = excluded.description,
  category = excluded.category, position = excluded.position;

create table if not exists public.tenant_access_roles (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  slug text not null,
  description text,
  is_system boolean not null default false,
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug),
  unique (id, tenant_id)
);

create table if not exists public.tenant_access_role_permissions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  role_id uuid not null,
  permission_key text not null references public.access_permissions(key) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (role_id, permission_key),
  foreign key (role_id, tenant_id) references public.tenant_access_roles(id, tenant_id) on delete cascade
);

create table if not exists public.tenant_member_access_roles (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null,
  role_id uuid not null,
  assigned_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (tenant_id, user_id, role_id),
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id) on delete cascade,
  foreign key (role_id, tenant_id) references public.tenant_access_roles(id, tenant_id) on delete cascade
);

create or replace function private.seed_tenant_access_roles(check_tenant_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare role_record record;
begin
  insert into public.tenant_access_roles (tenant_id, name, slug, description, is_system)
  values
    (check_tenant_id, 'Admin', 'admin', 'Full tenant administration.', true),
    (check_tenant_id, 'Moderator', 'moderator', 'Full tenant access for the current launch phase.', true),
    (check_tenant_id, 'Course Chair', 'course-chair', 'Creates courses and manages instructors.', true),
    (check_tenant_id, 'Course Instructor', 'course-instructor', 'Manages courses assigned to them.', true),
    (check_tenant_id, 'Editor', 'editor', 'Creates and moderates community content.', true)
  on conflict (tenant_id, slug) do nothing;

  for role_record in select id, slug from public.tenant_access_roles where tenant_id = check_tenant_id loop
    if role_record.slug in ('admin', 'moderator') then
      insert into public.tenant_access_role_permissions (tenant_id, role_id, permission_key)
        select check_tenant_id, role_record.id, key from public.access_permissions on conflict do nothing;
    elsif role_record.slug = 'course-chair' then
      insert into public.tenant_access_role_permissions (tenant_id, role_id, permission_key)
        select check_tenant_id, role_record.id, key from public.access_permissions
        where key in ('courses.create','courses.manage_all','courses.manage_assigned','instructors.manage') on conflict do nothing;
    elsif role_record.slug = 'course-instructor' then
      insert into public.tenant_access_role_permissions (tenant_id, role_id, permission_key)
        values (check_tenant_id, role_record.id, 'courses.manage_assigned') on conflict do nothing;
    elsif role_record.slug = 'editor' then
      insert into public.tenant_access_role_permissions (tenant_id, role_id, permission_key)
        values (check_tenant_id, role_record.id, 'content.edit'), (check_tenant_id, role_record.id, 'content.moderate') on conflict do nothing;
    end if;
  end loop;
end;
$$;

select private.seed_tenant_access_roles(id) from public.tenants;

insert into public.tenant_member_access_roles (tenant_id, user_id, role_id, assigned_by)
select tm.tenant_id, tm.user_id, tar.id, tm.user_id
from public.tenant_memberships tm
join public.tenant_access_roles tar on tar.tenant_id = tm.tenant_id and tar.slug = tm.role::text
where tm.role in ('admin','moderator')
on conflict do nothing;

create or replace function private.has_tenant_permission(check_tenant_id uuid, check_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = check_tenant_id and tm.user_id = (select auth.uid()) and tm.status = 'active'
      and (
        tm.role in ('owner','admin')
        or exists (
          select 1 from public.tenant_member_access_roles tmar
          join public.tenant_access_role_permissions tarp on tarp.tenant_id = tmar.tenant_id and tarp.role_id = tmar.role_id
          where tmar.tenant_id = tm.tenant_id and tmar.user_id = tm.user_id
            and tarp.permission_key in (check_permission, 'workspace.full_access')
        )
      )
  );
$$;

create or replace function public.has_tenant_permission(check_tenant_id uuid, check_permission text)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_tenant_permission(check_tenant_id, check_permission);
$$;

create or replace function public.can_manage_tenant(check_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_tenant_permission(check_tenant_id, 'workspace.full_access');
$$;

alter table public.access_permissions enable row level security;
alter table public.tenant_access_roles enable row level security;
alter table public.tenant_access_role_permissions enable row level security;
alter table public.tenant_member_access_roles enable row level security;

create policy "authenticated read permission catalog" on public.access_permissions for select to authenticated using (true);
create policy "members read tenant access roles" on public.tenant_access_roles for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "access managers manage tenant roles" on public.tenant_access_roles for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'roles.manage')) with check (private.has_tenant_permission(tenant_id, 'roles.manage'));
create policy "members read tenant role permissions" on public.tenant_access_role_permissions for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "access managers manage role permissions" on public.tenant_access_role_permissions for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'roles.manage')) with check (private.has_tenant_permission(tenant_id, 'roles.manage'));
create policy "members read member role assignments" on public.tenant_member_access_roles for select to authenticated using (public.is_tenant_member(tenant_id));
create policy "access managers manage member role assignments" on public.tenant_member_access_roles for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'members.manage')) with check (private.has_tenant_permission(tenant_id, 'members.manage'));

grant select on public.access_permissions, public.tenant_access_roles, public.tenant_access_role_permissions, public.tenant_member_access_roles to authenticated;
grant insert, update, delete on public.tenant_access_roles, public.tenant_access_role_permissions, public.tenant_member_access_roles to authenticated;
grant execute on function public.has_tenant_permission(uuid, text) to authenticated;

create or replace function public.set_member_access(check_tenant_id uuid, target_user_id uuid, next_tier text, role_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_tenant_permission(check_tenant_id, 'members.manage') then
    raise exception 'Member management permission is required';
  end if;
  if next_tier not in ('guest','associate','professional') then raise exception 'Invalid membership access level'; end if;
  if exists (select 1 from public.tenant_memberships where tenant_id = check_tenant_id and user_id = target_user_id and role = 'owner') then
    raise exception 'The owner access level cannot be changed here';
  end if;
  if exists (select 1 from unnest(role_ids) role_id where not exists (
    select 1 from public.tenant_access_roles tar where tar.id = role_id and tar.tenant_id = check_tenant_id
  )) then raise exception 'One or more roles do not belong to this organization'; end if;

  update public.tenant_memberships set membership_tier = next_tier
    where tenant_id = check_tenant_id and user_id = target_user_id;
  if not found then raise exception 'Member not found'; end if;
  delete from public.tenant_member_access_roles where tenant_id = check_tenant_id and user_id = target_user_id;
  insert into public.tenant_member_access_roles (tenant_id, user_id, role_id, assigned_by)
    select check_tenant_id, target_user_id, role_id, (select auth.uid()) from unnest(role_ids) role_id;
  perform private.write_audit_log(check_tenant_id, (select auth.uid()), 'member.access_updated', 'membership', target_user_id::text,
    jsonb_build_object('membership_tier', next_tier, 'role_ids', role_ids));
end;
$$;

create or replace function public.create_tenant_access_role(check_tenant_id uuid, role_name text, role_description text, permission_keys text[])
returns uuid language plpgsql security definer set search_path = '' as $$
declare new_role_id uuid; role_slug text;
begin
  if not private.has_tenant_permission(check_tenant_id, 'roles.manage') then raise exception 'Role management permission is required'; end if;
  role_slug := trim(both '-' from regexp_replace(lower(trim(role_name)), '[^a-z0-9]+', '-', 'g'));
  if length(role_slug) < 2 then raise exception 'Enter a valid role name'; end if;
  if exists (select 1 from unnest(permission_keys) permission_key where not exists (select 1 from public.access_permissions ap where ap.key = permission_key)) then
    raise exception 'Unknown permission';
  end if;
  insert into public.tenant_access_roles (tenant_id, name, slug, description, created_by)
    values (check_tenant_id, trim(role_name), role_slug, nullif(trim(role_description), ''), (select auth.uid())) returning id into new_role_id;
  insert into public.tenant_access_role_permissions (tenant_id, role_id, permission_key)
    select check_tenant_id, new_role_id, permission_key from unnest(permission_keys) permission_key;
  perform private.write_audit_log(check_tenant_id, (select auth.uid()), 'role.created', 'access_role', new_role_id::text,
    jsonb_build_object('name', trim(role_name), 'permissions', permission_keys));
  return new_role_id;
end;
$$;

grant execute on function public.set_member_access(uuid, uuid, text, uuid[]) to authenticated;
grant execute on function public.create_tenant_access_role(uuid, text, text, text[]) to authenticated;

alter table public.spaces add column if not exists minimum_access_tier text not null default 'associate';
alter table public.spaces drop constraint if exists spaces_minimum_access_tier_check;
alter table public.spaces add constraint spaces_minimum_access_tier_check check (minimum_access_tier in ('guest','associate','professional'));
alter table public.courses add column if not exists minimum_access_tier text not null default 'associate';
alter table public.courses drop constraint if exists courses_minimum_access_tier_check;
alter table public.courses add constraint courses_minimum_access_tier_check check (minimum_access_tier in ('guest','associate','professional'));

create or replace function private.membership_tier_rank(tier text)
returns integer language sql immutable set search_path = '' as $$
  select case tier when 'professional' then 3 when 'associate' then 2 when 'guest' then 1 else 0 end;
$$;

create or replace function private.can_access_space(check_space_id uuid, check_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.spaces s
    join public.tenant_memberships tm on tm.tenant_id = s.tenant_id and tm.user_id = (select auth.uid()) and tm.status = 'active'
    where s.id = check_space_id and s.tenant_id = check_tenant_id and (
      private.has_tenant_permission(s.tenant_id, 'workspace.full_access')
      or exists (select 1 from public.space_members sm where sm.space_id = s.id and sm.user_id = (select auth.uid()))
      or (s.status = 'published' and s.visibility = 'members'
        and private.membership_tier_rank(tm.membership_tier) >= private.membership_tier_rank(s.minimum_access_tier))
    )
  );
$$;

create or replace function private.can_manage_course(check_course_id uuid, check_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_tenant_permission(check_tenant_id, 'courses.manage_all')
    or exists (select 1 from public.course_instructors ci where ci.course_id = check_course_id and ci.tenant_id = check_tenant_id and ci.user_id = (select auth.uid()));
$$;

create or replace function private.can_access_course(check_course_id uuid, check_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses c
    join public.tenant_memberships tm on tm.tenant_id = c.tenant_id and tm.user_id = (select auth.uid()) and tm.status = 'active'
    where c.id = check_course_id and c.tenant_id = check_tenant_id and (
      private.can_manage_course(c.id, c.tenant_id)
      or (c.status = 'published'
        and private.membership_tier_rank(tm.membership_tier) >= private.membership_tier_rank(c.minimum_access_tier)
        and (c.access_mode <> 'private' or exists (
          select 1 from public.course_enrollments ce where ce.course_id = c.id and ce.user_id = (select auth.uid()) and ce.status in ('active','completed')
        )))
    )
  );
$$;

drop policy if exists "members read available courses" on public.courses;
create policy "members read available courses" on public.courses for select to authenticated using (private.can_access_course(id, tenant_id));
drop policy if exists "admins create courses" on public.courses;
create policy "authorized users create courses" on public.courses for insert to authenticated with check (private.has_tenant_permission(tenant_id, 'courses.create'));
drop policy if exists "admins delete courses" on public.courses;
create policy "course chairs delete courses" on public.courses for delete to authenticated using (private.has_tenant_permission(tenant_id, 'courses.manage_all'));
drop policy if exists "admins manage course instructors" on public.course_instructors;
create policy "course chairs manage course instructors" on public.course_instructors for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'instructors.manage')) with check (private.has_tenant_permission(tenant_id, 'instructors.manage'));

create or replace function private.seed_access_roles_after_tenant_insert()
returns trigger language plpgsql security definer set search_path = '' as $$
begin perform private.seed_tenant_access_roles(new.id); return new; end;
$$;
drop trigger if exists seed_access_roles_after_tenant_insert on public.tenants;
create trigger seed_access_roles_after_tenant_insert after insert on public.tenants
for each row execute function private.seed_access_roles_after_tenant_insert();

revoke all on function private.has_tenant_permission(uuid, text) from public;
revoke all on function private.membership_tier_rank(text) from public;
grant execute on function private.has_tenant_permission(uuid, text) to authenticated;
grant execute on function private.membership_tier_rank(text) to authenticated;
