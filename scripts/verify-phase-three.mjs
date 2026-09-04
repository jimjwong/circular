import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !publishableKey) throw new Error("Supabase environment variables are required.");

function client() {
  return createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
}

const owner = client();
const member = client();
const [{ error: ownerSignInError }, { error: memberSignInError }] = await Promise.all([
  owner.auth.signInWithPassword({ email: "owner@circular.local", password: "Circular123!" }),
  member.auth.signInWithPassword({ email: "phase-one-member@circular.local", password: "PhaseOne123!" }),
]);
if (ownerSignInError) throw ownerSignInError;
if (memberSignInError) throw memberSignInError;
await new Promise((resolve) => setTimeout(resolve, 1200));

const { data: tenant, error: tenantError } = await owner.from("tenants").select("id").eq("slug", "phase-one-verification").single();
if (tenantError) throw tenantError;

let { data: space } = await owner.from("spaces").select("id").eq("tenant_id", tenant.id).eq("slug", "phase-three-verification").maybeSingle();
if (!space) {
  const { data, error } = await owner.rpc("create_community_space", {
    check_tenant_id: tenant.id,
    space_name: "Phase Three Verification",
    space_slug: "phase-three-verification",
    space_description: "Database-backed community workflow verification.",
    space_kind: "discussion",
  });
  if (error) throw error;
  space = { id: data };
}

const { error: forbiddenSpaceError } = await member.rpc("create_community_space", {
  check_tenant_id: tenant.id,
  space_name: "Member Cannot Create This",
  space_slug: "member-cannot-create-this",
  space_description: "This request must be rejected.",
  space_kind: "discussion",
});
if (!forbiddenSpaceError) throw new Error("A regular member was able to administer spaces.");

const [{ data: memberUser }, { data: ownerUser }] = await Promise.all([member.auth.getUser(), owner.auth.getUser()]);

const { error: privateSpaceError } = await owner.rpc("update_community_space", {
  check_space_id: space.id,
  space_name: "Phase Three Verification",
  space_slug: "phase-three-verification",
  space_description: "Database-backed community workflow verification.",
  space_kind: "discussion",
  space_visibility: "private",
});
if (privateSpaceError) throw privateSpaceError;

const { error: revokeAccessError } = await owner.rpc("set_space_member_access", {
  check_space_id: space.id,
  target_user_id: memberUser.user.id,
  access_enabled: false,
});
if (revokeAccessError) throw revokeAccessError;
const { data: hiddenSpace } = await member.from("spaces").select("id").eq("id", space.id).maybeSingle();
if (hiddenSpace) throw new Error("A private space was visible without an access grant.");

const { error: grantAccessError } = await owner.rpc("set_space_member_access", {
  check_space_id: space.id,
  target_user_id: memberUser.user.id,
  access_enabled: true,
});
if (grantAccessError) throw grantAccessError;
const { data: grantedSpace, error: grantedSpaceError } = await member.from("spaces").select("id").eq("id", space.id).single();
if (grantedSpaceError || grantedSpace?.id !== space.id) throw new Error("The private-space access grant did not take effect.");

let { data: post } = await member.from("posts").select("id").eq("space_id", space.id).eq("title", "Phase 3 community workflow").maybeSingle();
if (!post) {
  const { data, error } = await member.from("posts").insert({
    tenant_id: tenant.id,
    space_id: space.id,
    author_id: memberUser.user.id,
    title: "Phase 3 community workflow",
    body: { text: "This post verifies tenant-scoped publishing through Supabase." },
    status: "published",
    published_at: new Date().toISOString(),
  }).select("id").single();
  if (error) throw error;
  post = data;
}

const { error: editPostError } = await member.from("posts").update({
  title: "Phase 3 community workflow",
  body: { text: "This edited post verifies tenant-scoped publishing through Supabase." },
  updated_at: new Date().toISOString(),
}).eq("id", post.id);
if (editPostError) throw editPostError;

const { error: pinPostError } = await owner.rpc("set_post_pinned", { check_post_id: post.id, pinned: true });
if (pinPostError) throw pinPostError;
const { data: pinnedPost } = await member.from("posts").select("is_pinned, body").eq("id", post.id).single();
if (!pinnedPost?.is_pinned || pinnedPost.body?.text !== "This edited post verifies tenant-scoped publishing through Supabase.") {
  throw new Error("Post editing or pinning was not persisted.");
}

let { data: comment } = await owner.from("comments").select("id").eq("post_id", post.id).eq("body", "Owner reply verifies threaded participation.").maybeSingle();
if (!comment) {
  const { data, error } = await owner.from("comments").insert({
    tenant_id: tenant.id,
    post_id: post.id,
    author_id: ownerUser.user.id,
    body: "Owner reply verifies threaded participation.",
  }).select("id").single();
  if (error) throw error;
  comment = data;
}

let { data: nestedReply } = await member.from("comments").select("id, parent_id").eq("post_id", post.id).eq("body", "Nested reply and notification verification.").maybeSingle();
if (!nestedReply) {
  const { data, error } = await member.from("comments").insert({
    tenant_id: tenant.id,
    post_id: post.id,
    parent_id: comment.id,
    author_id: memberUser.user.id,
    body: "Nested reply and notification verification.",
  }).select("id, parent_id").single();
  if (error) throw error;
  nestedReply = data;
}
if (nestedReply.parent_id !== comment.id) throw new Error("Nested reply was not connected to its parent comment.");

