-- A new page kind whose dynamic parameter resolves against public.website_public_members
-- rather than a CMS collection entry, so a site's speaker/member directory can link to a
-- real per-member public profile page without duplicating member data into the CMS.
-- website_pages_template_needs_collection is untouched: it only constrains
-- 'collection_template' pages, so a 'member_profile' page correctly needs no collection_id.

alter table public.website_pages
  drop constraint website_pages_kind_check;

alter table public.website_pages
  add constraint website_pages_kind_check
  check (kind in ('page', 'landing', 'event', 'funnel', 'collection_template', 'member_profile'));

comment on column public.website_pages.kind is
  'member_profile pages resolve their :param against website_public_members by user_id, not a CMS collection.';
