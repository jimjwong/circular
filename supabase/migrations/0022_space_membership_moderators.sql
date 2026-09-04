-- Optional participation and per-space moderation controls.

alter table public.spaces add column if not exists membership_mode text not null default 'automatic';
alter table public.spaces drop constraint if exists spaces_membership_mode_check;
alter table public.spaces add constraint spaces_membership_mode_check check (membership_mode in ('automatic', 'optional', 'invite'));

create table if not exists public.space_moderators (
  tenant_id uuid not null,
  space_id uuid not null,
  user_id uuid not null,
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (space_id, user_id),
  foreign key (space_id, tenant_id) references public.spaces(id, tenant_id) on delete cascade,
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id) on delete cascade
);

alter table public.space_moderators enable row level security;
revoke all on table public.space_moderators from anon;
grant select on table public.space_moderators to authenticated;

drop policy if exists "members read space moderators" on public.space_moderators;
create policy "members read space moderators"
on public.space_moderators for select to authenticated
using (private.can_access_space(space_id, tenant_id) or private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_role[]));

create or replace function private.is_space_moderator(check_space_id uuid, check_tenant_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.space_moderators sm
    where sm.space_id = check_space_id and sm.tenant_id = check_tenant_id and sm.user_id = (select auth.uid())
  );
$$;

create or replace function private.can_post_to_space(check_space_id uuid, check_tenant_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.spaces s
    where s.id = check_space_id and s.tenant_id = check_tenant_id and s.status = 'published'
      and private.can_access_space(s.id, s.tenant_id)
      and (s.posting_permission = 'members'
        or private.has_tenant_role(s.tenant_id, array['owner','admin','moderator']::public.tenant_role[])
        or private.is_space_moderator(s.id, s.tenant_id))
  );
$$;

create or replace function private.can_comment_on_post(check_post_id uuid, check_tenant_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.posts p join public.spaces s on s.id = p.space_id and s.tenant_id = p.tenant_id
    where p.id = check_post_id and p.tenant_id = check_tenant_id and s.status = 'published'
      and private.can_access_space(s.id, s.tenant_id) and s.commenting_permission <> 'disabled'
      and (s.commenting_permission = 'members'
        or private.has_tenant_role(s.tenant_id, array['owner','admin','moderator']::public.tenant_role[])
        or private.is_space_moderator(s.id, s.tenant_id))
  );
$$;

create or replace function public.update_space_membership_mode(check_space_id uuid, next_mode text)
returns void language plpgsql security definer set search_path = ''
as $$
declare current_space public.spaces%rowtype;
begin
  select * into current_space from public.spaces where id = check_space_id;
  if current_space.id is null or not private.has_tenant_role(current_space.tenant_id, array['owner','admin']::public.tenant_role[]) then
    raise exception 'Organization administrator access is required';
  end if;
  if next_mode not in ('automatic','optional','invite') then raise exception 'Membership mode is invalid'; end if;
  update public.spaces set membership_mode = next_mode where id = check_space_id;
  perform private.write_audit_log(current_space.tenant_id, (select auth.uid()), 'space.membership_mode_changed', 'space', check_space_id::text, jsonb_build_object('from', current_space.membership_mode, 'to', next_mode));
end;
$$;

create or replace function public.join_space(check_space_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
declare current_space public.spaces%rowtype;
begin
  select * into current_space from public.spaces where id = check_space_id;
  if current_space.id is null or current_space.status <> 'published' or current_space.visibility <> 'members' or current_space.membership_mode <> 'optional' then
    raise exception 'This space is not open for self-service joining';
  end if;
  if not exists (select 1 from public.tenant_memberships where tenant_id = current_space.tenant_id and user_id = (select auth.uid()) and status = 'active') then
    raise exception 'Active organization membership is required';
  end if;
  insert into public.space_members (tenant_id, space_id, user_id, granted_by)
  values (current_space.tenant_id, check_space_id, (select auth.uid()), (select auth.uid()))
  on conflict (space_id, user_id) do nothing;
end;
$$;

create or replace function public.leave_space(check_space_id uuid)
returns void language plpgsql security definer set search_path = ''
as $$
begin
  if exists (select 1 from public.space_moderators where space_id = check_space_id and user_id = (select auth.uid())) then
    raise exception 'Space moderators cannot leave until their assignment is removed';
  end if;
  delete from public.space_members where space_id = check_space_id and user_id = (select auth.uid());
end;
$$;

create or replace function public.set_space_moderator(check_space_id uuid, target_user_id uuid, moderator_enabled boolean)
returns void language plpgsql security definer set search_path = ''
as $$
declare current_tenant_id uuid;
begin
  select tenant_id into current_tenant_id from public.spaces where id = check_space_id;
  if current_tenant_id is null or not private.has_tenant_role(current_tenant_id, array['owner','admin']::public.tenant_role[]) then
    raise exception 'Organization administrator access is required';
  end if;
  if not exists (select 1 from public.tenant_memberships where tenant_id = current_tenant_id and user_id = target_user_id and status = 'active') then
    raise exception 'The selected person is not an active organization member';
  end if;
  if moderator_enabled then
    insert into public.space_moderators (tenant_id, space_id, user_id, assigned_by)
    values (current_tenant_id, check_space_id, target_user_id, (select auth.uid())) on conflict (space_id, user_id) do nothing;
    insert into public.space_members (tenant_id, space_id, user_id, granted_by)
    values (current_tenant_id, check_space_id, target_user_id, (select auth.uid())) on conflict (space_id, user_id) do nothing;
  else
    delete from public.space_moderators where space_id = check_space_id and user_id = target_user_id;
  end if;
  perform private.write_audit_log(current_tenant_id, (select auth.uid()), case when moderator_enabled then 'space.moderator_added' else 'space.moderator_removed' end, 'space_moderator', target_user_id::text, jsonb_build_object('space_id', check_space_id));
end;
$$;

revoke all on function private.is_space_moderator(uuid, uuid) from public;
grant execute on function private.is_space_moderator(uuid, uuid) to authenticated;
revoke all on function public.update_space_membership_mode(uuid, text) from public;
revoke all on function public.join_space(uuid) from public;
revoke all on function public.leave_space(uuid) from public;
revoke all on function public.set_space_moderator(uuid, uuid, boolean) from public;
grant execute on function public.update_space_membership_mode(uuid, text) to authenticated;
grant execute on function public.join_space(uuid) to authenticated;
grant execute on function public.leave_space(uuid) to authenticated;
grant execute on function public.set_space_moderator(uuid, uuid, boolean) to authenticated;
