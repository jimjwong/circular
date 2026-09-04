-- Visual identity for each space.

alter table public.spaces
  add column if not exists cover_url text,
  add column if not exists accent_color text not null default '#2c6d51';

alter table public.spaces drop constraint if exists spaces_cover_url_check;
alter table public.spaces add constraint spaces_cover_url_check check (cover_url is null or (length(cover_url) <= 500 and cover_url ~ '^https?://'));
alter table public.spaces drop constraint if exists spaces_accent_color_check;
alter table public.spaces add constraint spaces_accent_color_check check (accent_color ~ '^#[0-9A-Fa-f]{6}$');

create or replace function public.update_space_appearance(
  check_space_id uuid,
  space_icon text,
  space_cover_url text,
  space_accent_color text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_space public.spaces%rowtype;
  clean_icon text := nullif(trim(space_icon), '');
  clean_cover text := nullif(trim(space_cover_url), '');
begin
  select * into current_space from public.spaces where id = check_space_id;
  if current_space.id is null or not private.has_tenant_role(current_space.tenant_id, array['owner','admin']::public.tenant_role[]) then
    raise exception 'Organization administrator access is required';
  end if;
  if clean_icon is not null and length(clean_icon) > 24 then raise exception 'Space icon is too long'; end if;
  if clean_cover is not null and (length(clean_cover) > 500 or clean_cover !~ '^https?://') then raise exception 'Cover image URL is invalid'; end if;
  if space_accent_color !~ '^#[0-9A-Fa-f]{6}$' then raise exception 'Accent color is invalid'; end if;
  update public.spaces set icon = clean_icon, cover_url = clean_cover, accent_color = lower(space_accent_color) where id = check_space_id;
  perform private.write_audit_log(current_space.tenant_id, (select auth.uid()), 'space.appearance_updated', 'space', check_space_id::text, jsonb_build_object('icon', clean_icon, 'has_cover', clean_cover is not null, 'accent_color', lower(space_accent_color)));
end;
$$;

revoke all on function public.update_space_appearance(uuid, text, text, text) from public;
grant execute on function public.update_space_appearance(uuid, text, text, text) to authenticated;
