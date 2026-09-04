-- Atomic organization creation and invitation audit events.

create or replace function public.create_organization(
  organization_name text,
  organization_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  new_tenant_id uuid;
  clean_name text := nullif(trim(organization_name), '');
  clean_slug text := lower(trim(organization_slug));
begin
  if caller_id is null then
    raise exception 'Authentication is required';
  end if;

  if clean_name is null or length(clean_name) < 2 then
    raise exception 'Organization name must contain at least 2 characters';
  end if;

  if clean_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    raise exception 'Organization URL must use lowercase letters, numbers, and single hyphens';
  end if;

  insert into public.tenants (name, slug, created_by)
  values (clean_name, clean_slug, caller_id)
  returning id into new_tenant_id;

  insert into public.tenant_memberships (tenant_id, user_id, role, status)
  values (new_tenant_id, caller_id, 'owner', 'active');

  perform private.write_audit_log(
    new_tenant_id,
    caller_id,
    'organization.created',
    'tenant',
    new_tenant_id::text,
    jsonb_build_object('name', clean_name, 'slug', clean_slug)
  );

  return new_tenant_id;
end;
$$;

create or replace function private.audit_invitation_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  event_name text;
begin
  event_name := case
    when tg_op = 'INSERT' then 'invitation.created'
    when new.status = 'revoked' and old.status <> 'revoked' then 'invitation.revoked'
    when new.status = 'expired' and old.status <> 'expired' then 'invitation.expired'
    else null
  end;

  if event_name is not null then
    perform private.write_audit_log(
      coalesce(new.tenant_id, old.tenant_id),
      coalesce((select auth.uid()), new.invited_by, old.invited_by),
      event_name,
      'organization_invitation',
      coalesce(new.id, old.id)::text,
      jsonb_build_object(
        'email', coalesce(new.email, old.email),
        'role', coalesce(new.role, old.role)::text
      )
    );
  end if;

  return coalesce(new, old);
end;
$$;

create trigger audit_invitation_change
after insert or update on public.organization_invitations
for each row execute function private.audit_invitation_change();

revoke all on function public.create_organization(text, text) from public;
grant execute on function public.create_organization(text, text) to authenticated;
