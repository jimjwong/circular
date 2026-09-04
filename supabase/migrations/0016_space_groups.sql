-- Space groups let organization admins organize related community spaces.

create or replace function public.create_space_group(
  check_tenant_id uuid,
  group_name text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  clean_name text := nullif(trim(group_name), '');
  new_group_id uuid;
  next_position integer;
begin
  if not private.has_tenant_role(check_tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Organization administrator access is required';
  end if;
  if clean_name is null or length(clean_name) > 60 then
    raise exception 'Group name must contain 1 to 60 characters';
  end if;
  if exists (select 1 from public.space_groups where tenant_id = check_tenant_id and lower(name) = lower(clean_name)) then
    raise exception 'A space group with this name already exists';
  end if;

  select coalesce(max(position), -1) + 1 into next_position
  from public.space_groups where tenant_id = check_tenant_id;

  insert into public.space_groups (tenant_id, name, position)
  values (check_tenant_id, clean_name, next_position)
  returning id into new_group_id;

  perform private.write_audit_log(check_tenant_id, (select auth.uid()), 'space_group.created', 'space_group', new_group_id::text, jsonb_build_object('name', clean_name));
  return new_group_id;
end;
$$;

create or replace function public.rename_space_group(
  check_group_id uuid,
  group_name text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_group public.space_groups%rowtype;
  clean_name text := nullif(trim(group_name), '');
begin
  select * into current_group from public.space_groups where id = check_group_id;
  if current_group.id is null or not private.has_tenant_role(current_group.tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Organization administrator access is required';
  end if;
  if clean_name is null or length(clean_name) > 60 then
    raise exception 'Group name must contain 1 to 60 characters';
  end if;
  if exists (select 1 from public.space_groups where tenant_id = current_group.tenant_id and id <> check_group_id and lower(name) = lower(clean_name)) then
    raise exception 'A space group with this name already exists';
  end if;
  update public.space_groups set name = clean_name where id = check_group_id;
  perform private.write_audit_log(current_group.tenant_id, (select auth.uid()), 'space_group.renamed', 'space_group', check_group_id::text, jsonb_build_object('name', clean_name));
end;
$$;

create or replace function public.set_space_group(
  check_space_id uuid,
  check_group_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_space public.spaces%rowtype;
begin
  select * into current_space from public.spaces where id = check_space_id;
  if current_space.id is null or not private.has_tenant_role(current_space.tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Organization administrator access is required';
  end if;
  if check_group_id is not null and not exists (
    select 1 from public.space_groups where id = check_group_id and tenant_id = current_space.tenant_id
  ) then
    raise exception 'The selected space group is unavailable';
  end if;
  update public.spaces set group_id = check_group_id where id = check_space_id;
  perform private.write_audit_log(current_space.tenant_id, (select auth.uid()), 'space.group_changed', 'space', check_space_id::text, jsonb_build_object('group_id', check_group_id));
end;
$$;

revoke all on function public.create_space_group(uuid, text) from public;
revoke all on function public.rename_space_group(uuid, text) from public;
revoke all on function public.set_space_group(uuid, uuid) from public;
grant execute on function public.create_space_group(uuid, text) to authenticated;
grant execute on function public.rename_space_group(uuid, text) to authenticated;
grant execute on function public.set_space_group(uuid, uuid) to authenticated;
