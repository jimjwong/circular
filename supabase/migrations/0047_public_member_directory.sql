-- Lets a member's own directory visibility extend to the tenant's public website, and
-- exposes those members to anonymous visitors through a security-definer function that
-- mirrors website_public_events / website_public_courses (0046).
--
-- 'public' sits above 'members': a profile set to 'public' is more open than 'members'
-- (which still requires being a signed-in, non-guest tenant member), not a separate
-- concept, so the existing internal directory continues to show public profiles too.

alter table public.tenant_member_profiles
  drop constraint tenant_member_profiles_directory_visibility_check;

alter table public.tenant_member_profiles
  add constraint tenant_member_profiles_directory_visibility_check
  check (directory_visibility in ('members', 'admins', 'hidden', 'public'));

comment on column public.tenant_member_profiles.directory_visibility is
  'members: signed-in tenant members. admins: staff only. public: also shown on the tenant''s published website. hidden: nobody but the member and staff.';

create or replace function public.website_public_members(check_site_id uuid, max_count integer default 60)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  bio text,
  headline text,
  interests text[],
  website_url text,
  linkedin_url text,
  custom_values jsonb
)
language sql stable security definer set search_path = '' as $$
  select
    membership.user_id,
    coalesce(profile.display_name, 'Member'),
    profile.avatar_url,
    profile.bio,
    profile.headline,
    profile.interests,
    profile.website_url,
    profile.linkedin_url,
    coalesce(directory.custom_values, '{}'::jsonb)
  from public.tenant_memberships membership
  join public.tenant_member_profiles directory
    on directory.tenant_id = membership.tenant_id and directory.user_id = membership.user_id
  join public.profiles profile on profile.id = membership.user_id
  join public.website_sites ws on ws.tenant_id = membership.tenant_id
  where ws.id = check_site_id
    and ws.status = 'published'
    and membership.status = 'active'
    and directory.directory_visibility = 'public'
  order by profile.display_name
  limit greatest(least(coalesce(max_count, 60), 200), 1);
$$;

revoke all on function public.website_public_members(uuid, integer) from public;
grant execute on function public.website_public_members(uuid, integer) to anon, authenticated;

comment on function public.website_public_members(uuid, integer) is
  'Public-listed member profiles of a published site''s tenant, for the public member directory page.';
