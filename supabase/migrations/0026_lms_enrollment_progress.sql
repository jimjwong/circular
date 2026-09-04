-- Secure learner enrollment, item access, heartbeat accounting, and progress rollups.

alter table public.learning_hours_ledger add column if not exists heartbeat_key uuid;
update public.learning_hours_ledger set heartbeat_key = gen_random_uuid() where heartbeat_key is null;
alter table public.learning_hours_ledger alter column heartbeat_key set not null;
create unique index if not exists learning_hours_ledger_heartbeat_key_key on public.learning_hours_ledger (heartbeat_key);

create or replace function private.can_access_course(check_course_id uuid, check_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.courses c
    join public.tenant_memberships tm
      on tm.tenant_id = c.tenant_id
     and tm.user_id = (select auth.uid())
     and tm.status = 'active'
    where c.id = check_course_id
      and c.tenant_id = check_tenant_id
      and (
        tm.role in ('owner','admin')
        or exists (select 1 from public.course_instructors ci where ci.course_id = c.id and ci.user_id = (select auth.uid()))
        or (
          c.status = 'published'
          and (
            c.access_mode <> 'private'
            or exists (
              select 1 from public.course_enrollments e
              where e.course_id = c.id and e.user_id = (select auth.uid()) and e.status in ('active','completed')
            )
          )
        )
      )
  );
$$;

create or replace function private.can_start_course_item(check_item_id uuid, check_user_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.module_items item
    join public.course_modules module on module.id = item.module_id
    join public.courses course on course.id = item.course_id
    join public.course_enrollments enrollment
      on enrollment.course_id = course.id
     and enrollment.user_id = check_user_id
     and enrollment.status in ('active','completed')
    where item.id = check_item_id
      and course.status = 'published'
      and (module.unlock_requirement <> 'date' or module.unlock_at <= now())
      and (
        module.unlock_requirement <> 'previous_module_complete'
        or not exists (
          select 1
          from public.course_modules prior_module
          join public.module_items prior_item on prior_item.module_id = prior_module.id and prior_item.is_required
          left join public.course_item_progress prior_progress
            on prior_progress.enrollment_id = enrollment.id
           and prior_progress.module_item_id = prior_item.id
           and prior_progress.status = 'complete'
          where prior_module.course_id = course.id
            and prior_module.position < module.position
            and prior_progress.id is null
        )
      )
      and (
        course.navigation_mode = 'free'
        or not exists (
          select 1
          from public.module_items prior_item
          join public.course_modules prior_module on prior_module.id = prior_item.module_id
          left join public.course_item_progress prior_progress
            on prior_progress.enrollment_id = enrollment.id
           and prior_progress.module_item_id = prior_item.id
           and prior_progress.status = 'complete'
          where prior_item.course_id = course.id
            and prior_item.is_required
            and (prior_module.position, prior_item.position, prior_item.id) < (module.position, item.position, item.id)
            and prior_progress.id is null
        )
      )
  );
$$;

create or replace function public.lms_enroll_course(check_course_id uuid, use_dummy_payment boolean default false)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  selected_course public.courses%rowtype;
  v_enrollment_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select * into selected_course from public.courses where id = check_course_id;
  if not found or selected_course.status <> 'published' then raise exception 'Course is not available'; end if;
  if not public.is_tenant_member(selected_course.tenant_id) then raise exception 'Active organization membership required'; end if;
  if selected_course.access_mode = 'private' then raise exception 'This course requires an administrator invitation'; end if;
  if selected_course.access_mode = 'paid' and not use_dummy_payment then raise exception 'Payment is required'; end if;

  if selected_course.access_mode = 'paid' then
    insert into public.course_payments (tenant_id, course_id, user_id, amount_cents, currency, provider, provider_reference, status)
    values (selected_course.tenant_id, selected_course.id, current_user_id, selected_course.price_cents, selected_course.currency, 'dummy', 'dummy_' || gen_random_uuid()::text, 'succeeded');
  end if;

  insert into public.course_enrollments (tenant_id, course_id, user_id, status, enrolled_at, dropped_at)
  values (selected_course.tenant_id, selected_course.id, current_user_id, 'active', now(), null)
  on conflict (course_id, user_id) do update set status = case when public.course_enrollments.status = 'completed' then 'completed' else 'active' end, dropped_at = null
  returning id into v_enrollment_id;
  return v_enrollment_id;
