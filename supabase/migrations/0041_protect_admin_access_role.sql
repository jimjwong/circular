-- Only the tenant owner may grant the full-access Admin operational role.

create or replace function public.set_member_access(check_tenant_id uuid, target_user_id uuid, next_tier text, role_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_tenant_permission(check_tenant_id, 'members.manage') then
    raise exception 'Member management permission is required';
  end if;
  if next_tier not in ('guest','associate','professional','corporate') then
    raise exception 'Invalid membership access level';
  end if;
  if exists (
    select 1 from public.tenant_memberships
    where tenant_id = check_tenant_id and user_id = target_user_id and role = 'owner'
  ) then
    raise exception 'The owner access level cannot be changed here';
  end if;
  if exists (
    select 1 from unnest(role_ids) role_id
    where not exists (
      select 1 from public.tenant_access_roles role
      where role.id = role_id and role.tenant_id = check_tenant_id
    )
  ) then
    raise exception 'One or more roles do not belong to this organization';
  end if;
  if exists (
    select 1 from public.tenant_access_roles role
    where role.tenant_id = check_tenant_id and role.id = any(role_ids) and role.slug = 'admin'
  ) and not exists (
    select 1 from public.tenant_memberships membership
    where membership.tenant_id = check_tenant_id
      and membership.user_id = (select auth.uid())
      and membership.role = 'owner'
      and membership.status = 'active'
  ) then
    raise exception 'Only the owner can assign the Admin role';
  end if;

  update public.tenant_memberships set membership_tier = next_tier
    where tenant_id = check_tenant_id and user_id = target_user_id;
  if not found then raise exception 'Member not found'; end if;

  delete from public.tenant_member_access_roles
    where tenant_id = check_tenant_id and user_id = target_user_id;
  insert into public.tenant_member_access_roles (tenant_id, user_id, role_id, assigned_by)
    select check_tenant_id, target_user_id, role_id, (select auth.uid()) from unnest(role_ids) role_id;

  perform private.write_audit_log(
    check_tenant_id,
    (select auth.uid()),
    'member.access_updated',
    'membership',
    target_user_id::text,
    jsonb_build_object('membership_tier', next_tier, 'role_ids', role_ids)
  );
end;
$$;

grant execute on function public.set_member_access(uuid, uuid, text, uuid[]) to authenticated;
