-- Events and courses are readable only by tenant members, but the EventList and
-- CourseList blocks have to render for anonymous visitors of a published site.
-- These security-definer functions expose the narrow, non-sensitive projection those
-- blocks need, and only for sites that are actually published.

create or replace function public.website_public_events(check_site_id uuid, max_count integer default 6)
returns table (id uuid, title text, description text, starts_at timestamptz, location_url text)
language sql stable security definer set search_path = '' as $$
  select e.id, e.title, e.description, e.starts_at, e.location_url
  from public.events e
  join public.website_sites ws on ws.tenant_id = e.tenant_id
  where ws.id = check_site_id
    and ws.status = 'published'
    and e.status = 'scheduled'
    and e.starts_at >= now()
    -- Events hidden from some roles are never surfaced on a public page.
    and coalesce(array_length(e.hidden_roles, 1), 0) = 0
  order by e.starts_at
  limit greatest(least(coalesce(max_count, 6), 24), 1);
$$;

create or replace function public.website_public_courses(check_site_id uuid, max_count integer default 6)
returns table (id uuid, title text, description text)
language sql stable security definer set search_path = '' as $$
  select c.id, c.title, c.description
  from public.courses c
  join public.website_sites ws on ws.tenant_id = c.tenant_id
  where ws.id = check_site_id
    and ws.status = 'published'
    and c.status = 'published'
    and c.access_mode <> 'private'
  order by c.created_at desc
  limit greatest(least(coalesce(max_count, 6), 24), 1);
$$;

revoke all on function public.website_public_events(uuid, integer) from public;
revoke all on function public.website_public_courses(uuid, integer) from public;
grant execute on function public.website_public_events(uuid, integer) to anon, authenticated;
grant execute on function public.website_public_courses(uuid, integer) to anon, authenticated;

comment on function public.website_public_events(uuid, integer) is
  'Upcoming, non-role-restricted events of a published site''s tenant, for public page rendering.';
comment on function public.website_public_courses(uuid, integer) is
  'Published, non-private courses of a published site''s tenant, for public page rendering.';
