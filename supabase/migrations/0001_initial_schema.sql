-- Circular multi-tenant foundation
-- Apply with `supabase db reset` locally or paste into the Supabase SQL editor.

create extension if not exists "pgcrypto";

create type public.tenant_role as enum ('owner', 'admin', 'moderator', 'member');
create type public.space_kind as enum ('discussion', 'chat', 'course', 'event', 'members', 'custom');
create type public.content_status as enum ('draft', 'scheduled', 'published', 'archived');
create type public.billing_interval as enum ('one_time', 'monthly', 'quarterly', 'annual');

create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique check (slug ~ '^[a-z0-9-]+$'),
  description text,
  logo_url text,
  accent_color text not null default '#176b4d',
  plan text not null default 'pro',
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  avatar_url text,
  bio text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.tenant_memberships (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role public.tenant_role not null default 'member',
  headline text,
  activity_score integer not null default 0 check (activity_score between 0 and 100),
  status text not null default 'active',
  joined_at timestamptz not null default now(),
  primary key (tenant_id, user_id)
);

create table public.space_groups (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_id uuid references public.space_groups(id) on delete set null,
  name text not null,
  slug text not null,
  description text,
  kind public.space_kind not null default 'discussion',
  icon text,
  visibility text not null default 'members',
  position integer not null default 0,
  created_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table public.posts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  space_id uuid not null references public.spaces(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  title text,
  body jsonb not null default '{}',
  status public.content_status not null default 'published',
  is_pinned boolean not null default false,
  published_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.comments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  post_id uuid not null references public.posts(id) on delete cascade,
  author_id uuid not null references auth.users(id),
  parent_id uuid references public.comments(id) on delete cascade,
  body text not null,
  created_at timestamptz not null default now()
);

create table public.reactions (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  post_id uuid references public.posts(id) on delete cascade,
  comment_id uuid references public.comments(id) on delete cascade,
  emoji text not null default 'heart',
  created_at timestamptz not null default now(),
  check ((post_id is not null)::int + (comment_id is not null)::int = 1),
  unique nulls not distinct (user_id, post_id, comment_id, emoji)
);

create table public.events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete set null,
  host_id uuid not null references auth.users(id),
  title text not null,
  description text,
  starts_at timestamptz not null,
  ends_at timestamptz,
  location_type text not null default 'live_room',
  location_url text,
  capacity integer,
  status text not null default 'scheduled',
  created_at timestamptz not null default now()
);

