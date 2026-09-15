-- Tenant-scoped website builder: sites, drag-and-drop page documents, published
-- version snapshots, a lightweight CMS, and the domain/subdomain/directory mounts
-- that route public visitors to a site.
--
-- Authoring is gated on the existing 'website.manage' permission (0039). Published
-- content is additionally readable by anon so public pages render through RLS
-- instead of a service-role bypass.

create table if not exists public.website_sites (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  description text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  home_page_id uuid,
  favicon_url text,
  social_image_url text,
  brand jsonb not null default '{}'::jsonb check (jsonb_typeof(brand) = 'object'),
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, slug)
);

create table if not exists public.website_collections (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.website_sites(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 2 and 120),
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  description text,
  -- [{ key, label, type, required, options }] describing the entry shape.
  fields jsonb not null default '[]'::jsonb check (jsonb_typeof(fields) = 'array'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, slug)
);

create table if not exists public.website_pages (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.website_sites(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 160),
  -- Always stored with a leading slash. Dynamic templates use a ':param' segment.
  path text not null check (path ~ '^/[A-Za-z0-9/:_-]*$'),
  kind text not null default 'page'
    check (kind in ('page', 'landing', 'event', 'funnel', 'collection_template')),
  title text,
  description text,
  social_image_url text,
  status text not null default 'draft' check (status in ('draft', 'published')),
  sort_order integer not null default 0,
  collection_id uuid references public.website_collections(id) on delete set null,
  document jsonb not null default '{}'::jsonb check (jsonb_typeof(document) = 'object'),
  published_version_id uuid,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (site_id, path),
  -- A collection template is meaningless without the collection it iterates.
  constraint website_pages_template_needs_collection
    check (kind <> 'collection_template' or collection_id is not null)
);

create table if not exists public.website_page_versions (
  id uuid primary key default gen_random_uuid(),
  page_id uuid not null references public.website_pages(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  document jsonb not null check (jsonb_typeof(document) = 'object'),
  label text,
  published_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id)
);

alter table public.website_sites
  add constraint website_sites_home_page_fkey
  foreign key (home_page_id) references public.website_pages(id) on delete set null;

alter table public.website_pages
  add constraint website_pages_published_version_fkey
  foreign key (published_version_id) references public.website_page_versions(id) on delete set null;

create table if not exists public.website_collection_entries (
  id uuid primary key default gen_random_uuid(),
  collection_id uuid not null references public.website_collections(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  slug text not null check (slug ~ '^[a-z0-9-]+$'),
  title text not null check (char_length(trim(title)) between 1 and 200),
  status text not null default 'draft' check (status in ('draft', 'published')),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  published_at timestamptz,
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (collection_id, slug)
);

-- A site is reachable through any number of hosts plus at most one directory mount
-- on the main application host.
create table if not exists public.website_domains (
  id uuid primary key default gen_random_uuid(),
  site_id uuid not null references public.website_sites(id) on delete cascade,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  kind text not null check (kind in ('subdomain', 'custom', 'directory')),
  host text check (host ~ '^[a-z0-9.-]+$'),
  base_path text check (base_path ~ '^[a-z0-9-]+$'),
  is_primary boolean not null default false,
  verification_token text not null default encode(gen_random_bytes(16), 'hex'),
  status text not null default 'pending' check (status in ('pending', 'verified', 'error')),
  error_message text,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- Host mounts carry a host, directory mounts carry a path. Never both.
  constraint website_domains_target_shape check (
    (kind in ('subdomain', 'custom') and host is not null and base_path is null)
    or (kind = 'directory' and base_path is not null and host is null)
  )
);

create unique index if not exists website_domains_host_key
  on public.website_domains (lower(host)) where host is not null;
create unique index if not exists website_domains_base_path_key
  on public.website_domains (lower(base_path)) where base_path is not null;
create unique index if not exists website_domains_one_primary_per_site
  on public.website_domains (site_id) where is_primary;

create index if not exists website_sites_tenant_idx on public.website_sites (tenant_id);
create index if not exists website_pages_site_idx on public.website_pages (site_id, sort_order);
create index if not exists website_pages_lookup_idx on public.website_pages (site_id, path) where status = 'published';
create index if not exists website_page_versions_page_idx on public.website_page_versions (page_id, published_at desc);
create index if not exists website_collections_site_idx on public.website_collections (site_id);
create index if not exists website_collection_entries_collection_idx
  on public.website_collection_entries (collection_id, status);
create index if not exists website_domains_site_idx on public.website_domains (site_id);

-- Resolves whether a site is publicly visible. Security definer so the anon policies
-- below can consult it without granting anon direct reads on unpublished rows.
create or replace function private.website_site_is_public(check_site_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.website_sites ws
    where ws.id = check_site_id and ws.status = 'published'
  );
$$;

alter table public.website_sites enable row level security;
alter table public.website_pages enable row level security;
alter table public.website_page_versions enable row level security;
alter table public.website_collections enable row level security;
alter table public.website_collection_entries enable row level security;
alter table public.website_domains enable row level security;

-- Authoring: anyone holding website.manage in the owning tenant.
create policy "website managers manage sites" on public.website_sites for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'website.manage'))
  with check (private.has_tenant_permission(tenant_id, 'website.manage'));
