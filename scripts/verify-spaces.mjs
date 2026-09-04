import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase environment variables are required.");
const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const owner = makeClient();
const member = makeClient();
const [{ error: ownerAuthError }, { error: memberAuthError }] = await Promise.all([
  owner.auth.signInWithPassword({ email: "owner@circular.local", password: "Circular123!" }),
  member.auth.signInWithPassword({ email: "phase-one-member@circular.local", password: "PhaseOne123!" }),
]);
if (ownerAuthError) throw ownerAuthError;
if (memberAuthError) throw memberAuthError;

const { data: tenant, error: tenantError } = await owner.from("tenants").select("id").eq("slug", "phase-one-verification").single();
if (tenantError) throw tenantError;
let { data: group } = await owner.from("space_groups").select("id, name").eq("tenant_id", tenant.id).eq("name", "Community").maybeSingle();
if (!group) {
  const { data, error } = await owner.rpc("create_space_group", { check_tenant_id: tenant.id, group_name: "Community" });
  if (error) throw error;
  group = { id: data, name: "Community" };
}

const { error: forbiddenGroupError } = await member.rpc("create_space_group", { check_tenant_id: tenant.id, group_name: "Forbidden member group" });
if (!forbiddenGroupError) throw new Error("A regular member was able to create a space group.");

const { data: space, error: spaceError } = await owner.from("spaces").select("id").eq("tenant_id", tenant.id).eq("visibility", "members").limit(1).single();
if (spaceError) throw spaceError;
const { error: assignmentError } = await owner.rpc("set_space_group", { check_space_id: space.id, check_group_id: group.id });
if (assignmentError) throw assignmentError;
const { data: assigned, error: assignedError } = await owner.from("spaces").select("group_id").eq("id", space.id).single();
if (assignedError || assigned.group_id !== group.id) throw new Error("Space group assignment was not persisted.");

const { data: orderedSpaces, error: orderedSpacesError } = await owner.from("spaces").select("id").eq("tenant_id", tenant.id).order("position").order("created_at");
if (orderedSpacesError || orderedSpaces.length < 2) throw orderedSpacesError ?? new Error("At least two verification spaces are required.");
const reorderedIds = orderedSpaces.map((item) => item.id);
[reorderedIds[0], reorderedIds[1]] = [reorderedIds[1], reorderedIds[0]];
const { error: reorderError } = await owner.rpc("reorder_spaces", { check_tenant_id: tenant.id, ordered_space_ids: reorderedIds });
if (reorderError) throw reorderError;
const { error: forbiddenReorderError } = await member.rpc("reorder_spaces", { check_tenant_id: tenant.id, ordered_space_ids: reorderedIds });
if (!forbiddenReorderError) throw new Error("A regular member was able to reorder spaces.");
const { data: persistedOrder, error: persistedOrderError } = await owner.from("spaces").select("id").eq("tenant_id", tenant.id).order("position").order("created_at");
if (persistedOrderError || persistedOrder[0]?.id !== reorderedIds[0]) throw persistedOrderError ?? new Error("Space ordering was not persisted.");

const { error: permissionError } = await owner.rpc("update_space_content_permissions", { check_space_id: space.id, post_permission: "admins", comment_permission: "disabled" });
if (permissionError) throw permissionError;
const { data: memberUser } = await member.auth.getUser();
const { error: blockedPostError } = await member.from("posts").insert({ tenant_id: tenant.id, space_id: space.id, author_id: memberUser.user.id, title: "This post must be blocked", body: { text: "Permission verification" }, status: "published", published_at: new Date().toISOString() });
if (!blockedPostError) throw new Error("Member publishing ignored the space posting permission.");
const { data: existingPost } = await owner.from("posts").select("id").eq("space_id", space.id).limit(1).maybeSingle();
if (existingPost) {
  const { error: blockedCommentError } = await member.from("comments").insert({ tenant_id: tenant.id, post_id: existingPost.id, author_id: memberUser.user.id, body: "This comment must be blocked" });
  if (!blockedCommentError) throw new Error("Comment creation ignored the disabled space permission.");
}
const { error: restorePermissionError } = await owner.rpc("update_space_content_permissions", { check_space_id: space.id, post_permission: "members", comment_permission: "members" });
if (restorePermissionError) throw restorePermissionError;