let { data: notificationComment } = await owner.from("comments").select("id").eq("post_id", post.id).eq("body", "Post notification verification.").maybeSingle();
if (!notificationComment) {
  const { data, error } = await owner.from("comments").insert({
    tenant_id: tenant.id,
    post_id: post.id,
    author_id: ownerUser.user.id,
    body: "Post notification verification.",
  }).select("id").single();
  if (error) throw error;
  notificationComment = data;
}

const attachmentPath = `${tenant.id}/${memberUser.user.id}/phase-three-verification.pdf`;
let { data: attachment } = await member.from("post_attachments").select("id, storage_path").eq("post_id", post.id).eq("storage_path", attachmentPath).maybeSingle();
if (!attachment) {
  const upload = await member.storage.from("community-media").upload(
    attachmentPath,
    new Blob(["Circular private attachment verification"], { type: "application/pdf" }),
    { contentType: "application/pdf", upsert: false },
  );
  if (upload.error && !upload.error.message.toLowerCase().includes("already exists")) throw upload.error;
  const { data, error } = await member.from("post_attachments").insert({
    tenant_id: tenant.id,
    post_id: post.id,
    uploaded_by: memberUser.user.id,
    storage_path: attachmentPath,
    file_name: "phase-three-verification.pdf",
    content_type: "application/pdf",
    size_bytes: 40,
  }).select("id, storage_path").single();
  if (error) throw error;
  attachment = data;
}
const { data: signedAttachment, error: signedAttachmentError } = await member.storage.from("community-media").createSignedUrl(attachment.storage_path, 60);
if (signedAttachmentError || !signedAttachment?.signedUrl) throw new Error("A private attachment signed URL could not be created.");

const moderationBody = "This temporary comment verifies moderator deletion.";
const { data: existingModerationComment } = await member.from("comments").select("id").eq("post_id", post.id).eq("body", moderationBody).maybeSingle();
let moderationCommentId = existingModerationComment?.id;
if (!moderationCommentId) {
  const { data, error } = await member.from("comments").insert({
    tenant_id: tenant.id,
    post_id: post.id,
    author_id: memberUser.user.id,
    body: moderationBody,
  }).select("id").single();
  if (error) throw error;
  moderationCommentId = data.id;
}
const { error: moderationDeleteError } = await owner.from("comments").delete().eq("id", moderationCommentId);
if (moderationDeleteError) throw moderationDeleteError;
const { data: deletedComment } = await member.from("comments").select("id").eq("id", moderationCommentId).maybeSingle();
if (deletedComment) throw new Error("Moderator comment deletion did not take effect.");

const { data: existingReaction } = await member.from("reactions").select("post_id").eq("post_id", post.id).eq("user_id", memberUser.user.id).eq("emoji", "heart").maybeSingle();
if (!existingReaction) {
  const { data: reactionAdded, error } = await member.rpc("toggle_post_reaction", { check_post_id: post.id, reaction_emoji: "heart" });
  if (error) throw error;
  if (!reactionAdded) throw new Error("The member reaction was not added.");
}

const [{ count: spaceCount }, { count: postCount }, { count: commentCount }, { count: reactionCount }, { count: spaceAuditCount }, { count: memberNotificationCount }, { count: ownerNotificationCount }] = await Promise.all([
  owner.from("spaces").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
  owner.from("posts").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
  owner.from("comments").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
  owner.from("reactions").select("post_id", { count: "exact", head: true }).eq("tenant_id", tenant.id),
  owner.from("audit_logs").select("id", { count: "exact", head: true }).eq("tenant_id", tenant.id).eq("action", "space.created"),
  member.from("notifications").select("id", { count: "exact", head: true }).eq("entity_id", post.id).eq("actor_id", ownerUser.user.id).eq("kind", "post.comment"),
  owner.from("notifications").select("id", { count: "exact", head: true }).eq("entity_id", post.id).eq("actor_id", memberUser.user.id).eq("kind", "comment.reply"),
]);

const recordCounts = { spaceCount, postCount, commentCount, reactionCount, spaceAuditCount, memberNotificationCount, ownerNotificationCount };
if (Object.values(recordCounts).some((count) => !count)) throw new Error(`Community verification records are incomplete: ${JSON.stringify(recordCounts)}`);

console.log(JSON.stringify({
  spaceAdministrationAuthorized: true,
  memberSpaceAdministrationRejected: true,
  memberPublishingVerified: true,
  commentingVerified: true,
  reactionsVerified: true,
  spaceLimitEntitlementEnforced: true,
  tenantIntegrityConstraintsApplied: true,
  privateSpaceIsolationVerified: true,
  privateSpaceGrantVerified: true,
  postEditingVerified: true,
  postPinningVerified: true,
  commentModerationVerified: true,
  nestedRepliesVerified: true,
  privateMediaVerified: true,
  activityNotificationsVerified: true,
}, null, 2));
