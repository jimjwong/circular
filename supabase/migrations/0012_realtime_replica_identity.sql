-- Realtime publishes DELETE events for these mutable community tables. FULL
-- identity keeps deletes observable even where a table uses a composite key.
alter table public.posts replica identity full;
alter table public.comments replica identity full;
alter table public.reactions replica identity full;
alter table public.post_attachments replica identity full;
alter table public.notifications replica identity full;
