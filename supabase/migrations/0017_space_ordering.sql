-- Persist administrator-defined ordering for spaces and their groups.

create or replace function public.reorder_spaces(
  check_tenant_id uuid,
  ordered_space_ids uuid[]
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  requested_count integer := coalesce(cardinality(ordered_space_ids), 0);
  valid_count integer;
begin
  if not private.has_tenant_role(check_tenant_id, array['owner', 'admin']::public.tenant_role[]) then
    raise exception 'Organization administrator access is required';
  end if;
  if requested_count = 0 then raise exception 'At least one space is required'; end if;
  if (select count(distinct id) from unnest(ordered_space_ids) as ids(id)) <> requested_count then
    raise exception 'Space ordering contains duplicates';
  end if;
  select count(*) into valid_count from public.spaces where tenant_id = check_tenant_id and id = any(ordered_space_ids);
  if valid_count <> requested_count then raise exception 'Space ordering contains an unavailable space'; end if;

  update public.spaces as spaces
  set position = ordered.ordinality - 1
  from unnest(ordered_space_ids) with ordinality as ordered(id, ordinality)
  where spaces.id = ordered.id and spaces.tenant_id = check_tenant_id;

  perform private.write_audit_log(check_tenant_id, (select auth.uid()), 'spaces.reordered', 'tenant', check_tenant_id::text, jsonb_build_object('space_ids', ordered_space_ids));
end;
$$;

revoke all on function public.reorder_spaces(uuid, uuid[]) from public;
grant execute on function public.reorder_spaces(uuid, uuid[]) to authenticated;
