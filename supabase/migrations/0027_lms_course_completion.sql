-- Derive enrollment completion from required item progress and the course threshold.

create or replace function private.refresh_course_completion(check_enrollment_id uuid)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  required_count integer;
  completed_count integer;
  required_percent integer;
  is_complete boolean;
begin
  select count(*) filter (where item.is_required), course.completion_percent
    into required_count, required_percent
  from public.course_enrollments enrollment
  join public.courses course on course.id = enrollment.course_id
  left join public.module_items item on item.course_id = course.id
  where enrollment.id = check_enrollment_id
  group by course.completion_percent;
  if required_count is null or required_count = 0 then return false; end if;

  select count(*) into completed_count
  from public.course_item_progress progress
  join public.module_items item on item.id = progress.module_item_id and item.is_required
  where progress.enrollment_id = check_enrollment_id and progress.status = 'complete';
  is_complete := floor((completed_count::numeric / required_count) * 100) >= required_percent;
  if is_complete then
    update public.course_enrollments set status = 'completed', completed_at = coalesce(completed_at, now()), last_accessed_at = now() where id = check_enrollment_id;
  end if;
  return is_complete;
end;
$$;

create or replace function private.sync_course_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'complete' and (old.status is distinct from new.status) then
    perform private.refresh_course_completion(new.enrollment_id);
  end if;
  return new;
end;
$$;

drop trigger if exists sync_course_completion_after_progress on public.course_item_progress;
create trigger sync_course_completion_after_progress
after update of status on public.course_item_progress
for each row execute function private.sync_course_completion();

revoke all on function private.refresh_course_completion(uuid) from public;
revoke all on function private.sync_course_completion() from public;
