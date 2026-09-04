-- Event artwork and external registration destinations for imported and hosted events.

alter table public.events
  add column if not exists image_url text,
  add column if not exists registration_url text;

alter table public.events drop constraint if exists events_image_url_check;
alter table public.events add constraint events_image_url_check
  check (image_url is null or (length(image_url) <= 1000 and image_url ~ '^https?://'));

alter table public.events drop constraint if exists events_registration_url_check;
alter table public.events add constraint events_registration_url_check
  check (registration_url is null or (length(registration_url) <= 1000 and registration_url ~ '^https?://'));
