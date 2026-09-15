-- Tenant-scoped email campaigns with an immutable recipient snapshot.

alter table public.email_broadcasts
  add column if not exists sender_name text,
  add column if not exists sender_email text,
  add column if not exists reply_to text,
  add column if not exists recipient_count integer not null default 0,
  add column if not exists listmonk_list_id integer,
  add column if not exists listmonk_campaign_id integer,
  add column if not exists listmonk_status text,
  add column if not exists error_message text,
  add column if not exists updated_at timestamptz not null default now();

create table if not exists public.email_recipient_snapshots (
  broadcast_id uuid not null references public.email_broadcasts(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid references auth.users(id) on delete set null,
  email text not null,
  display_name text not null default '',
  membership_tier text,
  role_slugs text[] not null default '{}',
  created_at timestamptz not null default now(),
  primary key (broadcast_id, email)
);

create index if not exists email_recipient_snapshots_tenant_broadcast_idx
  on public.email_recipient_snapshots (tenant_id, broadcast_id);

alter table public.email_recipient_snapshots enable row level security;

drop policy if exists "tenant members can read" on public.email_broadcasts;
drop policy if exists "tenant admins can insert" on public.email_broadcasts;
drop policy if exists "tenant admins can update" on public.email_broadcasts;
drop policy if exists "tenant admins can delete" on public.email_broadcasts;

create policy "communication managers read broadcasts" on public.email_broadcasts for select to authenticated
  using (private.has_tenant_permission(tenant_id, 'communications.manage'));
create policy "communication managers insert broadcasts" on public.email_broadcasts for insert to authenticated
  with check (private.has_tenant_permission(tenant_id, 'communications.manage'));
create policy "communication managers update broadcasts" on public.email_broadcasts for update to authenticated
  using (private.has_tenant_permission(tenant_id, 'communications.manage'))
  with check (private.has_tenant_permission(tenant_id, 'communications.manage'));
create policy "communication managers delete broadcasts" on public.email_broadcasts for delete to authenticated
  using (private.has_tenant_permission(tenant_id, 'communications.manage'));

create policy "communication managers manage recipient snapshots" on public.email_recipient_snapshots for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'communications.manage'))
  with check (private.has_tenant_permission(tenant_id, 'communications.manage'));

grant select, insert, update, delete on public.email_broadcasts, public.email_recipient_snapshots to authenticated;

