-- Phase 3: private media, nested replies, notifications, and realtime feeds.

alter table public.comments
  add constraint comments_parent_tenant_fk
  foreign key (parent_id, tenant_id) references public.comments(id, tenant_id) on delete cascade;

create table public.post_attachments (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  post_id uuid not null,
  uploaded_by uuid not null references auth.users(id),
  storage_path text not null unique,
  file_name text not null,
  content_type text not null,
  size_bytes bigint not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  foreign key (post_id, tenant_id) references public.posts(id, tenant_id) on delete cascade
);

create table public.notifications (
  id bigint generated always as identity primary key,
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  actor_id uuid references auth.users(id) on delete set null,
  kind text not null check (kind in ('post.comment', 'comment.reply', 'post.reaction')),
  entity_type text not null,
  entity_id uuid not null,
  message text not null,
  read_at timestamptz,
  created_at timestamptz not null default now()
);

create index notifications_user_created_idx on public.notifications (user_id, created_at desc);
create index post_attachments_post_idx on public.post_attachments (post_id, created_at);
alter table public.post_attachments enable row level security;
alter table public.notifications enable row level security;

create policy "members read accessible attachments" on public.post_attachments for select to authenticated
using (exists (select 1 from public.posts p where p.id = post_id and private.can_access_space(p.space_id, p.tenant_id)));
create policy "authors attach files to accessible posts" on public.post_attachments for insert to authenticated
with check (
  uploaded_by = (select auth.uid())
  and exists (
    select 1 from public.posts p
    where p.id = post_id and p.tenant_id = tenant_id
      and private.can_access_space(p.space_id, p.tenant_id)
      and (p.author_id = (select auth.uid()) or private.has_tenant_role(p.tenant_id, array['owner','admin']::public.tenant_role[]))
  )
);
create policy "uploaders and moderators remove attachments" on public.post_attachments for delete to authenticated
using (uploaded_by = (select auth.uid()) or private.has_tenant_role(tenant_id, array['owner','admin','moderator']::public.tenant_role[]));

create policy "users read own notifications" on public.notifications for select to authenticated using (user_id = (select auth.uid()));
create policy "users update own notifications" on public.notifications for update to authenticated using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

revoke all on table public.post_attachments, public.notifications from anon;
grant select, insert, delete on table public.post_attachments to authenticated;
grant select, update on table public.notifications to authenticated;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('community-media', 'community-media', false, 10485760, array['image/jpeg','image/png','image/webp','image/gif','video/mp4','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "members upload community media" on storage.objects for insert to authenticated
with check (
  bucket_id = 'community-media'
  and (storage.foldername(name))[2] = (select auth.uid())::text
  and public.is_tenant_member(((storage.foldername(name))[1])::uuid)
);
create policy "members read accessible community media" on storage.objects for select to authenticated
using (
  bucket_id = 'community-media'
  and exists (select 1 from public.post_attachments pa where pa.storage_path = name)
);
create policy "owners remove community media" on storage.objects for delete to authenticated
using (
  bucket_id = 'community-media'
  and (
    (storage.foldername(name))[2] = (select auth.uid())::text
    or exists (
    select 1 from public.post_attachments pa
    where pa.storage_path = name
      and (pa.uploaded_by = (select auth.uid()) or private.has_tenant_role(pa.tenant_id, array['owner','admin','moderator']::public.tenant_role[]))
    )
  )
);

create or replace function private.notify_community_activity()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  recipient_id uuid;
  parent_author_id uuid;
begin
  if tg_table_name = 'comments' then
    select author_id into recipient_id from public.posts where id = new.post_id;
    if new.parent_id is not null then
      select author_id into parent_author_id from public.comments where id = new.parent_id;
      if parent_author_id is distinct from new.author_id then
        insert into public.notifications (tenant_id, user_id, actor_id, kind, entity_type, entity_id, message)
        values (new.tenant_id, parent_author_id, new.author_id, 'comment.reply', 'post', new.post_id, 'replied to your comment');
      end if;
    elsif recipient_id is distinct from new.author_id then
      insert into public.notifications (tenant_id, user_id, actor_id, kind, entity_type, entity_id, message)
      values (new.tenant_id, recipient_id, new.author_id, 'post.comment', 'post', new.post_id, 'commented on your post');
    end if;
  elsif tg_table_name = 'reactions' and new.post_id is not null then
    select author_id into recipient_id from public.posts where id = new.post_id;
    if recipient_id is distinct from new.user_id then
      insert into public.notifications (tenant_id, user_id, actor_id, kind, entity_type, entity_id, message)
      values (new.tenant_id, recipient_id, new.user_id, 'post.reaction', 'post', new.post_id, 'reacted to your post');
    end if;
  end if;
  return new;
end; $$;

create trigger notify_on_comment after insert on public.comments for each row execute function private.notify_community_activity();
create trigger notify_on_reaction after insert on public.reactions for each row execute function private.notify_community_activity();

do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'posts') then alter publication supabase_realtime add table public.posts; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'comments') then alter publication supabase_realtime add table public.comments; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'reactions') then alter publication supabase_realtime add table public.reactions; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'post_attachments') then alter publication supabase_realtime add table public.post_attachments; end if;
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'notifications') then alter publication supabase_realtime add table public.notifications; end if;
end $$;
