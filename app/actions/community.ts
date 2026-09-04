"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActiveOrganization, requireOrganizationRole, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const spaceSchema = z.object({
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(280).optional(),
  kind: z.enum(["discussion", "chat", "course", "event", "members", "custom"]),
  visibility: z.enum(["members", "private"]).default("members"),
});

const postSchema = z.object({
  spaceId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(10000),
});

const commentSchema = z.object({
  postId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
  parentId: z.string().uuid().optional(),
});

const attachmentSchema = z.object({
  postId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  fileName: z.string().trim().min(1).max(255),
  contentType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "application/pdf"]),
  sizeBytes: z.coerce.number().int().min(1).max(10 * 1024 * 1024),
});

const spaceSettingsSchema = spaceSchema.extend({
  spaceId: z.string().uuid(),
});

const spaceGroupSchema = z.object({ name: z.string().trim().min(1).max(60) });
const contentPermissionSchema = z.object({
  spaceId: z.string().uuid(),
  postingPermission: z.enum(["members", "admins"]),
  commentingPermission: z.enum(["members", "admins", "disabled"]),
});
const spaceLayoutSchema = z.object({
  spaceId: z.string().uuid(),
  layout: z.enum(["feed", "list", "card"]),
  showRightSidebar: z.enum(["true", "false"]).transform((value) => value === "true"),
  showMembersTab: z.enum(["true", "false"]).transform((value) => value === "true"),
});
const spaceStatusSchema = z.object({ spaceId: z.string().uuid(), status: z.enum(["draft", "published", "archived"]) });
const spaceAppearanceSchema = z.object({
  spaceId: z.string().uuid(),
  icon: z.string().trim().max(24),
  coverUrl: z.union([z.literal(""), z.string().trim().url().max(500)]),
  accentColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});
const spaceMembershipModeSchema = z.object({
  spaceId: z.string().uuid(),
  membershipMode: z.enum(["automatic", "optional", "invite"]),
});
const spaceTemplateSchema = z.object({
  templateKey: z.enum(["announcements", "introductions", "member-lounge", "course-cohort", "events-hub"]),
  name: z.string().trim().min(2).max(80),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
});

const editPostSchema = z.object({
  postId: z.string().uuid(),
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(1).max(10000),
});

const introductionSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  headline: z.string().trim().min(2).max(100),
  location: z.string().trim().max(80),
  bio: z.string().trim().min(20).max(1000),
  goal: z.string().trim().min(10).max(500),
  interests: z.string().trim().max(240).transform((value) => [...new Set(value.split(",").map((item) => item.trim()).filter(Boolean))].slice(0, 8)),
});

function assertContentEnabled(status: string) {
  if (!["trial", "active"].includes(status)) {
    throw new Error("This organization cannot publish content in its current state.");
  }
}

export async function createCommunitySpace(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  assertContentEnabled(organization.status);
  const parsed = spaceSchema.safeParse({
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    kind: formData.get("kind"),
    visibility: formData.get("visibility") || "members",
  });
  if (!parsed.success) throw new Error("Enter a valid space name, URL, type, and description.");

  const supabase = await createClient();
  const { data: spaceId, error } = await supabase.rpc("create_community_space", {
    check_tenant_id: organization.id,
    space_name: parsed.data.name,
    space_slug: parsed.data.slug,
    space_description: parsed.data.description ?? "",
    space_kind: parsed.data.kind,
  });
  if (error) throw new Error(error.message);
  if (parsed.data.visibility === "private" && spaceId) {
    const { error: visibilityError } = await supabase.rpc("update_community_space", {
      check_space_id: spaceId,
      space_name: parsed.data.name,
      space_slug: parsed.data.slug,
      space_description: parsed.data.description ?? "",
      space_kind: parsed.data.kind,
      space_visibility: parsed.data.visibility,
    });
    if (visibilityError) throw new Error(visibilityError.message);
  }
  revalidatePath("/community");
  revalidatePath("/spaces");
}

