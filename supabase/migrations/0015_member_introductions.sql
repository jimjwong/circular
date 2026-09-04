-- Member introductions are tenant-specific onboarding milestones backed by
-- ordinary community posts, so all existing engagement and moderation applies.

alter table public.profiles
  add column headline text,
  add column location text,
  add column interests text[] not null default '{}';

alter table public.notifications drop constraint notifications_kind_check;
alter table public.notifications
  add constraint notifications_kind_check
  check (kind in ('post.comment', 'comment.reply', 'post.reaction', 'member.introduction'));

create table public.member_onboarding (
  tenant_id uuid not null,
  user_id uuid not null,
  introduction_post_id uuid,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, user_id),
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id) on delete cascade,
  foreign key (introduction_post_id, tenant_id) references public.posts(id, tenant_id) on delete set null (introduction_post_id)
);

create index member_onboarding_recent_idx on public.member_onboarding (tenant_id, completed_at desc) where completed_at is not null;

alter table public.member_onboarding enable row level security;
create policy "members read tenant onboarding"
on public.member_onboarding for select to authenticated
using (public.is_tenant_member(tenant_id));

revoke all on table public.member_onboarding from anon;
grant select on table public.member_onboarding to authenticated;

create or replace function public.publish_member_introduction(
  check_tenant_id uuid,
  intro_display_name text,
  intro_headline text,
  intro_location text,
  intro_bio text,
  intro_interests text[],
  intro_goal text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  intro_space_id uuid;
  existing_post_id uuid;
  saved_post_id uuid;
  is_first_introduction boolean := false;
  post_body jsonb;
begin
  if caller_id is null or not exists (
    select 1 from public.tenant_memberships
    where tenant_id = check_tenant_id and user_id = caller_id and status = 'active'
  ) then
    raise exception 'Active organization membership is required';
  end if;

  select id into intro_space_id
  from public.spaces
  where tenant_id = check_tenant_id and slug in ('introductions', 'introduce-yourself')
  order by case when slug = 'introductions' then 0 else 1 end
  limit 1;

  if intro_space_id is null or not private.can_access_space(intro_space_id, check_tenant_id) then
    raise exception 'The introductions space is unavailable';
  end if;

  if length(trim(intro_display_name)) not between 2 and 80
     or length(trim(intro_headline)) not between 2 and 100
     or length(trim(intro_location)) > 80
     or length(trim(intro_bio)) not between 20 and 1000
     or length(trim(intro_goal)) not between 10 and 500
     or coalesce(array_length(intro_interests, 1), 0) > 8 then
    raise exception 'Introduction details are invalid';
  end if;

  update public.profiles
  set display_name = trim(intro_display_name),
      headline = trim(intro_headline),
      location = nullif(trim(intro_location), ''),
      bio = trim(intro_bio),
      interests = coalesce(intro_interests, '{}'),
      updated_at = now()
  where id = caller_id;

  update public.tenant_memberships
  set headline = trim(intro_headline), updated_at = now()
  where tenant_id = check_tenant_id and user_id = caller_id;

  post_body := jsonb_build_object(
    'type', 'introduction',
    'text', trim(intro_bio) || E'\n\nWhat I hope to get from this community\n' || trim(intro_goal),
    'headline', trim(intro_headline),
    'location', nullif(trim(intro_location), ''),
    'interests', to_jsonb(coalesce(intro_interests, '{}')),
    'goal', trim(intro_goal)
  );

  select introduction_post_id into existing_post_id
  from public.member_onboarding
  where tenant_id = check_tenant_id and user_id = caller_id
  for update;

  if existing_post_id is not null and exists (
    select 1 from public.posts where id = existing_post_id and tenant_id = check_tenant_id
  ) then
    update public.posts
    set title = '👋 Hi, I''m ' || trim(intro_display_name), body = post_body,
        space_id = intro_space_id, status = 'published', updated_at = now()
    where id = existing_post_id and tenant_id = check_tenant_id
    returning id into saved_post_id;
  else
    insert into public.posts (tenant_id, space_id, author_id, title, body, status, published_at)
    values (check_tenant_id, intro_space_id, caller_id, '👋 Hi, I''m ' || trim(intro_display_name), post_body, 'published', now())
    returning id into saved_post_id;
    is_first_introduction := true;
  end if;

  insert into public.member_onboarding (tenant_id, user_id, introduction_post_id, completed_at, updated_at)
  values (check_tenant_id, caller_id, saved_post_id, now(), now())
  on conflict (tenant_id, user_id) do update
  set introduction_post_id = excluded.introduction_post_id,
      completed_at = coalesce(public.member_onboarding.completed_at, excluded.completed_at),
      updated_at = now();

  if is_first_introduction then
    insert into public.notifications (tenant_id, user_id, actor_id, kind, entity_type, entity_id, message)
    select check_tenant_id, tm.user_id, caller_id, 'member.introduction', 'post', saved_post_id,
           'introduced themselves to the community'
    from public.tenant_memberships tm
    where tm.tenant_id = check_tenant_id
      and tm.status = 'active'
      and tm.role in ('owner', 'admin', 'moderator')
      and tm.user_id <> caller_id;
  end if;

  return saved_post_id;
end;
$$;

revoke all on function public.publish_member_introduction(uuid, text, text, text, text, text[], text) from public;
grant execute on function public.publish_member_introduction(uuid, text, text, text, text, text[], text) to authenticated;

do $$ begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'member_onboarding'
  ) then
    alter publication supabase_realtime add table public.member_onboarding;
  end if;
end $$;
