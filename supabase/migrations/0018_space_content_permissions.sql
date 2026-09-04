-- Enforce per-space publishing and commenting permissions in RLS.

alter table public.spaces
  add column if not exists posting_permission text not null default 'members',
  add column if not exists commenting_permission text not null default 'members';

alter table public.spaces drop constraint if exists spaces_posting_permission_check;
alter table public.spaces add constraint spaces_posting_permission_check check (posting_permission in ('members', 'admins'));
alter table public.spaces drop constraint if exists spaces_commenting_permission_check;
alter table public.spaces add constraint spaces_commenting_permission_check check (commenting_permission in ('members', 'admins', 'disabled'));

create or replace function private.can_post_to_space(check_space_id uuid, check_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.spaces s
    where s.id = check_space_id and s.tenant_id = check_tenant_id
      and private.can_access_space(s.id, s.tenant_id)
      and (
        s.posting_permission = 'members'
        or private.has_tenant_role(s.tenant_id, array['owner', 'admin', 'moderator']::public.tenant_role[])
      )
  );
$$;

create or replace function private.can_comment_on_post(check_post_id uuid, check_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.posts p
    join public.spaces s on s.id = p.space_id and s.tenant_id = p.tenant_id
    where p.id = check_post_id and p.tenant_id = check_tenant_id
      and private.can_access_space(s.id, s.tenant_id)
      and s.commenting_permission <> 'disabled'
      and (
        s.commenting_permission = 'members'
        or private.has_tenant_role(s.tenant_id, array['owner', 'admin', 'moderator']::public.tenant_role[])
      )
  );
$$;

drop policy if exists "members create posts in accessible spaces" on public.posts;
create policy "members create permitted space posts"
on public.posts for insert to authenticated
with check (author_id = (select auth.uid()) and private.can_post_to_space(space_id, tenant_id));

drop policy if exists "members create comments on accessible posts" on public.comments;
create policy "members create permitted space comments"
on public.comments for insert to authenticated
with check (author_id = (select auth.uid()) and private.can_comment_on_post(post_id, tenant_id));

create or replace function public.update_space_content_permissions(
  check_space_id uuid,
  post_permission text,
  comment_permission text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_space public.spaces%rowtype;
begin
  select * into current_space from public.spaces where id = check_space_id;
  if current_space.id is null or not private.has_tenant_role(current_space.tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Organization administrator access is required';
  end if;
  if post_permission not in ('members', 'admins') then raise exception 'Posting permission is invalid'; end if;
  if comment_permission not in ('members', 'admins', 'disabled') then raise exception 'Commenting permission is invalid'; end if;
  update public.spaces set posting_permission = post_permission, commenting_permission = comment_permission where id = check_space_id;
  perform private.write_audit_log(current_space.tenant_id, (select auth.uid()), 'space.permissions_updated', 'space', check_space_id::text, jsonb_build_object('posting', post_permission, 'commenting', comment_permission));
end;
$$;

revoke all on function public.update_space_content_permissions(uuid, text, text) from public;
grant execute on function public.update_space_content_permissions(uuid, text, text) to authenticated;
