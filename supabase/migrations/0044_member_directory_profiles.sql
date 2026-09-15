-- Tenant-aware member directory, privacy, custom fields, tags, and saved segments.

alter table public.profiles
  add column if not exists pronouns text,
  add column if not exists website_url text,
  add column if not exists linkedin_url text;

create table public.tenant_member_profiles (
  tenant_id uuid not null,
  user_id uuid not null,
  directory_visibility text not null default 'members'
    check (directory_visibility in ('members', 'admins', 'hidden')),
  show_email boolean not null default false,
  show_location boolean not null default true,
  show_activity boolean not null default true,
  show_courses boolean not null default true,
  show_events boolean not null default true,
  availability text,
  custom_values jsonb not null default '{}'::jsonb check (jsonb_typeof(custom_values) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id) on delete cascade
);

insert into public.tenant_member_profiles (tenant_id, user_id)
select tenant_id, user_id from public.tenant_memberships
on conflict do nothing;

create table public.member_profile_fields (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  field_key text not null check (field_key ~ '^[a-z0-9-]+$'),
  label text not null check (length(trim(label)) between 2 and 80),
  field_type text not null default 'text' check (field_type in ('text', 'url', 'number', 'select', 'boolean')),
  options text[] not null default '{}',
  help_text text,
  visibility text not null default 'members' check (visibility in ('members', 'admins', 'self')),
  is_required boolean not null default false,
  is_active boolean not null default true,
  position integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, field_key),
  unique (id, tenant_id)
);

create table public.member_segments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (length(trim(name)) between 2 and 80),
  criteria jsonb not null default '{}'::jsonb check (jsonb_typeof(criteria) = 'object'),
  created_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, name)
);

create index tenant_member_profiles_visibility_idx on public.tenant_member_profiles (tenant_id, directory_visibility);
create index member_profile_fields_position_idx on public.member_profile_fields (tenant_id, position) where is_active;
create index if not exists member_tags_user_idx on public.member_tags (tenant_id, user_id);
create index member_segments_tenant_idx on public.member_segments (tenant_id, created_at desc);

alter table public.tenant_member_profiles enable row level security;
alter table public.member_profile_fields enable row level security;
alter table public.member_segments enable row level security;

create policy "members view permitted directory profiles" on public.tenant_member_profiles for select to authenticated
using (
  user_id = auth.uid()
  or private.has_tenant_permission(tenant_id, 'members.manage')
  or (
    directory_visibility = 'members'
    and exists (
      select 1 from public.tenant_memberships viewer
      where viewer.tenant_id = tenant_member_profiles.tenant_id
        and viewer.user_id = auth.uid() and viewer.status = 'active'
        and viewer.membership_tier <> 'guest'
    )
  )
);
create policy "members create own directory profile" on public.tenant_member_profiles for insert to authenticated
with check (user_id = auth.uid() or private.has_tenant_permission(tenant_id, 'members.manage'));
create policy "members update own directory profile" on public.tenant_member_profiles for update to authenticated
using (user_id = auth.uid() or private.has_tenant_permission(tenant_id, 'members.manage'))
with check (user_id = auth.uid() or private.has_tenant_permission(tenant_id, 'members.manage'));

create policy "members read profile fields" on public.member_profile_fields for select to authenticated
using (public.is_tenant_member(tenant_id));
create policy "member managers create profile fields" on public.member_profile_fields for insert to authenticated
with check (private.has_tenant_permission(tenant_id, 'members.manage'));
create policy "member managers update profile fields" on public.member_profile_fields for update to authenticated
using (private.has_tenant_permission(tenant_id, 'members.manage'))
with check (private.has_tenant_permission(tenant_id, 'members.manage'));
create policy "member managers delete profile fields" on public.member_profile_fields for delete to authenticated
using (private.has_tenant_permission(tenant_id, 'members.manage'));

create policy "member managers create directory tags" on public.tags for insert to authenticated
with check (private.has_tenant_permission(tenant_id, 'members.manage'));
create policy "member managers update directory tags" on public.tags for update to authenticated
using (private.has_tenant_permission(tenant_id, 'members.manage'))
with check (private.has_tenant_permission(tenant_id, 'members.manage'));
create policy "member managers delete directory tags" on public.tags for delete to authenticated
using (private.has_tenant_permission(tenant_id, 'members.manage'));

create policy "member managers create tag assignments" on public.member_tags for insert to authenticated
with check (private.has_tenant_permission(tenant_id, 'members.manage'));
create policy "member managers delete tag assignments" on public.member_tags for delete to authenticated
using (private.has_tenant_permission(tenant_id, 'members.manage'));

