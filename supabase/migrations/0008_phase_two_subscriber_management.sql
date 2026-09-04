-- Phase 2: local subscription source of truth, entitlements, and usage meters.

create type public.subscription_status as enum ('trialing', 'active', 'past_due', 'paused', 'cancelled');

create table public.subscription_plans (
  id text primary key check (id ~ '^[a-z][a-z0-9_-]*$'),
  name text not null,
  description text not null,
  monthly_price_cents integer not null check (monthly_price_cents >= 0),
  annual_price_cents integer not null check (annual_price_cents >= 0),
  is_active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.plan_entitlements (
  plan_id text not null references public.subscription_plans(id) on delete cascade,
  entitlement_key text not null check (entitlement_key ~ '^[a-z][a-z0-9_.-]*$'),
  value jsonb not null,
  description text not null,
  primary key (plan_id, entitlement_key)
);

create table public.tenant_subscriptions (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  plan_id text not null references public.subscription_plans(id),
  status public.subscription_status not null default 'trialing',
  billing_provider text not null default 'local',
  external_customer_id text,
  external_subscription_id text,
  current_period_starts_at timestamptz not null default now(),
  current_period_ends_at timestamptz,
  trial_ends_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (billing_provider, external_subscription_id)
);

create table public.tenant_usage_counters (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  metric_key text not null check (metric_key ~ '^[a-z][a-z0-9_.-]*$'),
  period_starts_on date not null,
  quantity bigint not null default 0 check (quantity >= 0),
  updated_at timestamptz not null default now(),
  primary key (tenant_id, metric_key, period_starts_on)
);

insert into public.subscription_plans (id, name, description, monthly_price_cents, annual_price_cents, display_order) values
  ('starter', 'Starter', 'Launch a focused community with the essential publishing and event tools.', 3900, 39000, 10),
  ('pro', 'Professional', 'Run a growing community with courses, workflows, and advanced operations.', 9900, 99000, 20),
  ('business', 'Business', 'Scale multiple programs with higher limits, AI, and priority operations.', 24900, 249000, 30);

insert into public.plan_entitlements (plan_id, entitlement_key, value, description) values
  ('starter', 'members.max', '100', 'Maximum active members'),
  ('starter', 'spaces.max', '10', 'Maximum community spaces'),
  ('starter', 'admins.max', '2', 'Maximum owners and administrators'),
  ('starter', 'storage.gb', '10', 'Included file storage in GB'),
  ('starter', 'workflows.enabled', 'false', 'Workflow automation access'),
  ('starter', 'ai_agents.max', '0', 'Maximum active AI agents'),
  ('pro', 'members.max', '1000', 'Maximum active members'),
  ('pro', 'spaces.max', '50', 'Maximum community spaces'),
  ('pro', 'admins.max', '10', 'Maximum owners and administrators'),
  ('pro', 'storage.gb', '100', 'Included file storage in GB'),
  ('pro', 'workflows.enabled', 'true', 'Workflow automation access'),
  ('pro', 'ai_agents.max', '3', 'Maximum active AI agents'),
  ('business', 'members.max', '10000', 'Maximum active members'),
  ('business', 'spaces.max', '250', 'Maximum community spaces'),
  ('business', 'admins.max', '50', 'Maximum owners and administrators'),
  ('business', 'storage.gb', '1000', 'Included file storage in GB'),
  ('business', 'workflows.enabled', 'true', 'Workflow automation access'),
  ('business', 'ai_agents.max', '25', 'Maximum active AI agents');

insert into public.tenant_subscriptions (tenant_id, plan_id, status, trial_ends_at, cancelled_at)
select
  t.id,
  case when exists (select 1 from public.subscription_plans sp where sp.id = t.plan) then t.plan else 'pro' end,
  case t.status
    when 'trial' then 'trialing'::public.subscription_status
    when 'active' then 'active'::public.subscription_status
    when 'past_due' then 'past_due'::public.subscription_status
    when 'suspended' then 'paused'::public.subscription_status
    when 'cancelled' then 'cancelled'::public.subscription_status
  end,
  t.trial_ends_at,
  t.cancelled_at
from public.tenants t;

insert into public.tenant_usage_counters (tenant_id, metric_key, period_starts_on, quantity)
select
  t.id,
  'active_members',
  date_trunc('month', now())::date,
  count(tm.user_id)
from public.tenants t
left join public.tenant_memberships tm on tm.tenant_id = t.id and tm.status = 'active'
group by t.id;

alter table public.subscription_plans enable row level security;
alter table public.plan_entitlements enable row level security;
alter table public.tenant_subscriptions enable row level security;
alter table public.tenant_usage_counters enable row level security;

create policy "authenticated users read active plans"
on public.subscription_plans for select to authenticated
using (is_active or private.is_platform_staff(array['super_admin', 'billing_admin']::public.platform_role[]));

create policy "authenticated users read plan entitlements"
on public.plan_entitlements for select to authenticated
using (true);

create policy "tenant admins read subscription"
on public.tenant_subscriptions for select to authenticated
using (
  private.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_role[])
  or private.is_platform_staff(array['super_admin', 'support_admin', 'billing_admin']::public.platform_role[])
);

