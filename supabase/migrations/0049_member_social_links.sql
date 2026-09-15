-- Standard social/contact fields any member can fill in on their own profile
-- (/members/me/edit) — a public contact email distinct from their account email, plus
-- Twitter/X, YouTube, Facebook, and Instagram, alongside the website_url and
-- linkedin_url this table already had. Surfaced wherever a profile already is: the
-- internal directory, and the public website's member directory / individual profile.

alter table public.profiles
  add column if not exists contact_email text,
  add column if not exists twitter_url text,
  add column if not exists youtube_url text,
  add column if not exists facebook_url text,
  add column if not exists instagram_url text;

comment on column public.profiles.contact_email is
  'Public-facing contact address a member chooses to publish, distinct from their private account email.';

-- Both functions change their return column list, which create or replace cannot do
-- for a table-returning function — drop and recreate instead.
drop function if exists public.get_member_directory(uuid);

create function public.get_member_directory(check_tenant_id uuid)
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
  contact_email text,
  twitter_url text,
  youtube_url text,
  facebook_url text,
  instagram_url text,
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
    profile.contact_email,
    profile.twitter_url,
    profile.youtube_url,
    profile.facebook_url,
    profile.instagram_url,
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
      or ((select membership_tier from viewer) <> 'guest' and coalesce(directory.directory_visibility, 'members') in ('members', 'public'))
    )
  order by membership.activity_score desc, profile.display_name;
$$;

revoke all on function public.get_member_directory(uuid) from public;
grant execute on function public.get_member_directory(uuid) to authenticated;

drop function if exists public.website_public_members(uuid, integer);

create function public.website_public_members(check_site_id uuid, max_count integer default 60)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  bio text,
  headline text,
  interests text[],
  website_url text,
  linkedin_url text,
  contact_email text,
  twitter_url text,
  youtube_url text,
  facebook_url text,
  instagram_url text,
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
    profile.contact_email,
    profile.twitter_url,
    profile.youtube_url,
    profile.facebook_url,
    profile.instagram_url,
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
