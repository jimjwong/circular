-- Draft events are visible only to organization administrators.
drop policy "tenant members can read" on public.events;

create policy "members read published events"
on public.events for select to authenticated
using (
  public.is_tenant_member(tenant_id)
  and (
    status <> 'draft'
    or private.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_role[])
  )
);
