-- Phase 3: tenant-safe community spaces, posts, comments, and reactions.

create unique index spaces_id_tenant_idx on public.spaces (id, tenant_id);
create unique index posts_id_tenant_idx on public.posts (id, tenant_id);
create unique index comments_id_tenant_idx on public.comments (id, tenant_id);

alter table public.posts
  add constraint posts_space_tenant_fk
  foreign key (space_id, tenant_id) references public.spaces(id, tenant_id) on delete cascade;

alter table public.comments
  add constraint comments_post_tenant_fk
  foreign key (post_id, tenant_id) references public.posts(id, tenant_id) on delete cascade;

alter table public.reactions
  add constraint reactions_post_tenant_fk
  foreign key (post_id, tenant_id) references public.posts(id, tenant_id) on delete cascade,
  add constraint reactions_comment_tenant_fk
  foreign key (comment_id, tenant_id) references public.comments(id, tenant_id) on delete cascade;

create policy "authors delete posts"
on public.posts for delete to authenticated
using (public.is_tenant_member(tenant_id) and author_id = (select auth.uid()));

create policy "moderators delete posts"
on public.posts for delete to authenticated
using (
  private.has_tenant_role(
    tenant_id,
    array['owner', 'admin', 'moderator']::public.tenant_role[]
  )
);

create policy "authors delete comments"
on public.comments for delete to authenticated
using (public.is_tenant_member(tenant_id) and author_id = (select auth.uid()));

create policy "moderators delete comments"
on public.comments for delete to authenticated
using (
  private.has_tenant_role(
    tenant_id,
    array['owner', 'admin', 'moderator']::public.tenant_role[]
  )
);

create policy "members create reactions"
on public.reactions for insert to authenticated
with check (public.is_tenant_member(tenant_id) and user_id = (select auth.uid()));

create policy "members remove own reactions"
on public.reactions for delete to authenticated
using (public.is_tenant_member(tenant_id) and user_id = (select auth.uid()));

create or replace function public.create_community_space(
  check_tenant_id uuid,
  space_name text,
  space_slug text,
  space_description text,
  space_kind public.space_kind default 'discussion'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := nullif(trim(space_name), '');
  clean_slug text := lower(trim(space_slug));
  new_space_id uuid;
  space_limit integer;
  current_space_count integer;
begin
  if not private.has_tenant_role(check_tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Organization administrator access is required';
  end if;

  if not exists (
    select 1 from public.tenants
    where id = check_tenant_id and status in ('trial', 'active')
  ) then
    raise exception 'This organization cannot create community content in its current state';
  end if;

  if clean_name is null or length(clean_name) < 2 or length(clean_name) > 80 then
    raise exception 'Space name must contain 2 to 80 characters';
  end if;

  if clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Space URL must use lowercase letters, numbers, and single hyphens';
  end if;

  select (pe.value #>> '{}')::integer into space_limit
  from public.tenant_subscriptions ts
  join public.plan_entitlements pe on pe.plan_id = ts.plan_id
  where ts.tenant_id = check_tenant_id and pe.entitlement_key = 'spaces.max';

  select count(*) into current_space_count from public.spaces where tenant_id = check_tenant_id;
  if space_limit is null or current_space_count >= space_limit then
    raise exception 'This organization has reached its plan space limit';
  end if;

  insert into public.spaces (tenant_id, name, slug, description, kind)
  values (check_tenant_id, clean_name, clean_slug, nullif(trim(space_description), ''), space_kind)
  returning id into new_space_id;

  perform private.write_audit_log(
    check_tenant_id,
    (select auth.uid()),
    'space.created',
    'space',
    new_space_id::text,
    jsonb_build_object('name', clean_name, 'slug', clean_slug, 'kind', space_kind::text)
  );
  return new_space_id;
end;
$$;

create or replace function public.toggle_post_reaction(
  check_post_id uuid,
  reaction_emoji text default 'heart'
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  post_tenant_id uuid;
  clean_emoji text := lower(trim(reaction_emoji));
begin
  select tenant_id into post_tenant_id from public.posts where id = check_post_id;
  if post_tenant_id is null or not public.is_tenant_member(post_tenant_id) then
    raise exception 'Post access is required';
  end if;

  if clean_emoji not in ('heart', 'like', 'celebrate', 'insightful') then
    raise exception 'Unsupported reaction';
  end if;

  if exists (
    select 1 from public.reactions
    where user_id = caller_id and post_id = check_post_id and comment_id is null and emoji = clean_emoji
  ) then
    delete from public.reactions
    where user_id = caller_id and post_id = check_post_id and comment_id is null and emoji = clean_emoji;
    return false;
  end if;

  insert into public.reactions (tenant_id, user_id, post_id, emoji)
  values (post_tenant_id, caller_id, check_post_id, clean_emoji);
  return true;
end;
$$;

create or replace function private.bootstrap_default_space()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.spaces (tenant_id, name, slug, description, kind, icon)
  values (new.id, 'General', 'general', 'Community-wide conversations and announcements.', 'discussion', 'messages');
  return new;
end;
$$;

create trigger bootstrap_default_space
after insert on public.tenants
for each row execute function private.bootstrap_default_space();

insert into public.spaces (tenant_id, name, slug, description, kind, icon)
select t.id, 'General', 'general', 'Community-wide conversations and announcements.', 'discussion', 'messages'
from public.tenants t
where not exists (select 1 from public.spaces s where s.tenant_id = t.id);

revoke all on function public.create_community_space(uuid, text, text, text, public.space_kind) from public;
revoke all on function public.toggle_post_reaction(uuid, text) from public;
grant execute on function public.create_community_space(uuid, text, text, text, public.space_kind) to authenticated;
grant execute on function public.toggle_post_reaction(uuid, text) to authenticated;
