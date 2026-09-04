-- pgcrypto is installed in the extensions schema in local Supabase projects.

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
  where oi.token_hash = encode(extensions.digest(raw_token, 'sha256'), 'hex')
    and oi.status = 'pending'
  for update;

  if invitation.id is null then
    raise exception 'Invitation is invalid or no longer available';
  end if;

  if invitation.expires_at <= now() then
    update public.organization_invitations set status = 'expired' where id = invitation.id;
    raise exception 'Invitation has expired';
  end if;

  if caller_email = '' or caller_email <> invitation.email then
    raise exception 'Sign in with the email address that received this invitation';
  end if;

  insert into public.tenant_memberships (tenant_id, user_id, role, status, invited_by)
  values (invitation.tenant_id, (select auth.uid()), invitation.role, 'active', invitation.invited_by)
  on conflict (tenant_id, user_id) do update
    set role = excluded.role,
        status = 'active',
        invited_by = excluded.invited_by,
        updated_at = now();

  update public.organization_invitations
    set status = 'accepted', accepted_by = (select auth.uid()), accepted_at = now()
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

revoke all on function public.accept_organization_invitation(text) from public;
grant execute on function public.accept_organization_invitation(text) to authenticated;