create policy "website managers manage pages" on public.website_pages for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'website.manage'))
  with check (private.has_tenant_permission(tenant_id, 'website.manage'));
create policy "website managers manage versions" on public.website_page_versions for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'website.manage'))
  with check (private.has_tenant_permission(tenant_id, 'website.manage'));
create policy "website managers manage collections" on public.website_collections for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'website.manage'))
  with check (private.has_tenant_permission(tenant_id, 'website.manage'));
create policy "website managers manage entries" on public.website_collection_entries for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'website.manage'))
  with check (private.has_tenant_permission(tenant_id, 'website.manage'));
create policy "website managers manage domains" on public.website_domains for all to authenticated
  using (private.has_tenant_permission(tenant_id, 'website.manage'))
  with check (private.has_tenant_permission(tenant_id, 'website.manage'));

-- Public delivery: published rows on published sites, for signed-out visitors too.
create policy "anyone reads published sites" on public.website_sites for select to anon, authenticated
  using (status = 'published');
create policy "anyone reads published pages" on public.website_pages for select to anon, authenticated
  using (status = 'published' and private.website_site_is_public(site_id));
create policy "anyone reads published versions" on public.website_page_versions for select to anon, authenticated
  using (exists (
    select 1 from public.website_pages wp
    where wp.published_version_id = website_page_versions.id
      and wp.status = 'published'
      and private.website_site_is_public(wp.site_id)
  ));
create policy "anyone reads collections of published sites" on public.website_collections for select to anon, authenticated
  using (private.website_site_is_public(site_id));
create policy "anyone reads published entries" on public.website_collection_entries for select to anon, authenticated
  using (status = 'published' and exists (
    select 1 from public.website_collections wc
    where wc.id = collection_id and private.website_site_is_public(wc.site_id)
  ));
create policy "anyone resolves verified domains" on public.website_domains for select to anon, authenticated
  using (status = 'verified' and private.website_site_is_public(site_id));

grant select on public.website_sites, public.website_pages, public.website_page_versions,
  public.website_collections, public.website_collection_entries, public.website_domains to anon;
grant select, insert, update, delete on public.website_sites, public.website_pages,
  public.website_page_versions, public.website_collections, public.website_collection_entries,
  public.website_domains to authenticated;

grant execute on function private.website_site_is_public(uuid) to anon, authenticated;

-- Site imagery is served to anonymous visitors, so this bucket is public-read while
-- writes stay behind website.manage.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('website-assets', 'website-assets', true, 10485760,
  array['image/jpeg','image/png','image/webp','image/gif','image/svg+xml','application/pdf'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "website managers upload site assets" on storage.objects for insert to authenticated
with check (
  bucket_id = 'website-assets'
  and private.has_tenant_permission(((storage.foldername(name))[1])::uuid, 'website.manage')
);
create policy "website managers remove site assets" on storage.objects for delete to authenticated
using (
  bucket_id = 'website-assets'
  and private.has_tenant_permission(((storage.foldername(name))[1])::uuid, 'website.manage')
);

comment on table public.website_sites is 'Tenant websites built with the drag-and-drop builder.';
comment on column public.website_pages.document is 'Draft page document: instances, props, style sources, breakpoints, data sources.';
comment on column public.website_pages.path is 'Site-relative path; a :param segment marks a collection template route.';
comment on table public.website_domains is 'Custom domains, subdomains, and directory mounts pointing at a site.';