export async function createCommunitySpaceGroup(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const parsed = spaceGroupSchema.safeParse({ name: formData.get("name") });
  if (!parsed.success) throw new Error("Enter a group name between 1 and 60 characters.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("create_space_group", { check_tenant_id: organization.id, group_name: parsed.data.name });
  if (error) throw new Error(error.message);
  revalidatePath("/spaces");
}

export async function setCommunitySpaceGroup(formData: FormData) {
  await requireOrganizationRole(["owner", "admin"]);
  const spaceId = z.string().uuid().parse(formData.get("spaceId"));
  const rawGroupId = String(formData.get("groupId") ?? "");
  const groupId = rawGroupId ? z.string().uuid().parse(rawGroupId) : null;
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_space_group", { check_space_id: spaceId, check_group_id: groupId });
  if (error) throw new Error(error.message);
  revalidatePath("/spaces");
  revalidatePath(`/community/spaces/${spaceId}`);
}

export async function moveCommunitySpace(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const spaceId = z.string().uuid().parse(formData.get("spaceId"));
  const direction = z.enum(["up", "down"]).parse(formData.get("direction"));
  const supabase = await createClient();
  const { data: spaces, error: spacesError } = await supabase.from("spaces").select("id").eq("tenant_id", organization.id).order("position").order("created_at");
  if (spacesError) throw new Error(spacesError.message);
  const orderedIds = (spaces ?? []).map((space) => space.id);
  const currentIndex = orderedIds.indexOf(spaceId);
  const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= orderedIds.length) return;
  [orderedIds[currentIndex], orderedIds[nextIndex]] = [orderedIds[nextIndex], orderedIds[currentIndex]];
  const { error } = await supabase.rpc("reorder_spaces", { check_tenant_id: organization.id, ordered_space_ids: orderedIds });
  if (error) throw new Error(error.message);
  revalidatePath("/spaces");
  revalidatePath("/community");
}