const { error: layoutError } = await owner.rpc("update_space_layout", { check_space_id: space.id, space_layout: "card", right_sidebar: false, members_tab: true });
if (layoutError) throw layoutError;
const { error: forbiddenLayoutError } = await member.rpc("update_space_layout", { check_space_id: space.id, space_layout: "list", right_sidebar: true, members_tab: false });
if (!forbiddenLayoutError) throw new Error("A regular member was able to change the space layout.");
const { data: savedLayout, error: savedLayoutError } = await owner.from("spaces").select("layout, show_right_sidebar, show_members_tab").eq("id", space.id).single();
if (savedLayoutError || savedLayout.layout !== "card" || savedLayout.show_right_sidebar !== false || savedLayout.show_members_tab !== true) throw savedLayoutError ?? new Error("Space layout settings were not persisted.");
const { error: restoreLayoutError } = await owner.rpc("update_space_layout", { check_space_id: space.id, space_layout: "feed", right_sidebar: true, members_tab: true });
if (restoreLayoutError) throw restoreLayoutError;

const { error: draftError } = await owner.rpc("update_space_status", { check_space_id: space.id, next_status: "draft" });
if (draftError) throw draftError;
const { data: hiddenDraft } = await member.from("spaces").select("id").eq("id", space.id).maybeSingle();
if (hiddenDraft) throw new Error("A draft space was visible to a regular member.");
const { error: forbiddenStatusError } = await member.rpc("update_space_status", { check_space_id: space.id, next_status: "published" });
if (!forbiddenStatusError) throw new Error("A regular member was able to publish a space.");
const { error: publishError } = await owner.rpc("update_space_status", { check_space_id: space.id, next_status: "published" });
if (publishError) throw publishError;
const { data: restoredSpace, error: restoredSpaceError } = await member.from("spaces").select("id").eq("id", space.id).single();
if (restoredSpaceError || restoredSpace.id !== space.id) throw restoredSpaceError ?? new Error("The published space was not restored to members.");

const { error: appearanceError } = await owner.rpc("update_space_appearance", { check_space_id: space.id, space_icon: "wave", space_cover_url: "https://images.example.com/space-cover.jpg", space_accent_color: "#336699" });
if (appearanceError) throw appearanceError;
const { error: forbiddenAppearanceError } = await member.rpc("update_space_appearance", { check_space_id: space.id, space_icon: "hash", space_cover_url: "", space_accent_color: "#000000" });
if (!forbiddenAppearanceError) throw new Error("A regular member was able to change space appearance.");
const { data: savedAppearance, error: savedAppearanceError } = await owner.from("spaces").select("icon, cover_url, accent_color").eq("id", space.id).single();
if (savedAppearanceError || savedAppearance.icon !== "wave" || savedAppearance.cover_url !== "https://images.example.com/space-cover.jpg" || savedAppearance.accent_color !== "#336699") throw savedAppearanceError ?? new Error("Space appearance was not persisted.");
const { error: restoreAppearanceError } = await owner.rpc("update_space_appearance", { check_space_id: space.id, space_icon: "messages", space_cover_url: "", space_accent_color: "#2c6d51" });
if (restoreAppearanceError) throw restoreAppearanceError;

