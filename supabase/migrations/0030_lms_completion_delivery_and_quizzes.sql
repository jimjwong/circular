-- Local transactional delivery, in-app completion notices, and server-graded quizzes.

create table if not exists public.transactional_email_outbox (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  template text not null,
  recipient_email text not null,
  payload jsonb not null default '{}',
  status text not null default 'pending' check (status in ('pending','sent','failed')),
  dedupe_key text not null unique,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
alter table public.transactional_email_outbox enable row level security;
revoke all on public.transactional_email_outbox from anon;
grant select on public.transactional_email_outbox to authenticated;
create policy "admins read email outbox" on public.transactional_email_outbox for select to authenticated using (private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_role[]));

alter table public.notifications drop constraint if exists notifications_kind_check;
alter table public.notifications add constraint notifications_kind_check check (kind in ('post.comment', 'comment.reply', 'post.reaction', 'member.introduction', 'course.completed'));

create or replace function private.deliver_certificate_notification()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  recipient_email text;
  course_title text;
begin
  select profile.email, course.title into recipient_email, course_title
  from public.profiles profile, public.courses course
  where profile.id = new.user_id and course.id = new.course_id;
  insert into public.notifications (tenant_id, user_id, actor_id, kind, entity_type, entity_id, message)
  values (new.tenant_id, new.user_id, null, 'course.completed', 'certificate', new.id, 'Course completed: ' || course_title || '. Your certificate and badge are ready.');
  insert into public.transactional_email_outbox (tenant_id, user_id, template, recipient_email, payload, dedupe_key)
  values (new.tenant_id, new.user_id, 'certificate_issued', recipient_email, jsonb_build_object('certificate_id', new.id, 'course_title', course_title, 'verification_id', new.verification_id), 'certificate:' || new.id::text)
  on conflict (dedupe_key) do nothing;
  return new;
end;
$$;
drop trigger if exists deliver_certificate_notification on public.course_certificates;
create trigger deliver_certificate_notification after insert on public.course_certificates
for each row execute function private.deliver_certificate_notification();

create or replace function public.lms_complete_course_item(check_item_id uuid, submitted_watch_percent integer default null, submitted_score numeric default null, submitted_url text default null)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  selected_item public.module_items%rowtype;
  v_enrollment_id uuid;
  verified_seconds integer;
  required_seconds integer;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select * into selected_item from public.module_items where id = check_item_id;
  if not found then raise exception 'Lesson not found'; end if;
  select id into v_enrollment_id from public.course_enrollments where course_id = selected_item.course_id and user_id = current_user_id and status in ('active','completed');
  if v_enrollment_id is null or not private.can_start_course_item(check_item_id, current_user_id) then raise exception 'Unlocked enrollment required'; end if;
  perform public.lms_start_course_item(check_item_id);
  if selected_item.completion_requirement = 'score_threshold' then raise exception 'Submit the quiz answer for server-side grading'; end if;
  if selected_item.item_type = 'video' then
    select coalesce(time_spent_seconds, 0) into verified_seconds from public.course_item_progress where enrollment_id = v_enrollment_id and module_item_id = selected_item.id;
    required_seconds := greatest(30, floor(selected_item.estimated_minutes * 60 * selected_item.watch_threshold / 100.0));
    if coalesce(submitted_watch_percent, 0) < selected_item.watch_threshold or verified_seconds < required_seconds then
      raise exception 'Watch time has not reached the required threshold';
    end if;
  end if;
  if selected_item.completion_requirement = 'must_submit' and nullif(btrim(submitted_url), '') is null then raise exception 'A submission link is required'; end if;
  update public.course_item_progress set status = 'complete', completed_at = coalesce(completed_at, now()), last_accessed_at = now(), watch_percent = greatest(watch_percent, coalesce(submitted_watch_percent, 0)), submission_url = coalesce(nullif(btrim(submitted_url), ''), submission_url)
  where course_item_progress.enrollment_id = v_enrollment_id and module_item_id = selected_item.id;
  return true;
end;
$$;

create or replace function public.lms_submit_quiz(check_item_id uuid, submitted_answer text)
returns numeric language plpgsql security definer set search_path = '' as $$
declare
  current_user_id uuid := auth.uid();
  selected_item public.module_items%rowtype;
  v_enrollment_id uuid;
  correct_answer text;
  calculated_score numeric;
begin
  if current_user_id is null then raise exception 'Authentication required'; end if;
  select * into selected_item from public.module_items where id = check_item_id and item_type = 'quiz' and completion_requirement = 'score_threshold';
  if not found then raise exception 'Server-graded quiz not found'; end if;
  select id into v_enrollment_id from public.course_enrollments where course_id = selected_item.course_id and user_id = current_user_id and status in ('active','completed');
  if v_enrollment_id is null or not private.can_start_course_item(check_item_id, current_user_id) then raise exception 'Unlocked enrollment required'; end if;
  correct_answer := selected_item.content_body ->> 'correctAnswer';
  if nullif(correct_answer, '') is null then raise exception 'The instructor has not configured an answer key'; end if;
  calculated_score := case when submitted_answer = correct_answer then 100 else 0 end;
  perform public.lms_start_course_item(check_item_id);
  update public.course_item_progress set score = calculated_score, last_accessed_at = now(), status = case when calculated_score >= selected_item.score_threshold then 'complete' else 'in_progress' end, completed_at = case when calculated_score >= selected_item.score_threshold then coalesce(completed_at, now()) else completed_at end
  where course_item_progress.enrollment_id = v_enrollment_id and module_item_id = selected_item.id;
  return calculated_score;
end;
$$;

revoke all on function private.deliver_certificate_notification() from public;
revoke all on function public.lms_submit_quiz(uuid, text) from public;
grant execute on function public.lms_submit_quiz(uuid, text) to authenticated;