end;
$$;

create or replace function public.lms_start_course_item(check_item_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  selected_item public.module_items%rowtype;
  v_enrollment_id uuid;
  progress_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select * into selected_item from public.module_items where id = check_item_id;
  if not found then raise exception 'Lesson not found'; end if;
  select id into v_enrollment_id from public.course_enrollments where course_id = selected_item.course_id and user_id = current_user_id and status in ('active','completed');
  if v_enrollment_id is null then raise exception 'Enrollment required'; end if;
  if not private.can_start_course_item(check_item_id, current_user_id) then raise exception 'Complete the required earlier lessons first'; end if;

  insert into public.course_item_progress (tenant_id, enrollment_id, module_item_id, user_id, status, first_accessed_at, last_accessed_at)
  values (selected_item.tenant_id, v_enrollment_id, selected_item.id, current_user_id, 'in_progress', now(), now())
  on conflict (enrollment_id, module_item_id) do update set
    status = case when public.course_item_progress.status = 'complete' then 'complete' else 'in_progress' end,
    first_accessed_at = coalesce(public.course_item_progress.first_accessed_at, now()),
    last_accessed_at = now()
  returning id into progress_id;
  update public.course_enrollments set last_accessed_at = now() where id = v_enrollment_id;
  return progress_id;
end;
$$;

create or replace function public.lms_can_open_course_item(check_item_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.module_items item
    where item.id = check_item_id
      and (
        item.is_preview
        or private.can_manage_course(item.course_id, item.tenant_id)
        or private.can_start_course_item(item.id, (select auth.uid()))
      )
  );
$$;

create or replace function public.lms_record_heartbeat(check_item_id uuid, check_session_key uuid, check_heartbeat_key uuid, check_seconds integer)
returns integer language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  selected_item public.module_items%rowtype;
  v_enrollment_id uuid;
  accepted_seconds integer := least(greatest(check_seconds, 1), 60);
  inserted_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  if check_session_key is null or check_heartbeat_key is null then raise exception 'Session identifiers are required'; end if;
  select * into selected_item from public.module_items where id = check_item_id;
  if not found then raise exception 'Lesson not found'; end if;
  select id into v_enrollment_id from public.course_enrollments where course_id = selected_item.course_id and user_id = current_user_id and status in ('active','completed');
  if v_enrollment_id is null or not private.can_start_course_item(check_item_id, current_user_id) then raise exception 'Unlocked enrollment required'; end if;
  perform public.lms_start_course_item(check_item_id);

  insert into public.learning_hours_ledger (tenant_id, user_id, enrollment_id, module_item_id, seconds_logged, session_key, heartbeat_key)
  values (selected_item.tenant_id, current_user_id, v_enrollment_id, selected_item.id, accepted_seconds, check_session_key, check_heartbeat_key)
  on conflict (heartbeat_key) do nothing returning id into inserted_id;
  if inserted_id is null then return 0; end if;

  update public.course_item_progress
  set time_spent_seconds = time_spent_seconds + accepted_seconds, last_accessed_at = now()
  where course_item_progress.enrollment_id = v_enrollment_id and module_item_id = selected_item.id;
  update public.course_enrollments set last_accessed_at = now() where id = v_enrollment_id;
  return accepted_seconds;
end;
$$;

create or replace function public.lms_complete_course_item(check_item_id uuid, submitted_watch_percent integer default null, submitted_score numeric default null, submitted_url text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  selected_item public.module_items%rowtype;
  v_enrollment_id uuid;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select * into selected_item from public.module_items where id = check_item_id;
  if not found then raise exception 'Lesson not found'; end if;
  select id into v_enrollment_id from public.course_enrollments where course_id = selected_item.course_id and user_id = current_user_id and status in ('active','completed');
  if v_enrollment_id is null or not private.can_start_course_item(check_item_id, current_user_id) then raise exception 'Active unlocked enrollment required'; end if;
  perform public.lms_start_course_item(check_item_id);

  if selected_item.item_type = 'video' and coalesce(submitted_watch_percent, 0) < selected_item.watch_threshold then
    raise exception 'Watch at least % percent of this video', selected_item.watch_threshold;
  end if;
  if selected_item.completion_requirement = 'score_threshold' and coalesce(submitted_score, -1) < selected_item.score_threshold then
    raise exception 'A score of at least % percent is required', selected_item.score_threshold;
  end if;
  if selected_item.completion_requirement = 'must_submit' and nullif(btrim(submitted_url), '') is null then
    raise exception 'A submission link is required';
  end if;

  update public.course_item_progress
  set status = 'complete', completed_at = coalesce(completed_at, now()), last_accessed_at = now(),
      watch_percent = greatest(watch_percent, coalesce(submitted_watch_percent, 0)),
      score = coalesce(submitted_score, score), submission_url = coalesce(nullif(btrim(submitted_url), ''), submission_url)
  where course_item_progress.enrollment_id = v_enrollment_id and module_item_id = selected_item.id;
  return true;
end;
$$;

create or replace function public.lms_course_progress(check_course_id uuid)
returns table (enrollment_id uuid, required_items integer, completed_items integer, percent_complete integer, time_spent_seconds bigint, last_accessed_item_id uuid)
language sql stable security definer set search_path = '' as $$
  with enrollment as (
    select e.* from public.course_enrollments e
    where e.course_id = check_course_id and e.user_id = (select auth.uid())
  ), totals as (
    select count(*) filter (where i.is_required)::integer as required_items
    from public.module_items i where i.course_id = check_course_id
  ), progress as (
    select count(*) filter (where p.status = 'complete' and i.is_required)::integer as completed_items,
           coalesce(sum(p.time_spent_seconds), 0)::bigint as time_spent_seconds
    from enrollment e
    left join public.course_item_progress p on p.enrollment_id = e.id
    left join public.module_items i on i.id = p.module_item_id
  ), last_item as (
    select p.module_item_id from enrollment e join public.course_item_progress p on p.enrollment_id = e.id
    order by p.last_accessed_at desc nulls last limit 1
  )
  select e.id, t.required_items, p.completed_items,
         case when t.required_items = 0 then 0 else floor((p.completed_items::numeric / t.required_items) * 100)::integer end,
         p.time_spent_seconds, (select module_item_id from last_item)
  from enrollment e cross join totals t cross join progress p;
$$;

revoke all on function private.can_start_course_item(uuid, uuid) from public;
grant execute on function private.can_start_course_item(uuid, uuid) to authenticated;
revoke all on function public.lms_enroll_course(uuid, boolean) from public;
revoke all on function public.lms_start_course_item(uuid) from public;
revoke all on function public.lms_can_open_course_item(uuid) from public;
revoke all on function public.lms_record_heartbeat(uuid, uuid, uuid, integer) from public;
revoke all on function public.lms_complete_course_item(uuid, integer, numeric, text) from public;
revoke all on function public.lms_course_progress(uuid) from public;
grant execute on function public.lms_enroll_course(uuid, boolean) to authenticated;
grant execute on function public.lms_start_course_item(uuid) to authenticated;
grant execute on function public.lms_can_open_course_item(uuid) to authenticated;
grant execute on function public.lms_record_heartbeat(uuid, uuid, uuid, integer) to authenticated;
grant execute on function public.lms_complete_course_item(uuid, integer, numeric, text) to authenticated;
grant execute on function public.lms_course_progress(uuid) to authenticated;
