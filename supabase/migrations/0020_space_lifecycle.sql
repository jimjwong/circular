-- Reversible lifecycle controls for spaces.

alter table public.spaces add column if not exists status text not null default 'published';
alter table public.spaces drop constraint if exists spaces_status_check;
alter table public.spaces add constraint spaces_status_check check (status in ('draft', 'published', 'archived'));

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
    join public.tenant_memberships tm on tm.tenant_id = s.tenant_id and tm.user_id = (select auth.uid()) and tm.status = 'active'
    where s.id = check_space_id and s.tenant_id = check_tenant_id
      and (s.status = 'published' or tm.role in ('owner', 'admin','moderator'))
      and (s.visibility = 'members' or tm.role in ('owner','admin','moderator') or exists (
        select 1 from public.space_members sm where sm.space_id = s.id and sm.user_id = (select auth.uid())
      ))
  );
$$;

create or replace function private.can_post_to_space(check_space_id uuid, check_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.spaces s
    where s.id = check_space_id and s.tenant_id = check_tenant_id and s.status = 'published'
      and private.can_access_space(s.id, s.tenant_id)
      and (s.posting_permission = 'members' or private.has_tenant_role(s.tenant_id, array['owner','admin','moderator']::public.tenant_role[]))
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
    select 1 from public.posts p join public.spaces s on s.id = p.space_id and s.tenant_id = p.tenant_id
    where p.id = check_post_id and p.tenant_id = check_tenant_id and s.status = 'published'
      and private.can_access_space(s.id, s.tenant_id) and s.commenting_permission <> 'disabled'
      and (s.commenting_permission = 'members' or private.has_tenant_role(s.tenant_id, array['owner','admin','moderator']::public.tenant_role[]))
  );
$$;

create or replace function public.update_space_status(check_space_id uuid, next_status text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare current_space public.spaces%rowtype;
begin
  select * into current_space from public.spaces where id = check_space_id;
  if current_space.id is null or not private.has_tenant_role(current_space.tenant_id, array['owner','admin']::public.tenant_role[]) then
    raise exception 'Organization administrator access is required';
  end if;
  if next_status not in ('draft','published','archived') then raise exception 'Space status is invalid'; end if;
  update public.spaces set status = next_status where id = check_space_id;
  perform private.write_audit_log(current_space.tenant_id, (select auth.uid()), 'space.status_changed', 'space', check_space_id::text, jsonb_build_object('from', current_space.status, 'to', next_status));
end;
$$;

revoke all on function public.update_space_status(uuid, text) from public;
grant execute on function public.update_space_status(uuid, text) to authenticated;
