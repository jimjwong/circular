-- Phase 1: platform authority, tenant lifecycle, invitations, permissions, and auditability.

create schema if not exists private;

create type public.platform_role as enum ('super_admin', 'support_admin', 'billing_admin');
create type public.tenant_status as enum ('trial', 'active', 'past_due', 'suspended', 'cancelled');
create type public.invitation_status as enum ('pending', 'accepted', 'revoked', 'expired');

alter table public.tenants
  add column status public.tenant_status not null default 'trial',
  add column trial_ends_at timestamptz not null default (now() + interval '14 days'),
  add column suspended_at timestamptz,
  add column cancelled_at timestamptz;

alter table public.tenant_memberships
  add column invited_by uuid references auth.users(id),
  add column updated_at timestamptz not null default now();

create unique index one_active_owner_per_tenant
  on public.tenant_memberships (tenant_id)
  where role = 'owner' and status = 'active';

create table public.platform_staff (
  user_id uuid primary key references auth.users(id) on delete cascade,
  role public.platform_role not null,
  is_active boolean not null default true,
  granted_by uuid references auth.users(id),
  granted_at timestamptz not null default now(),
  last_reviewed_at timestamptz
);

comment on table public.platform_staff is
  'Platform-level authority. This is intentionally separate from tenant memberships.';

create table public.role_permissions (
  role public.tenant_role not null,
  permission text not null,
  description text not null,
  primary key (role, permission)
);

insert into public.role_permissions (role, permission, description) values
  ('owner', 'organization.manage', 'Manage organization settings and ownership'),
  ('owner', 'billing.manage', 'Manage the organization subscription and billing'),
  ('owner', 'members.manage', 'Invite, change, suspend, and remove organization members'),
  ('owner', 'content.manage', 'Manage all organization content'),
  ('owner', 'audit.read', 'Read organization audit events'),
  ('admin', 'organization.manage', 'Manage organization settings'),
  ('admin', 'members.manage', 'Invite and manage moderators and members'),
  ('admin', 'content.manage', 'Manage all organization content'),
  ('admin', 'audit.read', 'Read organization audit events'),
  ('moderator', 'content.moderate', 'Moderate content and member reports'),
  ('member', 'content.participate', 'Participate in accessible community areas');

create table public.organization_invitations (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  email text not null check (email = lower(email)),
  role public.tenant_role not null default 'member' check (role <> 'owner'),
  token_hash text not null unique,
  status public.invitation_status not null default 'pending',
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default (now() + interval '7 days'),
  accepted_by uuid references auth.users(id),
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);

create index organization_invitations_tenant_status_idx
  on public.organization_invitations (tenant_id, status, created_at desc);
create unique index one_pending_invitation_per_email
  on public.organization_invitations (tenant_id, email)
  where status = 'pending';

