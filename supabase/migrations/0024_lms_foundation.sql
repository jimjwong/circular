-- Multi-tenant LMS foundation: course hierarchy, enrollment, auditable CPD,
-- certificates, badges, dummy payments, and tenant-scoped authorization.

alter table public.courses add column if not exists slug text;
alter table public.courses add column if not exists category text;
alter table public.courses add column if not exists cpd_hours_total numeric(6,2) not null default 0;
alter table public.courses add column if not exists price_cents integer not null default 0;
alter table public.courses add column if not exists currency text not null default 'SGD';
alter table public.courses add column if not exists access_mode text not null default 'free';
alter table public.courses add column if not exists navigation_mode text not null default 'sequential';
alter table public.courses add column if not exists completion_percent integer not null default 100;
alter table public.courses add column if not exists certificate_expiry_months integer;
alter table public.courses add column if not exists created_by uuid references auth.users(id);
alter table public.courses add column if not exists updated_at timestamptz not null default now();

update public.courses c
set slug = regexp_replace(lower(c.title), '[^a-z0-9]+', '-', 'g') || '-' || substr(c.id::text, 1, 8)
where c.slug is null;
update public.courses c set created_by = t.created_by from public.tenants t where t.id = c.tenant_id and c.created_by is null;
alter table public.courses alter column slug set not null;
alter table public.courses alter column created_by set not null;
alter table public.courses drop constraint if exists courses_slug_format_check;
alter table public.courses add constraint courses_slug_format_check check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$');
alter table public.courses drop constraint if exists courses_cpd_hours_check;
alter table public.courses add constraint courses_cpd_hours_check check (cpd_hours_total >= 0 and cpd_hours_total <= 9999);
alter table public.courses drop constraint if exists courses_price_check;
alter table public.courses add constraint courses_price_check check (price_cents >= 0);
alter table public.courses drop constraint if exists courses_access_mode_check;
alter table public.courses add constraint courses_access_mode_check check (access_mode in ('free','paid','private'));
alter table public.courses drop constraint if exists courses_navigation_mode_check;
alter table public.courses add constraint courses_navigation_mode_check check (navigation_mode in ('sequential','free'));
alter table public.courses drop constraint if exists courses_completion_percent_check;
alter table public.courses add constraint courses_completion_percent_check check (completion_percent between 1 and 100);
alter table public.courses drop constraint if exists courses_expiry_check;
alter table public.courses add constraint courses_expiry_check check (certificate_expiry_months is null or certificate_expiry_months between 1 and 120);
alter table public.courses add constraint courses_tenant_slug_key unique (tenant_id, slug);
alter table public.courses add constraint courses_id_tenant_key unique (id, tenant_id);

create table public.course_instructors (
  tenant_id uuid not null,
  course_id uuid not null,
  user_id uuid not null,
  assigned_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  primary key (course_id, user_id),
  foreign key (course_id, tenant_id) references public.courses(id, tenant_id) on delete cascade,
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id) on delete cascade
);

create table public.course_modules (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  course_id uuid not null,
  title text not null,
  description text,
  position integer not null default 0,
  unlock_requirement text not null default 'none',
  unlock_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (course_id, tenant_id) references public.courses(id, tenant_id) on delete cascade,
  check (unlock_requirement in ('none','previous_module_complete','date')),
  check (unlock_requirement <> 'date' or unlock_at is not null)
);

create table public.module_items (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  course_id uuid not null,
  module_id uuid not null,
  item_type text not null,
  title text not null,
  content_url text,
  content_body jsonb not null default '{}',
  estimated_minutes integer not null default 0,
  position integer not null default 0,
  completion_requirement text not null default 'view',
  score_threshold numeric(5,2),
  watch_threshold integer not null default 90,
  is_required boolean not null default true,
  is_preview boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (course_id, tenant_id) references public.courses(id, tenant_id) on delete cascade,
  foreign key (module_id, tenant_id) references public.course_modules(id, tenant_id) on delete cascade,
  check (item_type in ('video','reading','quiz','assignment','scorm','external_link')),
  check (completion_requirement in ('view','score_threshold','manual_mark_complete','must_submit')),
  check (estimated_minutes between 0 and 10080),
  check (watch_threshold between 1 and 100),
  check (score_threshold is null or score_threshold between 0 and 100),
  check (completion_requirement <> 'score_threshold' or score_threshold is not null)
);

create table public.course_enrollments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  course_id uuid not null,
  user_id uuid not null,
  status text not null default 'active',
  enrolled_at timestamptz not null default now(),
  last_accessed_at timestamptz,
  completed_at timestamptz,
  dropped_at timestamptz,
  unique (course_id, user_id),
  unique (id, tenant_id),
  foreign key (course_id, tenant_id) references public.courses(id, tenant_id) on delete cascade,
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id) on delete cascade,
  check (status in ('active','completed','dropped'))
);

