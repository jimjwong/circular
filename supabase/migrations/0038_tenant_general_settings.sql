-- Persist the remaining general workspace setting used by the admin UI.

alter table public.tenants
  add column if not exists is_discoverable boolean not null default true;

comment on column public.tenants.is_discoverable is
  'Whether the community may be listed in discovery and search experiences.';
