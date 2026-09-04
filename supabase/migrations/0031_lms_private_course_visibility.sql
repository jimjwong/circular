-- Keep paid/free courses discoverable while requiring enrollment for private courses.
-- The policy stays direct so INSERT ... RETURNING remains visible to course creators.

drop policy if exists "members read available courses" on public.courses;
create policy "members read available courses" on public.courses for select to authenticated using (
  private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_role[])
  or exists (select 1 from public.course_instructors ci where ci.course_id = courses.id and ci.tenant_id = courses.tenant_id and ci.user_id = (select auth.uid()))
  or (
    status = 'published'
    and public.is_tenant_member(tenant_id)
    and (
      access_mode <> 'private'
      or exists (select 1 from public.course_enrollments enrollment where enrollment.course_id = courses.id and enrollment.user_id = (select auth.uid()) and enrollment.status in ('active','completed'))
    )
  )
);
