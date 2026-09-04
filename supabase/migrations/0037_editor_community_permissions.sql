-- Make configurable content moderation permissions effective at the RLS layer.

create or replace function private.can_post_to_space(check_space_id uuid, check_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.spaces s
    where s.id = check_space_id and s.tenant_id = check_tenant_id and s.status = 'published'
      and private.can_access_space(s.id, s.tenant_id)
      and (s.posting_permission = 'members' or private.has_tenant_permission(s.tenant_id, 'content.moderate'))
  );
$$;

create or replace function private.can_comment_on_post(check_post_id uuid, check_tenant_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.posts p join public.spaces s on s.id = p.space_id and s.tenant_id = p.tenant_id
    where p.id = check_post_id and p.tenant_id = check_tenant_id and s.status = 'published'
      and private.can_access_space(s.id, s.tenant_id) and s.commenting_permission <> 'disabled'
      and (s.commenting_permission = 'members' or private.has_tenant_permission(s.tenant_id, 'content.moderate'))
  );
$$;

drop policy if exists "permission holders delete posts" on public.posts;
create policy "permission holders delete posts" on public.posts for delete to authenticated
using (private.has_tenant_permission(tenant_id, 'content.moderate'));

drop policy if exists "permission holders update posts" on public.posts;
create policy "permission holders update posts" on public.posts for update to authenticated
using (private.has_tenant_permission(tenant_id, 'content.edit'))
with check (private.has_tenant_permission(tenant_id, 'content.edit'));

drop policy if exists "permission holders delete comments" on public.comments;
create policy "permission holders delete comments" on public.comments for delete to authenticated
using (private.has_tenant_permission(tenant_id, 'content.moderate'));

drop policy if exists "permission holders remove attachments" on public.post_attachments;
create policy "permission holders remove attachments" on public.post_attachments for delete to authenticated
using (private.has_tenant_permission(tenant_id, 'content.moderate'));

create or replace function public.set_post_pinned(check_post_id uuid, pinned boolean)
returns void language plpgsql security definer set search_path = '' as $$
declare current_post public.posts%rowtype;
begin
  select * into current_post from public.posts where id = check_post_id;
  if current_post.id is null or not private.has_tenant_permission(current_post.tenant_id, 'content.moderate') then
    raise exception 'Content moderation permission is required';
  end if;
  update public.posts set is_pinned = pinned, updated_at = now() where id = check_post_id;
  perform private.write_audit_log(current_post.tenant_id, (select auth.uid()),
    case when pinned then 'post.pinned' else 'post.unpinned' end, 'post', check_post_id::text, '{}'::jsonb);
end;
$$;