create policy "tenant admins read usage"
on public.tenant_usage_counters for select to authenticated
using (
  private.has_tenant_role(tenant_id, array['owner', 'admin']::public.tenant_role[])
  or private.is_platform_staff(array['super_admin', 'support_admin', 'billing_admin']::public.platform_role[])
);

revoke all on table public.subscription_plans, public.plan_entitlements, public.tenant_subscriptions, public.tenant_usage_counters from anon;
grant select on table public.subscription_plans, public.plan_entitlements, public.tenant_subscriptions, public.tenant_usage_counters to authenticated;

create or replace function public.update_tenant_subscription(
  check_tenant_id uuid,
  next_plan_id text,
  next_status public.subscription_status,
  change_reason text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  caller_id uuid := (select auth.uid());
  previous_subscription public.tenant_subscriptions%rowtype;
  clean_reason text := nullif(trim(change_reason), '');
  mapped_tenant_status public.tenant_status;
begin
  if not private.is_platform_staff(array['super_admin', 'billing_admin']::public.platform_role[]) then
    raise exception 'Only active platform billing staff can change subscriptions';
  end if;

  if not exists (select 1 from public.subscription_plans where id = next_plan_id and is_active) then
    raise exception 'The selected subscription plan is unavailable';
  end if;

  if next_status in ('paused', 'cancelled') and clean_reason is null then
    raise exception 'A reason is required when pausing or cancelling a subscription';
  end if;

  select * into previous_subscription
  from public.tenant_subscriptions
  where tenant_id = check_tenant_id
  for update;

  if previous_subscription.tenant_id is null then
    raise exception 'Organization subscription not found';
  end if;

  mapped_tenant_status := case next_status
    when 'trialing' then 'trial'::public.tenant_status
    when 'active' then 'active'::public.tenant_status
    when 'past_due' then 'past_due'::public.tenant_status
    when 'paused' then 'suspended'::public.tenant_status
    when 'cancelled' then 'cancelled'::public.tenant_status
  end;

  update public.tenant_subscriptions
  set plan_id = next_plan_id,
      status = next_status,
      cancelled_at = case when next_status = 'cancelled' then now() else null end,
      updated_at = now()
  where tenant_id = check_tenant_id;

  update public.tenants
  set plan = next_plan_id,
      status = mapped_tenant_status,
      suspended_at = case when mapped_tenant_status = 'suspended' then now() else null end,
      cancelled_at = case when mapped_tenant_status = 'cancelled' then now() else null end,
      updated_at = now()
  where id = check_tenant_id;

  if previous_subscription.plan_id is distinct from next_plan_id
     or previous_subscription.status is distinct from next_status then
    perform private.write_audit_log(
      check_tenant_id,
      caller_id,
      'platform.subscription_changed',
      'tenant_subscription',
      check_tenant_id::text,
      jsonb_build_object(
        'previous_plan', previous_subscription.plan_id,
        'next_plan', next_plan_id,
        'previous_status', previous_subscription.status::text,
        'next_status', next_status::text,
        'reason', clean_reason
      )
    );
  end if;
end;
$$;

create or replace function public.get_tenant_entitlement(
  check_tenant_id uuid,
  check_entitlement_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  entitlement_value jsonb;
begin
  if not (
    public.is_tenant_member(check_tenant_id)
    or private.is_platform_staff(array['super_admin', 'support_admin', 'billing_admin']::public.platform_role[])
  ) then
    raise exception 'Organization access is required';
  end if;

  select pe.value into entitlement_value
  from public.tenant_subscriptions ts
  join public.plan_entitlements pe on pe.plan_id = ts.plan_id
  where ts.tenant_id = check_tenant_id
    and pe.entitlement_key = check_entitlement_key;

  return entitlement_value;
end;
$$;

revoke all on function public.update_tenant_subscription(uuid, text, public.subscription_status, text) from public;
revoke all on function public.get_tenant_entitlement(uuid, text) from public;
grant execute on function public.update_tenant_subscription(uuid, text, public.subscription_status, text) to authenticated;
grant execute on function public.get_tenant_entitlement(uuid, text) to authenticated;

create or replace function private.bootstrap_tenant_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.tenant_subscriptions (tenant_id, plan_id, status, trial_ends_at)
  values (
    new.id,
    case when exists (select 1 from public.subscription_plans where id = new.plan) then new.plan else 'pro' end,
    case new.status
      when 'trial' then 'trialing'::public.subscription_status
      when 'active' then 'active'::public.subscription_status
      when 'past_due' then 'past_due'::public.subscription_status
      when 'suspended' then 'paused'::public.subscription_status
      when 'cancelled' then 'cancelled'::public.subscription_status
    end,
    new.trial_ends_at
  );

  insert into public.tenant_usage_counters (tenant_id, metric_key, period_starts_on, quantity)
  values (new.id, 'active_members', date_trunc('month', now())::date, 0);
  return new;
end;
$$;

create trigger bootstrap_tenant_subscription
after insert on public.tenants
for each row execute function private.bootstrap_tenant_subscription();

create or replace function private.sync_tenant_subscription()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.tenant_subscriptions
  set plan_id = case when exists (select 1 from public.subscription_plans where id = new.plan) then new.plan else plan_id end,
      status = case new.status
        when 'trial' then 'trialing'::public.subscription_status
        when 'active' then 'active'::public.subscription_status
        when 'past_due' then 'past_due'::public.subscription_status
        when 'suspended' then 'paused'::public.subscription_status
        when 'cancelled' then 'cancelled'::public.subscription_status
      end,
      cancelled_at = case when new.status = 'cancelled' then coalesce(new.cancelled_at, now()) else null end,
      updated_at = now()
  where tenant_id = new.id;
  return new;
end;
$$;

create trigger sync_tenant_subscription
after update of plan, status on public.tenants
for each row
when (old.plan is distinct from new.plan or old.status is distinct from new.status)
execute function private.sync_tenant_subscription();

create or replace function private.refresh_active_member_usage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_tenant_id uuid := coalesce(new.tenant_id, old.tenant_id);
begin
  insert into public.tenant_usage_counters (tenant_id, metric_key, period_starts_on, quantity, updated_at)
  select
    current_tenant_id,
    'active_members',
    date_trunc('month', now())::date,
    count(*),
    now()
  from public.tenant_memberships
  where tenant_id = current_tenant_id and status = 'active'
  on conflict (tenant_id, metric_key, period_starts_on)
  do update set quantity = excluded.quantity, updated_at = excluded.updated_at;
  return coalesce(new, old);
end;
$$;

create trigger refresh_active_member_usage
after insert or update or delete on public.tenant_memberships
for each row execute function private.refresh_active_member_usage();
