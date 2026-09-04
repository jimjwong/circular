-- Automatic certificate issuance and privacy-preserving public verification.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('course-certificates', 'course-certificates', false, 5242880, array['application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create table if not exists public.verification_rate_limits (
  identifier_hash text not null,
  window_started_at timestamptz not null,
  request_count integer not null default 1,
  primary key (identifier_hash, window_started_at)
);
alter table public.verification_rate_limits enable row level security;
revoke all on public.verification_rate_limits from anon, authenticated;

drop policy if exists "course managers update certificates" on public.course_certificates;
create policy "course managers update certificates" on public.course_certificates for update to authenticated
using (private.can_manage_course(course_id, tenant_id)) with check (private.can_manage_course(course_id, tenant_id));
grant update on public.course_certificates to authenticated;

create or replace function private.issue_course_certificate(check_enrollment_id uuid)
returns uuid language plpgsql security definer set search_path = '' as $$
declare
  certificate_id uuid;
begin
  insert into public.course_certificates (tenant_id, user_id, course_id, enrollment_id, recipient_name, issuing_organization, issued_at, expires_at)
  select enrollment.tenant_id, enrollment.user_id, enrollment.course_id, enrollment.id,
         coalesce(nullif(profile.display_name, ''), 'Course participant'),
         'Asia Professional Speakers Singapore', now(),
         case when course.certificate_expiry_months is null then null else now() + make_interval(months => course.certificate_expiry_months) end
  from public.course_enrollments enrollment
  join public.courses course on course.id = enrollment.course_id
  left join public.profiles profile on profile.id = enrollment.user_id
  where enrollment.id = check_enrollment_id and enrollment.status = 'completed'
  on conflict (enrollment_id) do update set recipient_name = excluded.recipient_name
  returning id into certificate_id;
  return certificate_id;
end;
$$;

create or replace function private.issue_certificate_after_completion()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'completed' and old.status is distinct from new.status then
    perform private.issue_course_certificate(new.id);
  end if;
  return new;
end;
$$;

drop trigger if exists issue_certificate_after_completion on public.course_enrollments;
create trigger issue_certificate_after_completion
after update of status on public.course_enrollments
for each row execute function private.issue_certificate_after_completion();

select private.issue_course_certificate(id) from public.course_enrollments where status = 'completed';

create or replace function public.check_verification_rate_limit(check_identifier_hash text)
returns boolean language plpgsql security definer set search_path = '' as $$
declare
  current_window timestamptz := date_trunc('minute', now());
  updated_count integer;
begin
  if check_identifier_hash is null or length(check_identifier_hash) < 16 then return false; end if;
  insert into public.verification_rate_limits (identifier_hash, window_started_at, request_count)
  values (check_identifier_hash, current_window, 1)
  on conflict (identifier_hash, window_started_at) do update set request_count = public.verification_rate_limits.request_count + 1
  returning request_count into updated_count;
  delete from public.verification_rate_limits where window_started_at < now() - interval '1 day';
  return updated_count <= 30;
end;
$$;

create or replace function public.verify_course_certificate(check_verification_id uuid)
returns table (recipient_name text, course_title text, cpd_hours numeric, issuing_organization text, issued_at timestamptz, expires_at timestamptz, credential_status text)
language sql stable security definer set search_path = '' as $$
  select certificate.recipient_name, course.title, course.cpd_hours_total, certificate.issuing_organization,
         certificate.issued_at, certificate.expires_at,
         case when certificate.revoked then 'revoked'
              when certificate.expires_at is not null and certificate.expires_at < now() then 'expired'
              else 'valid' end
  from public.course_certificates certificate
  join public.courses course on course.id = certificate.course_id
  where certificate.verification_id = check_verification_id;
$$;

revoke all on function private.issue_course_certificate(uuid) from public;
revoke all on function private.issue_certificate_after_completion() from public;
revoke all on function public.check_verification_rate_limit(text) from public;
revoke all on function public.verify_course_certificate(uuid) from public;
grant execute on function public.check_verification_rate_limit(text) to anon, authenticated;
grant execute on function public.verify_course_certificate(uuid) to anon, authenticated;
