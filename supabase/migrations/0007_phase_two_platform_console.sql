-- Phase 2: platform staff visibility and tenant lifecycle controls.

create policy "platform staff read tenants"
on public.tenants for select to authenticated
using (
  private.is_platform_staff(
    array['super_admin', 'support_admin', 'billing_admin']::public.platform_role[]
  )
);

create policy "platform staff read memberships"
on public.tenant_memberships for select to authenticated
using (
  private.is_platform_staff(
    array['super_admin', 'support_admin', 'billing_admin']::public.platform_role[]
  )
);

create policy "platform staff read profiles"
on public.profiles for select to authenticated
using (
  private.is_platform_staff(
    array['super_admin', 'support_admin', 'billing_admin']::public.platform_role[]
  )
);

create policy "platform staff read audit logs"
on public.audit_logs for select to authenticated
using (
  private.is_platform_staff(
    array['super_admin', 'support_admin', 'billing_admin']::public.platform_role[]
  )
);

create or replace function public.update_tenant_lifecycle(
  check_tenant_id uuid,
  next_status public.tenant_status,
  change_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  previous_status public.tenant_status;
  clean_reason text := nullif(trim(change_reason), '');
begin
  if not private.is_platform_staff(array['super_admin']::public.platform_role[]) then
    raise exception 'Only an active super administrator can change organization status';
  end if;

  if next_status in ('suspended', 'cancelled') and clean_reason is null then
    raise exception 'A reason is required when suspending or cancelling an organization';
  end if;

  select status into previous_status
  from public.tenants
  where id = check_tenant_id
  for update;

  if previous_status is null then
    raise exception 'Organization not found';
  end if;

  if previous_status = next_status then
    return;
  end if;

  update public.tenants
  set status = next_status,
      suspended_at = case when next_status = 'suspended' then now() else null end,
      cancelled_at = case when next_status = 'cancelled' then now() else null end,
      updated_at = now()
  where id = check_tenant_id;

  perform private.write_audit_log(
    check_tenant_id,
    caller_id,
    'platform.organization_status_changed',
    'tenant',
    check_tenant_id::text,
    jsonb_build_object(
      'previous_status', previous_status::text,
      'next_status', next_status::text,
      'reason', clean_reason
    )
  );
end;
$$;

revoke all on function public.update_tenant_lifecycle(uuid, public.tenant_status, text) from public;
grant execute on function public.update_tenant_lifecycle(uuid, public.tenant_status, text) to authenticated;