create policy "audience managers read segments" on public.member_segments for select to authenticated
using (private.has_tenant_permission(tenant_id, 'members.manage') or private.has_tenant_permission(tenant_id, 'communications.manage'));
create policy "audience managers create segments" on public.member_segments for insert to authenticated
with check (private.has_tenant_permission(tenant_id, 'members.manage') or private.has_tenant_permission(tenant_id, 'communications.manage'));
create policy "audience managers update segments" on public.member_segments for update to authenticated
using (private.has_tenant_permission(tenant_id, 'members.manage') or private.has_tenant_permission(tenant_id, 'communications.manage'))
with check (private.has_tenant_permission(tenant_id, 'members.manage') or private.has_tenant_permission(tenant_id, 'communications.manage'));
create policy "audience managers delete segments" on public.member_segments for delete to authenticated
using (private.has_tenant_permission(tenant_id, 'members.manage') or private.has_tenant_permission(tenant_id, 'communications.manage'));

grant select, insert, update on public.tenant_member_profiles to authenticated;
grant select, insert, update, delete on public.member_profile_fields to authenticated;
grant select, insert, update, delete on public.tags to authenticated;
grant select, insert, delete on public.member_tags to authenticated;
grant select, insert, update, delete on public.member_segments to authenticated;

create or replace function public.get_member_directory(check_tenant_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  bio text,
  headline text,
  location text,
  interests text[],
  pronouns text,
  website_url text,
  linkedin_url text,
  email text,
  membership_tier text,
  account_role public.tenant_role,
  joined_at timestamptz,
  activity_score integer,
  availability text,
  directory_visibility text,
  show_email boolean,
  show_location boolean,
  show_activity boolean,
  show_courses boolean,
  show_events boolean,
  custom_values jsonb
)
language sql stable security definer set search_path = '' as $$
  with viewer as (
    select tm.membership_tier
    from public.tenant_memberships tm
    where tm.tenant_id = check_tenant_id and tm.user_id = auth.uid() and tm.status = 'active'
  )
  select
    membership.user_id,
    coalesce(profile.display_name, split_part(profile.email, '@', 1), 'Member'),
    profile.avatar_url,
    profile.bio,
    profile.headline,
    case when coalesce(directory.show_location, true) or membership.user_id = auth.uid()
      or private.has_tenant_permission(check_tenant_id, 'members.manage') then profile.location else null end,
    profile.interests,
    profile.pronouns,
    profile.website_url,
    profile.linkedin_url,
    case when coalesce(directory.show_email, false) or membership.user_id = auth.uid()
      or private.has_tenant_permission(check_tenant_id, 'members.manage') then profile.email else null end,
    membership.membership_tier,
    membership.role,
    membership.joined_at,
    membership.activity_score,
    directory.availability,
    coalesce(directory.directory_visibility, 'members'),
    coalesce(directory.show_email, false),
    coalesce(directory.show_location, true),
    coalesce(directory.show_activity, true),
    coalesce(directory.show_courses, true),
    coalesce(directory.show_events, true),
    coalesce((
      select jsonb_object_agg(value.key, value.value)
      from jsonb_each(coalesce(directory.custom_values, '{}'::jsonb)) value
      join public.member_profile_fields field
        on field.tenant_id = check_tenant_id and field.field_key = value.key and field.is_active
      where field.visibility = 'members' or membership.user_id = auth.uid()
        or private.has_tenant_permission(check_tenant_id, 'members.manage')
    ), '{}'::jsonb)
  from public.tenant_memberships membership
  join public.profiles profile on profile.id = membership.user_id
  left join public.tenant_member_profiles directory
    on directory.tenant_id = membership.tenant_id and directory.user_id = membership.user_id
  where membership.tenant_id = check_tenant_id and membership.status = 'active'
    and exists (select 1 from viewer)
    and (
      membership.user_id = auth.uid()
      or private.has_tenant_permission(check_tenant_id, 'members.manage')
      or ((select membership_tier from viewer) <> 'guest' and coalesce(directory.directory_visibility, 'members') = 'members')
    )
  order by membership.activity_score desc, profile.display_name;
$$;

revoke all on function public.get_member_directory(uuid) from public;
grant execute on function public.get_member_directory(uuid) to authenticated;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'tenant_member_profiles'
  ) then alter publication supabase_realtime add table public.tenant_member_profiles; end if;
end $$;
