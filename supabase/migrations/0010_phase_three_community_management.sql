-- Phase 3: private-space access, editorial controls, and moderation.

alter table public.spaces
  add constraint spaces_visibility_check check (visibility in ('members', 'private'));

create table public.space_members (
  tenant_id uuid not null,
  space_id uuid not null,
  user_id uuid not null,
  granted_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id),
  foreign key (space_id, tenant_id) references public.spaces(id, tenant_id) on delete cascade,
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id) on delete cascade
);

alter table public.space_members enable row level security;
revoke all on table public.space_members from anon;
grant select on table public.space_members to authenticated;

create or replace function private.can_access_space(check_space_id uuid, check_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.spaces s
    join public.tenant_memberships tm
      on tm.tenant_id = s.tenant_id
     and tm.user_id = (select auth.uid())
     and tm.status = 'active'
    where s.id = check_space_id
      and s.tenant_id = check_tenant_id
      and (
        s.visibility = 'members'
        or tm.role in ('owner', 'admin', 'moderator')
        or exists (
          select 1 from public.space_members sm
          where sm.space_id = s.id and sm.user_id = (select auth.uid())
        )
      )
  );
$$;

create policy "members read own space grants"
on public.space_members for select to authenticated
using (
  user_id = (select auth.uid())
  or private.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_role[])
);

drop policy if exists "tenant members can read" on public.spaces;
drop policy if exists "tenant members can read" on public.posts;
drop policy if exists "tenant members can read" on public.comments;
drop policy if exists "tenant members can read" on public.reactions;

create policy "members read accessible spaces"
on public.spaces for select to authenticated
using (private.can_access_space(id, tenant_id));

create policy "members read accessible posts"
on public.posts for select to authenticated
using (private.can_access_space(space_id, tenant_id));

create policy "members read accessible comments"
on public.comments for select to authenticated
using (
  exists (
    select 1 from public.posts p
    where p.id = comments.post_id
      and p.tenant_id = comments.tenant_id
      and private.can_access_space(p.space_id, p.tenant_id)
  )
);

create policy "members read accessible reactions"
on public.reactions for select to authenticated
using (
  (post_id is not null and exists (
    select 1 from public.posts p
    where p.id = reactions.post_id
      and p.tenant_id = reactions.tenant_id
      and private.can_access_space(p.space_id, p.tenant_id)
  ))
  or
  (comment_id is not null and exists (
    select 1 from public.comments c
    join public.posts p on p.id = c.post_id and p.tenant_id = c.tenant_id
    where c.id = reactions.comment_id
      and c.tenant_id = reactions.tenant_id
      and private.can_access_space(p.space_id, p.tenant_id)
  ))
);

drop policy if exists "members create posts" on public.posts;
drop policy if exists "authors update posts" on public.posts;
drop policy if exists "authors delete posts" on public.posts;
drop policy if exists "members create comments" on public.comments;
drop policy if exists "authors update comments" on public.comments;
drop policy if exists "authors delete comments" on public.comments;
drop policy if exists "members create reactions" on public.reactions;
drop policy if exists "members remove own reactions" on public.reactions;

create policy "members create posts in accessible spaces"
on public.posts for insert to authenticated
with check (
  author_id = (select auth.uid())
  and private.can_access_space(space_id, tenant_id)
);

create policy "authors update accessible posts"
on public.posts for update to authenticated
using (author_id = (select auth.uid()) and private.can_access_space(space_id, tenant_id))
with check (author_id = (select auth.uid()) and private.can_access_space(space_id, tenant_id));

create policy "authors delete accessible posts"
on public.posts for delete to authenticated
using (author_id = (select auth.uid()) and private.can_access_space(space_id, tenant_id));

create policy "members create comments on accessible posts"
on public.comments for insert to authenticated
with check (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.posts p
    where p.id = comments.post_id
      and p.tenant_id = comments.tenant_id
      and private.can_access_space(p.space_id, p.tenant_id)
  )
);

create policy "authors update accessible comments"
on public.comments for update to authenticated
using (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.posts p
    where p.id = comments.post_id and private.can_access_space(p.space_id, p.tenant_id)
  )
)
with check (author_id = (select auth.uid()));

create policy "authors delete accessible comments"
on public.comments for delete to authenticated
using (
  author_id = (select auth.uid())
  and exists (
    select 1 from public.posts p
    where p.id = comments.post_id and private.can_access_space(p.space_id, p.tenant_id)
  )
);

