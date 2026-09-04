-- Tenant-level visual themes. Members can read their workspace theme while only
-- tenant owners and admins can change it through the existing tenant update policy.

alter table public.tenants
  add column theme_preset text not null default 'forest'
    check (theme_preset in ('forest', 'ocean', 'sunset', 'violet', 'rose', 'slate', 'custom')),
  add column theme_config jsonb not null default '{}'::jsonb
    check (jsonb_typeof(theme_config) = 'object');

comment on column public.tenants.theme_preset is
  'Named Circular theme preset, or custom when tenant-selected values are used.';

comment on column public.tenants.theme_config is
  'Validated color and typography overrides for the tenant theme.';