create table public.course_item_progress (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  enrollment_id uuid not null,
  module_item_id uuid not null,
  user_id uuid not null,
  status text not null default 'not_started',
  time_spent_seconds integer not null default 0,
  watch_percent integer not null default 0,
  score numeric(5,2),
  submission_url text,
  first_accessed_at timestamptz,
  last_accessed_at timestamptz,
  completed_at timestamptz,
  unique (enrollment_id, module_item_id),
  foreign key (enrollment_id, tenant_id) references public.course_enrollments(id, tenant_id) on delete cascade,
  foreign key (module_item_id, tenant_id) references public.module_items(id, tenant_id) on delete cascade,
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id) on delete cascade,
  check (status in ('not_started','in_progress','complete')),
  check (time_spent_seconds >= 0),
  check (watch_percent between 0 and 100),
  check (score is null or score between 0 and 100)
);

create table public.learning_hours_ledger (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  user_id uuid not null,
  enrollment_id uuid not null,
  module_item_id uuid not null,
  seconds_logged integer not null,
  session_key uuid not null,
  logged_at timestamptz not null default now(),
  foreign key (enrollment_id, tenant_id) references public.course_enrollments(id, tenant_id) on delete cascade,
  foreign key (module_item_id, tenant_id) references public.module_items(id, tenant_id) on delete cascade,
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id) on delete cascade,
  check (seconds_logged between 1 and 120),
  unique (session_key, logged_at)
);

create table public.course_certificates (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  verification_id uuid not null default gen_random_uuid() unique,
  user_id uuid not null,
  course_id uuid not null,
  enrollment_id uuid not null unique,
  recipient_name text not null,
  issuing_organization text not null default 'Asia Professional Speakers Singapore',
  issued_at timestamptz not null default now(),
  expires_at timestamptz,
  pdf_storage_path text,
  revoked boolean not null default false,
  revoked_at timestamptz,
  revoked_reason text,
  foreign key (course_id, tenant_id) references public.courses(id, tenant_id) on delete cascade,
  foreign key (enrollment_id, tenant_id) references public.course_enrollments(id, tenant_id) on delete cascade,
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id) on delete cascade
);

create table public.course_badges (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  course_id uuid,
  name text not null,
  description text not null,
  image_url text,
  criteria_text text not null,
  award_mode text not null default 'course_completion',
  open_badge_json jsonb not null default '{}',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  unique (id, tenant_id),
  foreign key (course_id, tenant_id) references public.courses(id, tenant_id) on delete cascade,
  check (award_mode in ('course_completion','manual'))
);

create table public.course_badge_awards (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  badge_id uuid not null,
  user_id uuid not null,
  course_id uuid,
  verification_id uuid not null default gen_random_uuid() unique,
  recipient_name text not null,
  awarded_at timestamptz not null default now(),
  revoked boolean not null default false,
  revoked_at timestamptz,
  revoked_reason text,
  assertion_json jsonb not null default '{}',
  unique (badge_id, user_id, course_id),
  foreign key (badge_id, tenant_id) references public.course_badges(id, tenant_id) on delete cascade,
  foreign key (course_id, tenant_id) references public.courses(id, tenant_id) on delete cascade,
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id) on delete cascade
);

create table public.course_payments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null,
  course_id uuid not null,
  user_id uuid not null,
  amount_cents integer not null,
  currency text not null default 'SGD',
  provider text not null default 'dummy',
  provider_reference text not null,
  status text not null default 'succeeded',
  paid_at timestamptz not null default now(),
  unique (provider, provider_reference),
  foreign key (course_id, tenant_id) references public.courses(id, tenant_id) on delete cascade,
  foreign key (tenant_id, user_id) references public.tenant_memberships(tenant_id, user_id) on delete cascade,
  check (amount_cents >= 0),
  check (status in ('pending','succeeded','failed','refunded'))
);