create table public.audit_logs (
  id bigint generated always as identity primary key,
  tenant_id uuid references public.tenants(id) on delete set null,
  actor_id uuid references auth.users(id) on delete set null,
  action text not null,
  target_type text not null,
  target_id text,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

create index audit_logs_tenant_created_idx on public.audit_logs (tenant_id, created_at desc);
create index audit_logs_actor_created_idx on public.audit_logs (actor_id, created_at desc);

create or replace function private.has_tenant_role(
  check_tenant_id uuid,
  allowed_roles public.tenant_role[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.tenant_memberships tm
    where tm.tenant_id = check_tenant_id
      and tm.user_id = (select auth.uid())
      and tm.status = 'active'
      and tm.role = any(allowed_roles)
  );
$$;

create or replace function private.is_platform_staff(allowed_roles public.platform_role[])
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.platform_staff ps
    where ps.user_id = (select auth.uid())
      and ps.is_active
      and ps.role = any(allowed_roles)
  );
$$;

create or replace function public.can_manage_tenant(check_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_tenant_role(
    check_tenant_id,
    array['owner', 'admin']::public.tenant_role[]
  );
$$;

create or replace function public.is_tenant_member(check_tenant_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.has_tenant_role(
    check_tenant_id,
    array['owner', 'admin', 'moderator', 'member']::public.tenant_role[]
  );
$$;

create or replace function private.write_audit_log(
  audit_tenant_id uuid,
  audit_actor_id uuid,
  audit_action text,
  audit_target_type text,
  audit_target_id text,
  audit_metadata jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_logs (
    tenant_id, actor_id, action, target_type, target_id, metadata
  ) values (
    audit_tenant_id,
    audit_actor_id,
    audit_action,
    audit_target_type,
    audit_target_id,
    coalesce(audit_metadata, '{}'::jsonb)
  );
$$;

create or replace function private.audit_tenant_membership_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_tenant_id uuid := coalesce(new.tenant_id, old.tenant_id);
  current_user_id uuid := coalesce(new.user_id, old.user_id);
  event_name text;
begin
  event_name := case tg_op
    when 'INSERT' then 'member.added'
    when 'UPDATE' then 'member.updated'
    when 'DELETE' then 'member.removed'
  end;

  perform private.write_audit_log(
    current_tenant_id,
    (select auth.uid()),
    event_name,
    'tenant_membership',
    current_user_id::text,
    jsonb_build_object(
      'old_role', case when tg_op <> 'INSERT' then old.role::text else null end,
      'new_role', case when tg_op <> 'DELETE' then new.role::text else null end,
      'old_status', case when tg_op <> 'INSERT' then old.status else null end,
      'new_status', case when tg_op <> 'DELETE' then new.status else null end
    )
  );

  return coalesce(new, old);
end;
$$;

create trigger audit_tenant_membership_change
after insert or update or delete on public.tenant_memberships
for each row execute function private.audit_tenant_membership_change();

create or replace function public.accept_organization_invitation(raw_token text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  invitation public.organization_invitations%rowtype;
  caller_email text := lower(coalesce((select auth.jwt() ->> 'email'), ''));
begin
  if (select auth.uid()) is null then
    raise exception 'Authentication is required';
  end if;

  select * into invitation
  from public.organization_invitations oi
  where oi.token_hash = encode(digest(raw_token, 'sha256'), 'hex')
    and oi.status = 'pending'
  for update;

  if invitation.id is null then
    raise exception 'Invitation is invalid or no longer available';
  end if;

  if invitation.expires_at <= now() then
    update public.organization_invitations
      set status = 'expired'
      where id = invitation.id;
    raise exception 'Invitation has expired';
  end if;

  if caller_email = '' or caller_email <> invitation.email then
    raise exception 'Sign in with the email address that received this invitation';
  end if;

  insert into public.tenant_memberships (
    tenant_id, user_id, role, status, invited_by
  ) values (
    invitation.tenant_id,
    (select auth.uid()),
    invitation.role,
    'active',
    invitation.invited_by
  )
  on conflict (tenant_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        invited_by = excluded.invited_by,
        updated_at = now();

  update public.organization_invitations
    set status = 'accepted',
        accepted_by = (select auth.uid()),
        accepted_at = now()
    where id = invitation.id;

  perform private.write_audit_log(
    invitation.tenant_id,
    (select auth.uid()),
    'invitation.accepted',
    'organization_invitation',
    invitation.id::text,
    jsonb_build_object('role', invitation.role::text)
  );

  return invitation.tenant_id;
end;
$$;

create or replace function public.transfer_tenant_ownership(
  check_tenant_id uuid,
  target_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
begin
  if not private.has_tenant_role(
    check_tenant_id,
    array['owner']::public.tenant_role[]
  ) then
    raise exception 'Only the current owner can transfer ownership';
  end if;

  if caller_id = target_user_id then
    raise exception 'The target user is already the owner';
  end if;

  if not exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = check_tenant_id
      and tm.user_id = target_user_id
      and tm.status = 'active'
  ) then
    raise exception 'The target must be an active organization member';
  end if;

  -- The partial unique index requires releasing the current owner first.
  update public.tenant_memberships
    set role = 'admin', updated_at = now()
    where tenant_id = check_tenant_id and user_id = caller_id;

  update public.tenant_memberships
    set role = 'owner', updated_at = now()
    where tenant_id = check_tenant_id and user_id = target_user_id;

  perform private.write_audit_log(
    check_tenant_id,
    caller_id,
    'organization.ownership_transferred',
    'tenant',
    check_tenant_id::text,
    jsonb_build_object('new_owner_id', target_user_id)
  );
end;
$$;

alter table public.platform_staff enable row level security;
alter table public.role_permissions enable row level security;
alter table public.organization_invitations enable row level security;
alter table public.audit_logs enable row level security;

create policy "platform staff read own role"
on public.platform_staff for select to authenticated
using (user_id = (select auth.uid()));

create policy "authenticated users read role permissions"
on public.role_permissions for select to authenticated
using (true);

create policy "tenant admins read invitations"
on public.organization_invitations for select to authenticated
using (
  private.has_tenant_role(
    tenant_id,
    array['owner', 'admin']::public.tenant_role[]
  )
);

create policy "tenant admins create non-owner invitations"
on public.organization_invitations for insert to authenticated
with check (
  role <> 'owner'
  and invited_by = (select auth.uid())
  and private.has_tenant_role(
    tenant_id,
    array['owner', 'admin']::public.tenant_role[]
  )
);

create policy "tenant admins update invitations"
on public.organization_invitations for update to authenticated
using (
  private.has_tenant_role(
    tenant_id,
    array['owner', 'admin']::public.tenant_role[]
  )
)
with check (
  private.has_tenant_role(
    tenant_id,
    array['owner', 'admin']::public.tenant_role[]
  )
);

create policy "tenant admins read audit log"
on public.audit_logs for select to authenticated
using (
  tenant_id is not null
  and private.has_tenant_role(
    tenant_id,
    array['owner', 'admin']::public.tenant_role[]
  )
);

drop policy if exists "admins manage memberships" on public.tenant_memberships;

create policy "owners add non-owner members"
on public.tenant_memberships for insert to authenticated
with check (
  role <> 'owner'
  and private.has_tenant_role(
    tenant_id,
    array['owner']::public.tenant_role[]
  )
);

create policy "admins add moderators and members"
on public.tenant_memberships for insert to authenticated
with check (
  role in ('moderator', 'member')
  and private.has_tenant_role(
    tenant_id,
    array['admin']::public.tenant_role[]
  )
);

create policy "owners update non-owner members"
on public.tenant_memberships for update to authenticated
using (
  role <> 'owner'
  and private.has_tenant_role(
    tenant_id,
    array['owner']::public.tenant_role[]
  )
)
with check (role <> 'owner');

create policy "admins update moderators and members"
on public.tenant_memberships for update to authenticated
using (
  role in ('moderator', 'member')
  and private.has_tenant_role(
    tenant_id,
    array['admin']::public.tenant_role[]
  )
)
with check (role in ('moderator', 'member'));

create policy "owners remove non-owner members"
on public.tenant_memberships for delete to authenticated
using (
  role <> 'owner'
  and private.has_tenant_role(
    tenant_id,
    array['owner']::public.tenant_role[]
  )
);

create policy "admins remove moderators and members"
on public.tenant_memberships for delete to authenticated
using (
  role in ('moderator', 'member')
  and private.has_tenant_role(
    tenant_id,
    array['admin']::public.tenant_role[]
  )
);

-- Supabase grants and RLS are separate controls. Signed-out callers receive no
-- direct access to tenant or identity data.
do $$
declare table_name text;
begin
  foreach table_name in array array[
    'tenants', 'profiles', 'tenant_memberships', 'space_groups', 'spaces',
    'posts', 'comments', 'reactions', 'events', 'event_rsvps', 'courses',
    'course_lessons', 'course_progress', 'tags', 'member_tags',
    'email_broadcasts', 'workflows', 'ai_agents', 'offers', 'subscriptions',
    'platform_staff', 'role_permissions', 'organization_invitations', 'audit_logs'
  ] loop
    execute format('revoke all on table public.%I from anon', table_name);
  end loop;
end $$;

revoke all on function public.accept_organization_invitation(text) from public;
revoke all on function public.transfer_tenant_ownership(uuid, uuid) from public;
grant execute on function public.accept_organization_invitation(text) to authenticated;
grant execute on function public.transfer_tenant_ownership(uuid, uuid) to authenticated;

revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;
grant execute on function private.has_tenant_role(uuid, public.tenant_role[]) to authenticated;
grant execute on function private.is_platform_staff(public.platform_role[]) to authenticated;
