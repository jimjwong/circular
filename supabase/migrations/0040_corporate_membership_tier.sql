-- Add Corporate Member as the highest membership access tier.

alter table public.tenant_memberships drop constraint if exists tenant_memberships_membership_tier_check;
alter table public.tenant_memberships add constraint tenant_memberships_membership_tier_check
  check (membership_tier in ('guest', 'associate', 'professional', 'corporate'));

alter table public.spaces drop constraint if exists spaces_minimum_access_tier_check;
alter table public.spaces add constraint spaces_minimum_access_tier_check
  check (minimum_access_tier in ('guest', 'associate', 'professional', 'corporate'));

alter table public.courses drop constraint if exists courses_minimum_access_tier_check;
alter table public.courses add constraint courses_minimum_access_tier_check
  check (minimum_access_tier in ('guest', 'associate', 'professional', 'corporate'));

create or replace function private.membership_tier_rank(tier text)
returns integer language sql immutable set search_path = '' as $$
  select case tier when 'corporate' then 4 when 'professional' then 3 when 'associate' then 2 when 'guest' then 1 else 0 end;
$$;

create or replace function public.set_member_access(check_tenant_id uuid, target_user_id uuid, next_tier text, role_ids uuid[])
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not private.has_tenant_permission(check_tenant_id, 'members.manage') then
    raise exception 'Member management permission is required';
  end if;
  if next_tier not in ('guest','associate','professional','corporate') then raise exception 'Invalid membership access level'; end if;
  if exists (select 1 from public.tenant_memberships where tenant_id = check_tenant_id and user_id = target_user_id and role = 'owner') then
    raise exception 'The owner access level cannot be changed here';
  end if;
  if exists (select 1 from unnest(role_ids) role_id where not exists (
    select 1 from public.tenant_access_roles role where role.id = role_id and role.tenant_id = check_tenant_id
  )) then raise exception 'One or more roles do not belong to this organization'; end if;

  update public.tenant_memberships set membership_tier = next_tier
    where tenant_id = check_tenant_id and user_id = target_user_id;
  if not found then raise exception 'Member not found'; end if;
  delete from public.tenant_member_access_roles where tenant_id = check_tenant_id and user_id = target_user_id;
  insert into public.tenant_member_access_roles (tenant_id, user_id, role_id, assigned_by)
    select check_tenant_id, target_user_id, role_id, (select auth.uid()) from unnest(role_ids) role_id;
  perform private.write_audit_log(check_tenant_id, (select auth.uid()), 'member.access_updated', 'membership', target_user_id::text,
    jsonb_build_object('membership_tier', next_tier, 'role_ids', role_ids));
end;
$$;

grant execute on function public.set_member_access(uuid, uuid, text, uuid[]) to authenticated;
