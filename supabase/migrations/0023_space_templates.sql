-- Reusable, opinionated space starters for fast community setup.

create or replace function public.create_space_from_template(
  check_tenant_id uuid,
  template_key text,
  space_name text,
  space_slug text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  new_space_id uuid;
  template_description text;
  template_kind public.space_kind;
  template_icon text;
  template_accent text;
  template_posting text;
  template_commenting text;
  template_layout text;
  template_membership text;
begin
  if not private.has_tenant_role(check_tenant_id, array['owner','admin']::public.tenant_role[]) then
    raise exception 'Organization administrator access is required';
  end if;

  case template_key
    when 'announcements' then
      template_description := 'Important updates and news from the team.'; template_kind := 'discussion'; template_icon := 'megaphone'; template_accent := '#b86b32'; template_posting := 'admins'; template_commenting := 'members'; template_layout := 'list'; template_membership := 'automatic';
    when 'introductions' then
      template_description := 'A welcoming place for new members to introduce themselves.'; template_kind := 'discussion'; template_icon := 'wave'; template_accent := '#2c7a68'; template_posting := 'members'; template_commenting := 'members'; template_layout := 'feed'; template_membership := 'automatic';
    when 'member-lounge' then
      template_description := 'Casual conversations, questions, and everyday community wins.'; template_kind := 'chat'; template_icon := 'coffee'; template_accent := '#76543d'; template_posting := 'members'; template_commenting := 'members'; template_layout := 'feed'; template_membership := 'optional';
    when 'course-cohort' then
      template_description := 'Course discussions, exercises, resources, and learner support.'; template_kind := 'course'; template_icon := 'graduation'; template_accent := '#566bb0'; template_posting := 'admins'; template_commenting := 'members'; template_layout := 'card'; template_membership := 'invite';
    when 'events-hub' then
      template_description := 'Upcoming gatherings, event details, reminders, and replays.'; template_kind := 'event'; template_icon := 'megaphone'; template_accent := '#9a4e67'; template_posting := 'admins'; template_commenting := 'members'; template_layout := 'list'; template_membership := 'automatic';
    else raise exception 'Unknown space template';
  end case;

  new_space_id := public.create_community_space(check_tenant_id, space_name, space_slug, template_description, template_kind);
  update public.spaces set
    icon = template_icon,
    accent_color = template_accent,
    posting_permission = template_posting,
    commenting_permission = template_commenting,
    layout = template_layout,
    membership_mode = template_membership,
    visibility = case when template_membership = 'invite' then 'private' else 'members' end
  where id = new_space_id;

  perform private.write_audit_log(check_tenant_id, (select auth.uid()), 'space.created_from_template', 'space', new_space_id::text, jsonb_build_object('template', template_key));
  return new_space_id;
end;
$$;

revoke all on function public.create_space_from_template(uuid, text, text, text) from public;
grant execute on function public.create_space_from_template(uuid, text, text, text) to authenticated;
