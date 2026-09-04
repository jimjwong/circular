-- Permit INSERT ... RETURNING for course managers. A SELECT policy that only
-- calls a stable table lookup cannot see the row inserted by the same command.

drop policy if exists "members read available courses" on public.courses;
create policy "members read available courses"
on public.courses for select to authenticated
using (
  private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_role[])
  or (status = 'published' and public.is_tenant_member(tenant_id))
  or exists (
    select 1 from public.course_instructors ci
    where ci.course_id = courses.id and ci.tenant_id = courses.tenant_id and ci.user_id = (select auth.uid())
  )
);
