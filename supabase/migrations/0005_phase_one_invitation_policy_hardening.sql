-- Enforce invitation role limits in Postgres as well as in the application.

drop policy if exists "tenant admins create non-owner invitations"
on public.organization_invitations;
drop policy if exists "tenant admins update invitations"
on public.organization_invitations;

create policy "owners create non-owner invitations"
on public.organization_invitations for insert to authenticated
with check (
  role <> 'owner'
  and invited_by = (select auth.uid())
  and private.has_tenant_role(
    tenant_id,
    array['owner']::public.tenant_role[]
  )
);

create policy "admins create moderator and member invitations"
on public.organization_invitations for insert to authenticated
with check (
  role in ('moderator', 'member')
  and invited_by = (select auth.uid())
  and private.has_tenant_role(
    tenant_id,
    array['admin']::public.tenant_role[]
  )
);

create policy "owners update non-owner invitations"
on public.organization_invitations for update to authenticated
using (
  role <> 'owner'
  and private.has_tenant_role(
    tenant_id,
    array['owner']::public.tenant_role[]
  )
)
with check (
  role <> 'owner'
  and private.has_tenant_role(
    tenant_id,
    array['owner']::public.tenant_role[]
  )
);

create policy "admins update moderator and member invitations"
on public.organization_invitations for update to authenticated
using (
  role in ('moderator', 'member')
  and private.has_tenant_role(
    tenant_id,
    array['admin']::public.tenant_role[]
  )
)
with check (
  role in ('moderator', 'member')
  and private.has_tenant_role(
    tenant_id,
    array['admin']::public.tenant_role[]
  )
);