export async function updateCommunitySpaceContentPermissions(formData: FormData) {
  await requireOrganizationRole(["owner", "admin"]);
  const parsed = contentPermissionSchema.safeParse({
    spaceId: formData.get("spaceId"),
    postingPermission: formData.get("postingPermission"),
    commentingPermission: formData.get("commentingPermission"),
  });
  if (!parsed.success) throw new Error("Choose valid posting and commenting permissions.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_space_content_permissions", {
    check_space_id: parsed.data.spaceId,
    post_permission: parsed.data.postingPermission,
    comment_permission: parsed.data.commentingPermission,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/spaces");
  revalidatePath("/community");
  revalidatePath(`/community/spaces/${parsed.data.spaceId}`);
}

export async function updateCommunitySpaceLayout(formData: FormData) {
  await requireOrganizationRole(["owner", "admin"]);
  const parsed = spaceLayoutSchema.safeParse({
    spaceId: formData.get("spaceId"),
    layout: formData.get("layout"),
    showRightSidebar: formData.get("showRightSidebar") || "false",
    showMembersTab: formData.get("showMembersTab") || "false",
  });
  if (!parsed.success) throw new Error("Choose valid space layout options.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_space_layout", {
    check_space_id: parsed.data.spaceId,
    space_layout: parsed.data.layout,
    right_sidebar: parsed.data.showRightSidebar,
    members_tab: parsed.data.showMembersTab,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/spaces");
  revalidatePath("/community");
  revalidatePath(`/community/spaces/${parsed.data.spaceId}`);
}

export async function updateCommunitySpaceStatus(formData: FormData) {
  await requireOrganizationRole(["owner", "admin"]);
  const parsed = spaceStatusSchema.safeParse({ spaceId: formData.get("spaceId"), status: formData.get("status") });
  if (!parsed.success) throw new Error("Choose a valid space status.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_space_status", { check_space_id: parsed.data.spaceId, next_status: parsed.data.status });
  if (error) throw new Error(error.message);
  revalidatePath("/spaces");
  revalidatePath("/community");
  revalidatePath(`/community/spaces/${parsed.data.spaceId}`);
}

export async function updateCommunitySpaceAppearance(formData: FormData) {
  await requireOrganizationRole(["owner", "admin"]);
  const parsed = spaceAppearanceSchema.safeParse({
    spaceId: formData.get("spaceId"),
    icon: formData.get("icon") || "",
    coverUrl: formData.get("coverUrl") || "",
    accentColor: formData.get("accentColor"),
  });
  if (!parsed.success) throw new Error("Choose a valid icon, cover image URL, and accent color.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_space_appearance", {
    check_space_id: parsed.data.spaceId,
    space_icon: parsed.data.icon,
    space_cover_url: parsed.data.coverUrl,
    space_accent_color: parsed.data.accentColor,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/spaces");
  revalidatePath("/community");
  revalidatePath(`/community/spaces/${parsed.data.spaceId}`);
}

export async function updateCommunitySpaceMembershipMode(formData: FormData) {
  await requireOrganizationRole(["owner", "admin"]);
  const parsed = spaceMembershipModeSchema.safeParse({ spaceId: formData.get("spaceId"), membershipMode: formData.get("membershipMode") });
  if (!parsed.success) throw new Error("Choose a valid membership mode.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_space_membership_mode", { check_space_id: parsed.data.spaceId, next_mode: parsed.data.membershipMode });
  if (error) throw new Error(error.message);
  revalidatePath("/community");
  revalidatePath("/spaces");
  revalidatePath(`/community/spaces/${parsed.data.spaceId}`);
}

export async function toggleCommunitySpaceMembership(formData: FormData) {
  await verifyUser();
  const spaceId = z.string().uuid().parse(formData.get("spaceId"));
  const intent = z.enum(["join", "leave"]).parse(formData.get("intent"));
  const supabase = await createClient();
  const { error } = await supabase.rpc(intent === "join" ? "join_space" : "leave_space", { check_space_id: spaceId });
  if (error) throw new Error(error.message);
  revalidatePath("/community");
  revalidatePath("/spaces");
}

export async function setCommunitySpaceModerator(formData: FormData) {
  await requireOrganizationRole(["owner", "admin"]);
  const spaceId = z.string().uuid().parse(formData.get("spaceId"));
  const enabled = z.enum(["true", "false"]).parse(formData.get("enabled")) === "true";
  let userId = String(formData.get("userId") ?? "");
  const supabase = await createClient();
  if (!userId) {
    const email = z.string().trim().toLowerCase().email().parse(formData.get("email"));
    const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) throw new Error("No organization member has that email address.");
    userId = profile.id;
  }
  z.string().uuid().parse(userId);
  const { error } = await supabase.rpc("set_space_moderator", { check_space_id: spaceId, target_user_id: userId, moderator_enabled: enabled });
  if (error) throw new Error(error.message);
  revalidatePath("/community");
  revalidatePath(`/community/spaces/${spaceId}`);
}

export async function createCommunitySpaceFromTemplate(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  assertContentEnabled(organization.status);
  const parsed = spaceTemplateSchema.safeParse({ templateKey: formData.get("templateKey"), name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) throw new Error("Enter a valid template name and unique URL slug.");
  const supabase = await createClient();
  const { data: spaceId, error } = await supabase.rpc("create_space_from_template", {
    check_tenant_id: organization.id,
    template_key: parsed.data.templateKey,
    space_name: parsed.data.name,
    space_slug: parsed.data.slug,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/spaces");
  revalidatePath("/community");
  redirect(`/community/spaces/${spaceId}`);
}

export async function createCommunityPost(formData: FormData) {
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) throw new Error("Choose an organization before publishing.");
  assertContentEnabled(organization.status);
  const parsed = postSchema.safeParse({
    spaceId: formData.get("spaceId"),
    title: formData.get("title"),
    body: formData.get("body"),
  });
  if (!parsed.success) throw new Error("Enter a title and post body.");

  const supabase = await createClient();
  const { data: space } = await supabase.from("spaces").select("id").eq("id", parsed.data.spaceId).eq("tenant_id", organization.id).maybeSingle();
  if (!space) throw new Error("The selected space is unavailable.");

  const { error } = await supabase.from("posts").insert({
    tenant_id: organization.id,
    space_id: space.id,
    author_id: user.id,
    title: parsed.data.title,
    body: { text: parsed.data.body },
    status: "published",
    published_at: new Date().toISOString(),
  });
  if (error) throw new Error(error.message);
  revalidatePath("/community");
}

export async function publishMemberIntroduction(formData: FormData) {
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) throw new Error("Choose an organization before introducing yourself.");
  assertContentEnabled(organization.status);
  const parsed = introductionSchema.safeParse({
    displayName: formData.get("displayName"),
    headline: formData.get("headline"),
    location: formData.get("location") ?? "",
    bio: formData.get("bio"),
    goal: formData.get("goal"),
    interests: formData.get("interests") ?? "",
  });
  if (!parsed.success) throw new Error("Complete your name, headline, story, and community goal.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("publish_member_introduction", {
    check_tenant_id: organization.id,
    intro_display_name: parsed.data.displayName,
    intro_headline: parsed.data.headline,
    intro_location: parsed.data.location,
    intro_bio: parsed.data.bio,
    intro_interests: parsed.data.interests,
    intro_goal: parsed.data.goal,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/community");
  revalidatePath("/community/introduce");
  revalidatePath("/notifications");
  void user;
  redirect("/community?introduced=1");
}

export async function createCommunityComment(formData: FormData) {
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) throw new Error("Choose an organization before commenting.");
  assertContentEnabled(organization.status);
  const parsed = commentSchema.safeParse({ postId: formData.get("postId"), body: formData.get("body"), parentId: formData.get("parentId") || undefined });
  if (!parsed.success) throw new Error("Enter a comment.");

  const supabase = await createClient();
  const { data: post } = await supabase.from("posts").select("id").eq("id", parsed.data.postId).eq("tenant_id", organization.id).maybeSingle();
  if (!post) throw new Error("The post is unavailable.");
  if (parsed.data.parentId) {
    const { data: parent } = await supabase.from("comments").select("id").eq("id", parsed.data.parentId).eq("post_id", post.id).eq("tenant_id", organization.id).maybeSingle();
    if (!parent) throw new Error("The parent comment is unavailable.");
  }
  const { error } = await supabase.from("comments").insert({
    tenant_id: organization.id,
    post_id: post.id,
    author_id: user.id,
    body: parsed.data.body,
    parent_id: parsed.data.parentId ?? null,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/community");
}

export async function toggleCommunityReaction(formData: FormData) {
  await verifyUser();
  const postId = z.string().uuid().parse(formData.get("postId"));
  const emoji = z.enum(["heart", "like", "celebrate", "insightful"]).parse(formData.get("emoji") ?? "heart");
  const supabase = await createClient();
  const { error } = await supabase.rpc("toggle_post_reaction", { check_post_id: postId, reaction_emoji: emoji });
  if (error) throw new Error(error.message);
  revalidatePath("/community");
}

export async function deleteCommunityPost(formData: FormData) {
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) throw new Error("Choose an organization first.");
  const postId = z.string().uuid().parse(formData.get("postId"));
  const supabase = await createClient();
  const { data: post } = await supabase.from("posts").select("author_id").eq("id", postId).eq("tenant_id", organization.id).maybeSingle();
  if (!post) throw new Error("The post is unavailable.");
  if (post.author_id !== user.id && !["owner", "admin", "moderator"].includes(organization.role)) throw new Error("You cannot remove this post.");
  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("tenant_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/community");
}

export async function updateCommunitySpace(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const parsed = spaceSettingsSchema.safeParse({
    spaceId: formData.get("spaceId"),
    name: formData.get("name"),
    slug: formData.get("slug"),
    description: formData.get("description") || undefined,
    kind: formData.get("kind"),
    visibility: formData.get("visibility"),
  });
  if (!parsed.success) throw new Error("Enter valid space settings.");
  const supabase = await createClient();
  const { error } = await supabase.rpc("update_community_space", {
    check_space_id: parsed.data.spaceId,
    space_name: parsed.data.name,
    space_slug: parsed.data.slug,
    space_description: parsed.data.description ?? "",
    space_kind: parsed.data.kind,
    space_visibility: parsed.data.visibility,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/community");
  revalidatePath(`/community/spaces/${parsed.data.spaceId}`);
  revalidatePath("/spaces");
  revalidatePath("/dashboard");
  void organization;
}

export async function setCommunitySpaceMember(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const spaceId = z.string().uuid().parse(formData.get("spaceId"));
  const enabled = z.enum(["true", "false"]).parse(formData.get("enabled")) === "true";
  let userId = String(formData.get("userId") ?? "");
  const supabase = await createClient();

  if (!userId) {
    const email = z.string().trim().toLowerCase().email().parse(formData.get("email"));
    const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) throw new Error("No organization member has that email address.");
    userId = profile.id;
  }
  z.string().uuid().parse(userId);

  const { error } = await supabase.rpc("set_space_member_access", {
    check_space_id: spaceId,
    target_user_id: userId,
    access_enabled: enabled,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/community");
  revalidatePath(`/community/spaces/${spaceId}`);
  void organization;
}

export async function updateCommunityPost(formData: FormData) {
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) throw new Error("Choose an organization first.");
  const parsed = editPostSchema.safeParse({ postId: formData.get("postId"), title: formData.get("title"), body: formData.get("body") });
  if (!parsed.success) throw new Error("Enter a valid title and post body.");
  const supabase = await createClient();
  const { data: post } = await supabase.from("posts").select("author_id").eq("id", parsed.data.postId).eq("tenant_id", organization.id).maybeSingle();
  if (!post) throw new Error("The post is unavailable.");
  if (post.author_id !== user.id && !["owner", "admin"].includes(organization.role)) throw new Error("You cannot edit this post.");
  const { error } = await supabase.from("posts").update({ title: parsed.data.title, body: { text: parsed.data.body }, updated_at: new Date().toISOString() }).eq("id", parsed.data.postId).eq("tenant_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/community");
}

export async function setCommunityPostPinned(formData: FormData) {
  await requireOrganizationRole(["owner", "admin", "moderator"]);
  const postId = z.string().uuid().parse(formData.get("postId"));
  const pinned = z.enum(["true", "false"]).parse(formData.get("pinned")) === "true";
  const supabase = await createClient();
  const { error } = await supabase.rpc("set_post_pinned", { check_post_id: postId, pinned });
  if (error) throw new Error(error.message);
  revalidatePath("/community");
}

export async function deleteCommunityComment(formData: FormData) {
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) throw new Error("Choose an organization first.");
  const commentId = z.string().uuid().parse(formData.get("commentId"));
  const supabase = await createClient();
  const { data: comment } = await supabase.from("comments").select("author_id").eq("id", commentId).eq("tenant_id", organization.id).maybeSingle();
  if (!comment) throw new Error("The comment is unavailable.");
  if (comment.author_id !== user.id && !["owner", "admin", "moderator"].includes(organization.role)) throw new Error("You cannot remove this comment.");
  const { error } = await supabase.from("comments").delete().eq("id", commentId).eq("tenant_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/community");
}

export async function registerCommunityAttachment(formData: FormData) {
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) throw new Error("Choose an organization first.");
  const parsed = attachmentSchema.safeParse({
    postId: formData.get("postId"), storagePath: formData.get("storagePath"), fileName: formData.get("fileName"),
    contentType: formData.get("contentType"), sizeBytes: formData.get("sizeBytes"),
  });
  if (!parsed.success) throw new Error("The attachment is invalid or larger than 10 MB.");
  const expectedPrefix = `${organization.id}/${user.id}/`;
  if (!parsed.data.storagePath.startsWith(expectedPrefix)) throw new Error("The attachment path is invalid.");
  const supabase = await createClient();
  const { data: post } = await supabase.from("posts").select("id, author_id").eq("id", parsed.data.postId).eq("tenant_id", organization.id).maybeSingle();
  if (!post) throw new Error("The post is unavailable.");
  if (post.author_id !== user.id && !["owner", "admin"].includes(organization.role)) throw new Error("Only the post author or an administrator can attach media.");
  const { error } = await supabase.from("post_attachments").insert({
    tenant_id: organization.id, post_id: post.id, uploaded_by: user.id, storage_path: parsed.data.storagePath,
    file_name: parsed.data.fileName, content_type: parsed.data.contentType, size_bytes: parsed.data.sizeBytes,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/community");
}

export async function deleteCommunityAttachment(formData: FormData) {
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) throw new Error("Choose an organization first.");
  const attachmentId = z.string().uuid().parse(formData.get("attachmentId"));
  const supabase = await createClient();
  const { data: attachment } = await supabase.from("post_attachments").select("id, uploaded_by, storage_path").eq("id", attachmentId).eq("tenant_id", organization.id).maybeSingle();
  if (!attachment) throw new Error("The attachment is unavailable.");
  if (attachment.uploaded_by !== user.id && !["owner", "admin", "moderator"].includes(organization.role)) throw new Error("You cannot remove this attachment.");
  const { error: storageError } = await supabase.storage.from("community-media").remove([attachment.storage_path]);
  if (storageError) throw new Error(storageError.message);
  const { error } = await supabase.from("post_attachments").delete().eq("id", attachment.id);
  if (error) throw new Error(error.message);
  revalidatePath("/community");
}

export async function markCommunityNotificationsRead() {
  const user = await verifyUser();
  const supabase = await createClient();
  const { error } = await supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (error) throw new Error(error.message);
  revalidatePath("/notifications");
  revalidatePath("/community");
}
