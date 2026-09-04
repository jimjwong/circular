-- Add the APSS-inspired curated theme to the allowed tenant presets.

alter table public.tenants
  drop constraint if exists tenants_theme_preset_check;

alter table public.tenants
  add constraint tenants_theme_preset_check
  check (theme_preset in ('forest', 'ocean', 'sunset', 'violet', 'rose', 'slate', 'apss', 'custom'));