const { error: membershipModeError } = await owner.rpc("update_space_membership_mode", { check_space_id: space.id, next_mode: "optional" });
if (membershipModeError) throw membershipModeError;
const { error: forbiddenMembershipModeError } = await member.rpc("update_space_membership_mode", { check_space_id: space.id, next_mode: "automatic" });
if (!forbiddenMembershipModeError) throw new Error("A regular member was able to change the membership mode.");
const { error: joinError } = await member.rpc("join_space", { check_space_id: space.id });
if (joinError) throw joinError;
const { data: joinedRow, error: joinedRowError } = await member.from("space_members").select("space_id").eq("space_id", space.id).eq("user_id", memberUser.user.id).single();
if (joinedRowError || joinedRow.space_id !== space.id) throw joinedRowError ?? new Error("Optional space membership was not persisted.");
const { error: forbiddenModeratorError } = await member.rpc("set_space_moderator", { check_space_id: space.id, target_user_id: memberUser.user.id, moderator_enabled: true });
if (!forbiddenModeratorError) throw new Error("A regular member was able to assign a space moderator.");
const { error: moderatorError } = await owner.rpc("set_space_moderator", { check_space_id: space.id, target_user_id: memberUser.user.id, moderator_enabled: true });
if (moderatorError) throw moderatorError;
const { error: restrictForModeratorError } = await owner.rpc("update_space_content_permissions", { check_space_id: space.id, post_permission: "admins", comment_permission: "admins" });
if (restrictForModeratorError) throw restrictForModeratorError;
const { data: moderatorPost, error: moderatorPostError } = await member.from("posts").insert({ tenant_id: tenant.id, space_id: space.id, author_id: memberUser.user.id, title: "Space moderator permission verification", body: { text: "A per-space moderator can publish restricted content." }, status: "published", published_at: new Date().toISOString() }).select("id").single();
if (moderatorPostError) throw moderatorPostError;
await member.from("posts").delete().eq("id", moderatorPost.id);
const { error: removeModeratorError } = await owner.rpc("set_space_moderator", { check_space_id: space.id, target_user_id: memberUser.user.id, moderator_enabled: false });
if (removeModeratorError) throw removeModeratorError;
const { error: leaveError } = await member.rpc("leave_space", { check_space_id: space.id });
if (leaveError) throw leaveError;
const { error: restoreMembershipModeError } = await owner.rpc("update_space_membership_mode", { check_space_id: space.id, next_mode: "automatic" });
if (restoreMembershipModeError) throw restoreMembershipModeError;
const { error: restoreModeratorPermissionsError } = await owner.rpc("update_space_content_permissions", { check_space_id: space.id, post_permission: "members", comment_permission: "members" });
if (restoreModeratorPermissionsError) throw restoreModeratorPermissionsError;
const { count: analyticsPostCount, error: analyticsReadError } = await owner.from("posts").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("space_id", space.id).eq("status", "published");
if (analyticsReadError || analyticsPostCount === null) throw analyticsReadError ?? new Error("Space analytics data was unavailable.");
let { data: templateSpace } = await owner.from("spaces").select("id, kind, icon, accent_color, posting_permission, layout, membership_mode, visibility").eq("tenant_id", tenant.id).eq("slug", "template-verification").maybeSingle();
if (!templateSpace) {
  const { data: templateSpaceId, error: templateCreateError } = await owner.rpc("create_space_from_template", { check_tenant_id: tenant.id, template_key: "course-cohort", space_name: "Template verification", space_slug: "template-verification" });
  if (templateCreateError) throw templateCreateError;
  const { data, error } = await owner.from("spaces").select("id, kind, icon, accent_color, posting_permission, layout, membership_mode, visibility").eq("id", templateSpaceId).single();
  if (error) throw error;
  templateSpace = data;
}
if (templateSpace.kind !== "course" || templateSpace.icon !== "graduation" || templateSpace.posting_permission !== "admins" || templateSpace.layout !== "card" || templateSpace.membership_mode !== "invite" || templateSpace.visibility !== "private") throw new Error("The course space template was not fully applied.");
const { error: forbiddenTemplateError } = await member.rpc("create_space_from_template", { check_tenant_id: tenant.id, template_key: "introductions", space_name: "Forbidden template", space_slug: `forbidden-template-${Date.now()}` });
if (!forbiddenTemplateError) throw new Error("A regular member was able to create a space from a template.");

console.log(JSON.stringify({ spaceGroupsCreated: true, memberGroupAdministrationRejected: true, spaceGroupAssignmentVerified: true, spaceOrderingVerified: true, memberSpaceOrderingRejected: true, postingPermissionEnforced: true, commentingPermissionEnforced: true, spaceLayoutPersisted: true, memberLayoutAdministrationRejected: true, draftVisibilityEnforced: true, memberLifecycleAdministrationRejected: true, spaceRestoreVerified: true, spaceAppearancePersisted: true, memberAppearanceAdministrationRejected: true, optionalMembershipVerified: true, memberMembershipAdministrationRejected: true, memberModeratorAdministrationRejected: true, spaceModeratorPermissionVerified: true, spaceAnalyticsReadable: true, reusableTemplateVerified: true, memberTemplateCreationRejected: true }, null, 2));
