begin;

create extension if not exists pgtap with schema extensions;
select plan(9);

insert into auth.users (
  id, instance_id, aud, role, email, encrypted_password,
  email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at
) values
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'owner-a@example.test', '', now(), '{}', '{"full_name":"Owner A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'admin-a@example.test', '', now(), '{}', '{"full_name":"Admin A"}', now(), now()),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'member-b@example.test', '', now(), '{}', '{"full_name":"Member B"}', now(), now()),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'new-member@example.test', '', now(), '{}', '{"full_name":"New Member"}', now(), now()),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'new-admin@example.test', '', now(), '{}', '{"full_name":"New Admin"}', now(), now());

insert into public.tenants (id, name, slug, created_by, status) values
  ('10000000-0000-0000-0000-000000000001', 'Tenant A', 'tenant-a', '00000000-0000-0000-0000-000000000001', 'active'),
  ('10000000-0000-0000-0000-000000000002', 'Tenant B', 'tenant-b', '00000000-0000-0000-0000-000000000003', 'active');

insert into public.tenant_memberships (tenant_id, user_id, role, status) values
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000001', 'owner', 'active'),
  ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002', 'admin', 'active'),
  ('10000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000003', 'member', 'active');

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","email":"admin-a@example.test","role":"authenticated"}', true);

select results_eq(
  $$ select count(*) from public.tenants $$,
  array[1::bigint],
  'an admin reads only their own tenant'
);

select results_eq(
  $$ select count(*) from public.tenant_memberships $$,
  array[2::bigint],
  'an admin reads only memberships in their tenant'
);

select lives_ok(
  $$ insert into public.tenant_memberships (tenant_id, user_id, role, status) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000004', 'member', 'active') $$,
  'an admin may add a member'
);

select throws_ok(
  $$ insert into public.tenant_memberships (tenant_id, user_id, role, status) values ('10000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000005', 'admin', 'active') $$,
  '42501',
  null,
  'an admin may not create another admin'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000003', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000003","email":"member-b@example.test","role":"authenticated"}', true);

select results_eq(
  $$ select count(*) from public.tenants where id = '10000000-0000-0000-0000-000000000001' $$,
  array[0::bigint],
  'a user cannot read another tenant'
);

select throws_ok(
  $$ insert into public.organization_invitations (tenant_id, email, role, token_hash, invited_by) values ('10000000-0000-0000-0000-000000000002', 'blocked@example.test', 'member', 'blocked-token', '00000000-0000-0000-0000-000000000003') $$,
  '42501',
  null,
  'a member cannot create invitations'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000001', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","email":"owner-a@example.test","role":"authenticated"}', true);

select lives_ok(
  $$ insert into public.organization_invitations (tenant_id, email, role, token_hash, invited_by) values ('10000000-0000-0000-0000-000000000001', 'invited@example.test', 'admin', 'owner-token', '00000000-0000-0000-0000-000000000001') $$,
  'an owner may invite an admin'
);

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000002', true);
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000002","email":"admin-a@example.test","role":"authenticated"}', true);

select throws_ok(
  $$ insert into public.organization_invitations (tenant_id, email, role, token_hash, invited_by) values ('10000000-0000-0000-0000-000000000001', 'admin-blocked@example.test', 'admin', 'admin-blocked-token', '00000000-0000-0000-0000-000000000002') $$,
  '42501',
  null,
  'an organization admin may not invite another admin'
);

set local role anon;
select set_config('request.jwt.claim.sub', '', true);
select set_config('request.jwt.claims', '{}', true);

select throws_ok(
  $$ select count(*) from public.tenants $$,
  '42501',
  null,
  'signed-out callers have no tenant table grant'
);

select * from finish();
rollback;
