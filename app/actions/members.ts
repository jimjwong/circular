"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { getActiveOrganization, requireOrganizationPermission, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const optionalUrl = z.union([z.literal(""), z.string().trim().url().max(500)]);
const memberProfileSchema = z.object({
  displayName: z.string().trim().min(2).max(80),
  pronouns: z.string().trim().max(40),
  headline: z.string().trim().min(2).max(120),
  location: z.string().trim().max(100),
  bio: z.string().trim().min(20).max(2000),
  interests: z.string().trim().max(500),
  websiteUrl: optionalUrl,
  linkedinUrl: optionalUrl,
  contactEmail: z.union([z.literal(""), z.email().max(160)]),
  twitterUrl: optionalUrl,
  youtubeUrl: optionalUrl,
  facebookUrl: optionalUrl,
  instagramUrl: optionalUrl,
  availability: z.string().trim().max(160),
  directoryVisibility: z.enum(["members", "admins", "hidden"]),
  showEmail: z.boolean(),
  showLocation: z.boolean(),
  showActivity: z.boolean(),
  showCourses: z.boolean(),
  showEvents: z.boolean(),
});

const profileFieldSchema = z.object({
  label: z.string().trim().min(2).max(80),
  fieldKey: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(60),
  fieldType: z.enum(["text", "url", "number", "select", "boolean"]),
  options: z.string().trim().max(1000),
  helpText: z.string().trim().max(240),
  visibility: z.enum(["members", "admins", "self"]),
  required: z.boolean(),
});

const tagSchema = z.object({
  name: z.string().trim().min(2).max(60),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
});

const segmentSchema = z.object({
  name: z.string().trim().min(2).max(80),
  membershipTier: z.enum(["any", "associate", "professional", "corporate", "guest"]),
  tagId: z.union([z.literal(""), z.string().uuid()]),
  interest: z.string().trim().max(80),
  location: z.string().trim().max(100),
});

function checked(formData: FormData, name: string) {
  return formData.get(name) === "on" || formData.get(name) === "true";
}

export async function updateMyMemberProfile(formData: FormData) {
  const [organization, user] = await Promise.all([getActiveOrganization(), verifyUser()]);
  if (!organization) redirect("/onboarding");
  const parsed = memberProfileSchema.parse({
    displayName: formData.get("displayName"),
    pronouns: formData.get("pronouns") ?? "",
    headline: formData.get("headline"),
    location: formData.get("location") ?? "",
    bio: formData.get("bio"),
    interests: formData.get("interests") ?? "",
    websiteUrl: formData.get("websiteUrl") ?? "",
    linkedinUrl: formData.get("linkedinUrl") ?? "",
    contactEmail: formData.get("contactEmail") ?? "",
    twitterUrl: formData.get("twitterUrl") ?? "",
    youtubeUrl: formData.get("youtubeUrl") ?? "",
    facebookUrl: formData.get("facebookUrl") ?? "",
    instagramUrl: formData.get("instagramUrl") ?? "",
    availability: formData.get("availability") ?? "",
    directoryVisibility: formData.get("directoryVisibility"),
    showEmail: checked(formData, "showEmail"),
    showLocation: checked(formData, "showLocation"),
    showActivity: checked(formData, "showActivity"),
    showCourses: checked(formData, "showCourses"),
    showEvents: checked(formData, "showEvents"),
  });

  const supabase = await createClient();
  const { data: fields, error: fieldsError } = await supabase.from("member_profile_fields")
    .select("field_key, field_type, options, is_required").eq("tenant_id", organization.id).eq("is_active", true);
  if (fieldsError) throw new Error(fieldsError.message);
  const customValues: Record<string, string | number | boolean> = {};
  for (const field of fields ?? []) {
    const raw = formData.get(`custom:${field.field_key}`);
    const value = field.field_type === "boolean" ? raw === "on" : String(raw ?? "").trim();
    if (field.is_required && (value === "" || value === false)) throw new Error(`${field.field_key} is required.`);
    if (field.field_type === "url" && value && !z.string().url().safeParse(value).success) throw new Error(`${field.field_key} must be a valid URL.`);
    if (field.field_type === "number" && value !== "" && !Number.isFinite(Number(value))) throw new Error(`${field.field_key} must be a number.`);
    if (field.field_type === "select" && value && !field.options.includes(value)) throw new Error(`${field.field_key} contains an invalid option.`);
    customValues[field.field_key] = field.field_type === "number" && value !== "" ? Number(value) : value;
  }

  const interests = [...new Set(parsed.interests.split(",").map((value) => value.trim()).filter(Boolean))].slice(0, 12);
  const { error: profileError } = await supabase.from("profiles").update({
    display_name: parsed.displayName,
    pronouns: parsed.pronouns || null,
    headline: parsed.headline,
    location: parsed.location || null,
    bio: parsed.bio,
    interests,
    website_url: parsed.websiteUrl || null,
    linkedin_url: parsed.linkedinUrl || null,
    contact_email: parsed.contactEmail || null,
    twitter_url: parsed.twitterUrl || null,
    youtube_url: parsed.youtubeUrl || null,
    facebook_url: parsed.facebookUrl || null,
    instagram_url: parsed.instagramUrl || null,
    updated_at: new Date().toISOString(),
  }).eq("id", user.id);
  if (profileError) throw new Error(profileError.message);

  const { error: directoryError } = await supabase.from("tenant_member_profiles").upsert({
    tenant_id: organization.id,
    user_id: user.id,
    directory_visibility: parsed.directoryVisibility,
    show_email: parsed.showEmail,
    show_location: parsed.showLocation,
    show_activity: parsed.showActivity,
    show_courses: parsed.showCourses,
    show_events: parsed.showEvents,
    availability: parsed.availability || null,
    custom_values: customValues,
    updated_at: new Date().toISOString(),
  }, { onConflict: "tenant_id,user_id" });
  if (directoryError) throw new Error(directoryError.message);

  revalidatePath("/members");
  revalidatePath(`/members/${user.id}`);
  revalidatePath("/community");
  redirect(`/members/${user.id}?saved=1` as Route);
}

