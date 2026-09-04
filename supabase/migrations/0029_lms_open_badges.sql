-- Course-completion badge eligibility and public Open Badges verification.

create unique index if not exists course_badges_completion_course_key on public.course_badges (course_id) where award_mode = 'course_completion';

create or replace function private.issue_course_badge(check_enrollment_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  v_badge_id uuid;
  v_award_id uuid;
begin
  insert into public.course_badges (tenant_id, course_id, name, description, image_url, criteria_text, award_mode, open_badge_json, created_by)
  select enrollment.tenant_id, course.id, course.title || ' Completion Badge',
         'Recognizes successful completion of ' || course.title || '.',
         '/badges/professional-learning.svg',
         'Complete the required course items and meet the configured completion threshold.',
         'course_completion', jsonb_build_object('version', '3.0', 'achievementType', 'Certificate'), course.created_by
  from public.course_enrollments enrollment join public.courses course on course.id = enrollment.course_id
  where enrollment.id = check_enrollment_id and enrollment.status = 'completed'
  on conflict (course_id) where award_mode = 'course_completion' do update set name = excluded.name, description = excluded.description
  returning id into v_badge_id;

  insert into public.course_badge_awards (tenant_id, badge_id, user_id, course_id, recipient_name, assertion_json)
  select enrollment.tenant_id, v_badge_id, enrollment.user_id, enrollment.course_id,
         coalesce(nullif(profile.display_name, ''), 'Course participant'),
         jsonb_build_object('status', 'pending_signature', 'standard', 'Open Badges 3.0')
  from public.course_enrollments enrollment left join public.profiles profile on profile.id = enrollment.user_id
  where enrollment.id = check_enrollment_id and enrollment.status = 'completed'
  on conflict (badge_id, user_id, course_id) do update set recipient_name = excluded.recipient_name
  returning id into v_award_id;
  return v_award_id;
end;
$$;

create or replace function private.issue_badge_after_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then perform private.issue_course_badge(new.id); end if;
  return new;
end;
$$;

drop trigger if exists issue_badge_after_completion on public.course_enrollments;
create trigger issue_badge_after_completion after update of status on public.course_enrollments
for each row execute function private.issue_badge_after_completion();
select private.issue_course_badge(id) from public.course_enrollments where status = 'completed';

create or replace function public.verify_course_badge(check_verification_id uuid)
returns table (award_id uuid, badge_name text, badge_description text, badge_image_url text, criteria_text text, recipient_name text, course_title text, awarded_at timestamptz, credential_status text)
language sql stable security definer set search_path = '' as $$
  select award.id, badge.name, badge.description, badge.image_url, badge.criteria_text, award.recipient_name, course.title, award.awarded_at,
         case when award.revoked then 'revoked' else 'valid' end
  from public.course_badge_awards award
  join public.course_badges badge on badge.id = award.badge_id
  left join public.courses course on course.id = award.course_id
  where award.verification_id = check_verification_id;
$$;

create or replace function public.get_open_badge_credential(check_verification_id uuid)
returns jsonb language sql stable security definer set search_path = '' as $$
  select case when award.revoked then award.assertion_json || jsonb_build_object('credentialStatus', 'revoked') else award.assertion_json end
  from public.course_badge_awards award where award.verification_id = check_verification_id;
$$;

revoke all on function private.issue_course_badge(uuid) from public;
revoke all on function private.issue_badge_after_completion() from public;
revoke all on function public.verify_course_badge(uuid) from public;
revoke all on function public.get_open_badge_credential(uuid) from public;
grant execute on function public.verify_course_badge(uuid) to anon, authenticated;
grant execute on function public.get_open_badge_credential(uuid) to anon, authenticated;