create or replace function private.can_manage_course(check_course_id uuid, check_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select private.has_tenant_role(check_tenant_id, array['owner','admin']::public.tenant_role[])
    or exists (select 1 from public.course_instructors ci where ci.course_id = check_course_id and ci.tenant_id = check_tenant_id and ci.user_id = (select auth.uid()));
$$;

create or replace function private.can_access_course(check_course_id uuid, check_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.courses c
    join public.tenant_memberships tm on tm.tenant_id = c.tenant_id and tm.user_id = (select auth.uid()) and tm.status = 'active'
    where c.id = check_course_id and c.tenant_id = check_tenant_id
      and (c.status = 'published' or tm.role in ('owner','admin') or private.can_manage_course(c.id, c.tenant_id))
  );
$$;

drop policy if exists "tenant members can read" on public.courses;
drop policy if exists "tenant admins can insert" on public.courses;
drop policy if exists "tenant admins can update" on public.courses;
drop policy if exists "tenant admins can delete" on public.courses;
create policy "members read available courses" on public.courses for select to authenticated using (private.can_access_course(id, tenant_id));
create policy "admins create courses" on public.courses for insert to authenticated with check (private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_role[]));
create policy "course managers update courses" on public.courses for update to authenticated using (private.can_manage_course(id, tenant_id)) with check (private.can_manage_course(id, tenant_id));
create policy "admins delete courses" on public.courses for delete to authenticated using (private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_role[]));

do $$
declare table_name text;
begin
  foreach table_name in array array['course_instructors','course_modules','module_items','course_enrollments','course_item_progress','learning_hours_ledger','course_certificates','course_badges','course_badge_awards','course_payments'] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('revoke all on table public.%I from anon', table_name);
  end loop;
end $$;

create policy "members read course instructors" on public.course_instructors for select to authenticated using (private.can_access_course(course_id, tenant_id));
create policy "admins manage course instructors" on public.course_instructors for all to authenticated using (private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_role[])) with check (private.has_tenant_role(tenant_id, array['owner','admin']::public.tenant_role[]));
create policy "members read course modules" on public.course_modules for select to authenticated using (private.can_access_course(course_id, tenant_id));
create policy "managers create course modules" on public.course_modules for insert to authenticated with check (private.can_manage_course(course_id, tenant_id));
create policy "managers update course modules" on public.course_modules for update to authenticated using (private.can_manage_course(course_id, tenant_id)) with check (private.can_manage_course(course_id, tenant_id));
create policy "managers delete course modules" on public.course_modules for delete to authenticated using (private.can_manage_course(course_id, tenant_id));
create policy "members read module items" on public.module_items for select to authenticated using (private.can_access_course(course_id, tenant_id));
create policy "managers create module items" on public.module_items for insert to authenticated with check (private.can_manage_course(course_id, tenant_id));
create policy "managers update module items" on public.module_items for update to authenticated using (private.can_manage_course(course_id, tenant_id)) with check (private.can_manage_course(course_id, tenant_id));
create policy "managers delete module items" on public.module_items for delete to authenticated using (private.can_manage_course(course_id, tenant_id));

create policy "learners read own enrollments" on public.course_enrollments for select to authenticated using (user_id = (select auth.uid()) or private.can_manage_course(course_id, tenant_id));
create policy "managers manage enrollments" on public.course_enrollments for all to authenticated using (private.can_manage_course(course_id, tenant_id)) with check (private.can_manage_course(course_id, tenant_id));
create policy "learners read own item progress" on public.course_item_progress for select to authenticated using (user_id = (select auth.uid()) or exists (select 1 from public.course_enrollments e where e.id = enrollment_id and private.can_manage_course(e.course_id, e.tenant_id)));
create policy "learners read own hours ledger" on public.learning_hours_ledger for select to authenticated using (user_id = (select auth.uid()) or exists (select 1 from public.course_enrollments e where e.id = enrollment_id and private.can_manage_course(e.course_id, e.tenant_id)));
create policy "learners read own certificates" on public.course_certificates for select to authenticated using (user_id = (select auth.uid()) or private.can_manage_course(course_id, tenant_id));
create policy "members read badges" on public.course_badges for select to authenticated using (public.is_tenant_member(tenant_id) and (course_id is null or private.can_access_course(course_id, tenant_id)));
create policy "managers manage badges" on public.course_badges for all to authenticated using (course_id is not null and private.can_manage_course(course_id, tenant_id)) with check (course_id is not null and private.can_manage_course(course_id, tenant_id));
create policy "learners read own badge awards" on public.course_badge_awards for select to authenticated using (user_id = (select auth.uid()) or (course_id is not null and private.can_manage_course(course_id, tenant_id)));
create policy "learners read own course payments" on public.course_payments for select to authenticated using (user_id = (select auth.uid()) or private.can_manage_course(course_id, tenant_id));

grant select, insert, update, delete on public.courses, public.course_instructors, public.course_modules, public.module_items, public.course_badges to authenticated;
grant select on public.course_enrollments, public.course_item_progress, public.learning_hours_ledger, public.course_certificates, public.course_badge_awards, public.course_payments to authenticated;
revoke all on function private.can_manage_course(uuid, uuid) from public;
revoke all on function private.can_access_course(uuid, uuid) from public;
grant execute on function private.can_manage_course(uuid, uuid) to authenticated;
grant execute on function private.can_access_course(uuid, uuid) to authenticated;
