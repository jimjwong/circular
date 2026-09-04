-- Per-space presentation preferences.

alter table public.spaces
  add column if not exists layout text not null default 'feed',
  add column if not exists show_right_sidebar boolean not null default true,
  add column if not exists show_members_tab boolean not null default true;

alter table public.spaces drop constraint if exists spaces_layout_check;
alter table public.spaces add constraint spaces_layout_check check (layout in ('feed', 'list', 'card'));

create or replace function public.update_space_layout(
  check_space_id uuid,
  space_layout text,
  right_sidebar boolean,
  members_tab boolean
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
  if space_layout not in ('feed', 'list', 'card') then raise exception 'Space layout is invalid'; end if;
  update public.spaces set layout = space_layout, show_right_sidebar = right_sidebar, show_members_tab = members_tab where id = check_space_id;
  perform private.write_audit_log(current_space.tenant_id, (select auth.uid()), 'space.layout_updated', 'space', check_space_id::text, jsonb_build_object('layout', space_layout, 'right_sidebar', right_sidebar, 'members_tab', members_tab));
end;
$$;

revoke all on function public.update_space_layout(uuid, text, boolean, boolean) from public;
grant execute on function public.update_space_layout(uuid, text, boolean, boolean) to authenticated;