export async function createMemberProfileField(formData: FormData) {
  const organization = await requireOrganizationPermission("members.manage");
  const parsed = profileFieldSchema.parse({
    label: formData.get("label"), fieldKey: formData.get("fieldKey"), fieldType: formData.get("fieldType"),
    options: formData.get("options") ?? "", helpText: formData.get("helpText") ?? "",
    visibility: formData.get("visibility"), required: checked(formData, "required"),
  });
  const options = parsed.fieldType === "select" ? parsed.options.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 30) : [];
  if (parsed.fieldType === "select" && options.length < 2) throw new Error("Select fields require at least two options.");
  const supabase = await createClient();
  const { count } = await supabase.from("member_profile_fields").select("id", { count: "exact", head: true }).eq("tenant_id", organization.id);
  const { error } = await supabase.from("member_profile_fields").insert({ tenant_id: organization.id, field_key: parsed.fieldKey, label: parsed.label, field_type: parsed.fieldType, options, help_text: parsed.helpText || null, visibility: parsed.visibility, is_required: parsed.required, position: ((count ?? 0) + 1) * 10 });
  if (error) throw new Error(error.code === "23505" ? "A field with that key already exists." : error.message);
  revalidatePath("/members/manage");
  revalidatePath("/members/me/edit");
}

export async function setMemberProfileFieldActive(formData: FormData) {
  const organization = await requireOrganizationPermission("members.manage");
  const fieldId = z.string().uuid().parse(formData.get("fieldId"));
  const active = formData.get("active") === "true";
  const supabase = await createClient();
  const { error } = await supabase.from("member_profile_fields").update({ is_active: active, updated_at: new Date().toISOString() }).eq("id", fieldId).eq("tenant_id", organization.id);
  if (error) throw new Error(error.message);
  revalidatePath("/members/manage");
  revalidatePath("/members/me/edit");
}

export async function createMemberTag(formData: FormData) {
  const organization = await requireOrganizationPermission("members.manage");
  const parsed = tagSchema.parse({ name: formData.get("name"), color: formData.get("color") });
  const supabase = await createClient();
  const { error } = await supabase.from("tags").insert({ tenant_id: organization.id, name: parsed.name, color: parsed.color });
  if (error) throw new Error(error.code === "23505" ? "That tag already exists." : error.message);
  revalidatePath("/members/manage");
  revalidatePath("/members");
}

export async function setMemberTagAssignment(formData: FormData) {
  const organization = await requireOrganizationPermission("members.manage");
  const memberId = z.string().uuid().parse(formData.get("memberId"));
  const tagId = z.string().uuid().parse(formData.get("tagId"));
  const enabled = formData.get("enabled") === "true";
  const supabase = await createClient();
  if (enabled) {
    const { error } = await supabase.from("member_tags").upsert({ tenant_id: organization.id, tag_id: tagId, user_id: memberId }, { onConflict: "tag_id,user_id" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("member_tags").delete().eq("tenant_id", organization.id).eq("tag_id", tagId).eq("user_id", memberId);
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/members/${memberId}`);
  revalidatePath("/members");
}

export async function createMemberSegment(formData: FormData) {
  const organization = await requireOrganizationPermission("members.manage");
  const user = await verifyUser();
  const parsed = segmentSchema.parse({ name: formData.get("name"), membershipTier: formData.get("membershipTier"), tagId: formData.get("tagId") ?? "", interest: formData.get("interest") ?? "", location: formData.get("location") ?? "" });
  const criteria = { membershipTier: parsed.membershipTier, tagId: parsed.tagId || null, interest: parsed.interest || null, location: parsed.location || null };
  const supabase = await createClient();
  const { error } = await supabase.from("member_segments").insert({ tenant_id: organization.id, name: parsed.name, criteria, created_by: user.id });
  if (error) throw new Error(error.code === "23505" ? "That segment already exists." : error.message);
  revalidatePath("/members/manage");
  revalidatePath("/email");
}