create policy "members create reactions in accessible spaces"
on public.reactions for insert to authenticated
with check (
  user_id = (select auth.uid())
  and post_id is not null
  and exists (
    select 1 from public.posts p
    where p.id = reactions.post_id
      and p.tenant_id = reactions.tenant_id
      and private.can_access_space(p.space_id, p.tenant_id)
  )
);

create policy "members remove accessible own reactions"
on public.reactions for delete to authenticated
using (user_id = (select auth.uid()));

create or replace function public.update_community_space(
  check_space_id uuid,
  space_name text,
  space_slug text,
  space_description text,
  space_kind public.space_kind,
  space_visibility text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_space public.spaces%rowtype;
  clean_name text := nullif(trim(space_name), '');
  clean_slug text := lower(trim(space_slug));
begin
  select * into current_space from public.spaces where id = check_space_id for update;
  if current_space.id is null
     or not private.has_tenant_role(current_space.tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Organization administrator access is required';
  end if;
  if clean_name is null or length(clean_name) < 2 or length(clean_name) > 80 then
    raise exception 'Space name must contain 2 to 80 characters';
  end if;
  if clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Space URL is invalid';
  end if;
  if space_visibility not in ('members', 'private') then
    raise exception 'Space visibility is invalid';
  end if;

  update public.spaces
  set name = clean_name,
      slug = clean_slug,
      description = nullif(trim(space_description), ''),
      kind = space_kind,
      visibility = space_visibility
  where id = check_space_id;

  perform private.write_audit_log(
    current_space.tenant_id,
    (select auth.uid()),
    'space.updated',
    'space',
    check_space_id::text,
    jsonb_build_object('visibility', space_visibility, 'slug', clean_slug)
  );
end;
$$;

create or replace function public.set_space_member_access(
  check_space_id uuid,
  target_user_id uuid,
  access_enabled boolean
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_tenant_id uuid;
begin
  select tenant_id into current_tenant_id from public.spaces where id = check_space_id;
  if current_tenant_id is null
     or not private.has_tenant_role(current_tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Organization administrator access is required';
  end if;
  if not exists (
    select 1 from public.tenant_memberships
    where tenant_id = current_tenant_id and user_id = target_user_id and status = 'active'
  ) then
    raise exception 'The selected person is not an active organization member';
  end if;

  if access_enabled then
    insert into public.space_members (tenant_id, space_id, user_id, granted_by)
    values (current_tenant_id, check_space_id, target_user_id, (select auth.uid()))
    on conflict (space_id, user_id) do nothing;
  else
    delete from public.space_members where space_id = check_space_id and user_id = target_user_id;
  end if;

  perform private.write_audit_log(
    current_tenant_id,
    (select auth.uid()),
    case when access_enabled then 'space.member_added' else 'space.member_removed' end,
    'space_member',
    target_user_id::text,
    jsonb_build_object('space_id', check_space_id)
  );
end;
$$;

create or replace function public.set_post_pinned(check_post_id uuid, pinned boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_post public.posts%rowtype;
begin
  select * into current_post from public.posts where id = check_post_id;
  if current_post.id is null
     or not private.has_tenant_role(current_post.tenant_id, array['owner', 'admin', 'moderator']::public.tenant_role[]) then
    raise exception 'Moderator access is required';
  end if;
  update public.posts set is_pinned = pinned, updated_at = now() where id = check_post_id;
  perform private.write_audit_log(
    current_post.tenant_id,
    (select auth.uid()),
    case when pinned then 'post.pinned' else 'post.unpinned' end,
    'post',
    check_post_id::text,
    '{}'::jsonb
  );
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
  current_post public.posts%rowtype;
  clean_emoji text := lower(trim(reaction_emoji));
begin
  select * into current_post from public.posts where id = check_post_id;
  if current_post.id is null or not private.can_access_space(current_post.space_id, current_post.tenant_id) then
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
  values (current_post.tenant_id, caller_id, check_post_id, clean_emoji);
  return true;
end;
$$;

revoke all on function public.update_community_space(uuid, text, text, text, public.space_kind, text) from public;
revoke all on function public.set_space_member_access(uuid, uuid, boolean) from public;
revoke all on function public.set_post_pinned(uuid, boolean) from public;
grant execute on function public.update_community_space(uuid, text, text, text, public.space_kind, text) to authenticated;
grant execute on function public.set_space_member_access(uuid, uuid, boolean) to authenticated;
grant execute on function public.set_post_pinned(uuid, boolean) to authenticated;