create table public.event_rsvps (
  event_id uuid not null references public.events(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  status text not null default 'going',
  created_at timestamptz not null default now(),
  primary key (event_id, user_id)
);

create table public.courses (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  space_id uuid references public.spaces(id) on delete set null,
  title text not null,
  description text,
  cover_url text,
  status public.content_status not null default 'draft',
  created_at timestamptz not null default now()
);

create table public.course_lessons (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  course_id uuid not null references public.courses(id) on delete cascade,
  title text not null,
  body jsonb not null default '{}',
  video_url text,
  position integer not null default 0,
  is_preview boolean not null default false
);

create table public.course_progress (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  lesson_id uuid not null references public.course_lessons(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_at timestamptz,
  percent integer not null default 0 check (percent between 0 and 100),
  primary key (lesson_id, user_id)
);

create table public.tags (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  color text,
  unique (tenant_id, name)
);

create table public.member_tags (
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  tag_id uuid not null references public.tags(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (tag_id, user_id)
);

create table public.email_broadcasts (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  created_by uuid not null references auth.users(id),
  subject text not null,
  preview_text text,
  body jsonb not null default '{}',
  audience_filter jsonb not null default '{}',
  status public.content_status not null default 'draft',
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now()
);

create table public.workflows (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  trigger_config jsonb not null default '{}',
  audience_rules jsonb not null default '{}',
  actions jsonb not null default '[]',
  is_active boolean not null default false,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table public.ai_agents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  purpose text not null,
  instructions text,
  knowledge_sources jsonb not null default '[]',
  is_active boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.offers (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null,
  description text,
  price_cents integer not null check (price_cents >= 0),
  currency text not null default 'USD',
  interval public.billing_interval not null,
  trial_days integer not null default 0,
  access_rules jsonb not null default '{}',
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);

create table public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  offer_id uuid not null references public.offers(id),
  user_id uuid not null references auth.users(id),
  provider_customer_id text,
  provider_subscription_id text,
  status text not null,
  period_ends_at timestamptz,
  created_at timestamptz not null default now()
);

create index on public.tenant_memberships (user_id, tenant_id);
create index on public.posts (tenant_id, space_id, published_at desc);
create index on public.events (tenant_id, starts_at);
create index on public.email_broadcasts (tenant_id, status);
create index on public.subscriptions (tenant_id, user_id, status);

create or replace function public.is_tenant_member(check_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = check_tenant_id and tm.user_id = auth.uid() and tm.status = 'active'
  );
$$;

create or replace function public.can_manage_tenant(check_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.tenant_memberships tm
    where tm.tenant_id = check_tenant_id and tm.user_id = auth.uid()
      and tm.role in ('owner', 'admin') and tm.status = 'active'
  );
$$;

alter table public.tenants enable row level security;
alter table public.profiles enable row level security;
alter table public.tenant_memberships enable row level security;

create policy "members can read tenant" on public.tenants for select using (public.is_tenant_member(id));
create policy "users can create tenant" on public.tenants for insert with check (created_by = auth.uid());
create policy "owners can update tenant" on public.tenants for update using (public.can_manage_tenant(id));
create policy "users read tenant profiles" on public.profiles for select using (
  id = auth.uid() or exists (
    select 1 from public.tenant_memberships mine join public.tenant_memberships theirs on theirs.tenant_id = mine.tenant_id
    where mine.user_id = auth.uid() and theirs.user_id = profiles.id
  )
);
create policy "users update own profile" on public.profiles for update using (id = auth.uid());
create policy "members read memberships" on public.tenant_memberships for select using (public.is_tenant_member(tenant_id));
create policy "admins manage memberships" on public.tenant_memberships for all using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id));
create policy "creator bootstraps owner membership" on public.tenant_memberships for insert with check (
  user_id = auth.uid() and role = 'owner' and exists (
    select 1 from public.tenants t where t.id = tenant_id and t.created_by = auth.uid()
  )
);

do $$
declare table_name text;
begin
  foreach table_name in array array[
    'space_groups','spaces','posts','comments','reactions','events','event_rsvps','courses',
    'course_lessons','course_progress','tags','member_tags','email_broadcasts','workflows',
    'ai_agents','offers','subscriptions'
  ] loop
    execute format('alter table public.%I enable row level security', table_name);
    execute format('create policy "tenant members can read" on public.%I for select using (public.is_tenant_member(tenant_id))', table_name);
    execute format('create policy "tenant admins can insert" on public.%I for insert with check (public.can_manage_tenant(tenant_id))', table_name);
    execute format('create policy "tenant admins can update" on public.%I for update using (public.can_manage_tenant(tenant_id)) with check (public.can_manage_tenant(tenant_id))', table_name);
    execute format('create policy "tenant admins can delete" on public.%I for delete using (public.can_manage_tenant(tenant_id))', table_name);
  end loop;
end $$;

-- Members may author and manage their own discussions while tenant boundaries remain enforced.
create policy "members create posts" on public.posts for insert with check (
  public.is_tenant_member(tenant_id) and author_id = auth.uid()
);
create policy "authors update posts" on public.posts for update using (
  public.is_tenant_member(tenant_id) and author_id = auth.uid()
);
create policy "members create comments" on public.comments for insert with check (
  public.is_tenant_member(tenant_id) and author_id = auth.uid()
);
create policy "authors update comments" on public.comments for update using (
  public.is_tenant_member(tenant_id) and author_id = auth.uid()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, display_name, avatar_url)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'full_name', split_part(new.email, '@', 1)), new.raw_user_meta_data ->> 'avatar_url');
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();
