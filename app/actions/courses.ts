"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { getActiveOrganization, requireOrganizationRole, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { signBadgeAward } from "@/lib/badges/open-badge";

const courseSchema = z.object({
  title: z.string().trim().min(3).max(160),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  description: z.string().trim().max(5000),
  category: z.string().trim().max(80),
  coverUrl: z.union([z.literal(""), z.string().trim().url().max(500)]),
  cpdHours: z.coerce.number().min(0).max(9999),
  priceCents: z.coerce.number().int().min(0).max(100000000),
  currency: z.string().trim().length(3).transform((value) => value.toUpperCase()),
  accessMode: z.enum(["free", "paid", "private"]),
  navigationMode: z.enum(["sequential", "free"]),
  completionPercent: z.coerce.number().int().min(1).max(100),
  certificateExpiryMonths: z.union([z.literal(""), z.coerce.number().int().min(1).max(120)]),
  status: z.enum(["draft", "published", "archived"]),
});

const moduleSchema = z.object({
  courseId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  description: z.string().trim().max(1000),
  position: z.coerce.number().int().min(0).max(100000),
  unlockRequirement: z.enum(["none", "previous_module_complete", "date"]),
  unlockAt: z.string().optional(),
});

const itemSchema = z.object({
  courseId: z.string().uuid(),
  moduleId: z.string().uuid(),
  title: z.string().trim().min(2).max(160),
  itemType: z.enum(["video", "reading", "quiz", "assignment", "scorm", "external_link"]),
  contentUrl: z.union([z.literal(""), z.string().trim().url().max(1000)]),
  contentBody: z.string().trim().max(20000),
  quizOptions: z.string().trim().max(4000).optional().default(""),
  correctAnswer: z.string().trim().max(500).optional().default(""),
  estimatedMinutes: z.coerce.number().int().min(0).max(10080),
  position: z.coerce.number().int().min(0).max(100000),
  completionRequirement: z.enum(["view", "score_threshold", "manual_mark_complete", "must_submit"]),
  scoreThreshold: z.union([z.literal(""), z.coerce.number().min(0).max(100)]),
  watchThreshold: z.coerce.number().int().min(1).max(100),
  isRequired: z.enum(["true", "false"]).transform((value) => value === "true"),
  isPreview: z.enum(["true", "false"]).transform((value) => value === "true"),
});

async function requireCourseManager(courseId: string) {
  const [user, organization] = await Promise.all([verifyUser(), getActiveOrganization()]);
  if (!organization) throw new Error("Choose an organization first.");
  const supabase = await createClient();
  const { data: course } = await supabase.from("courses").select("id, slug").eq("id", courseId).eq("tenant_id", organization.id).maybeSingle();
  if (!course) throw new Error("The course is unavailable.");
  if (!["owner", "admin"].includes(organization.role)) {
    const { data: assignment } = await supabase.from("course_instructors").select("course_id").eq("course_id", courseId).eq("user_id", user.id).maybeSingle();
    if (!assignment) throw new Error("Course manager access is required.");
  }
  return { organization, supabase, course };
}

export async function createCourse(formData: FormData) {
  const [organization, user] = await Promise.all([requireOrganizationRole(["owner", "admin"]), verifyUser()]);
  const parsed = courseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Enter valid course details, pricing, progress, and certificate settings.");
  const supabase = await createClient();
  const { data, error } = await supabase.from("courses").insert({
    tenant_id: organization.id, created_by: user.id, title: parsed.data.title, slug: parsed.data.slug,
    description: parsed.data.description || null, category: parsed.data.category || null, cover_url: parsed.data.coverUrl || null,
    cpd_hours_total: parsed.data.cpdHours, price_cents: parsed.data.priceCents, currency: parsed.data.currency,
    access_mode: parsed.data.accessMode, navigation_mode: parsed.data.navigationMode, completion_percent: parsed.data.completionPercent,
    certificate_expiry_months: parsed.data.certificateExpiryMonths || null, status: parsed.data.status,
  }).select("id").single();
  if (error) throw new Error(error.message);
  revalidatePath("/courses");
  revalidatePath("/admin/courses");
  redirect(`/admin/courses/${data.id}`);
}

export async function updateCourse(formData: FormData) {
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const { supabase, course } = await requireCourseManager(courseId);
  const parsed = courseSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Enter valid course settings.");
  const { error } = await supabase.from("courses").update({
    title: parsed.data.title, slug: parsed.data.slug, description: parsed.data.description || null, category: parsed.data.category || null,
    cover_url: parsed.data.coverUrl || null, cpd_hours_total: parsed.data.cpdHours, price_cents: parsed.data.priceCents,
    currency: parsed.data.currency, access_mode: parsed.data.accessMode, navigation_mode: parsed.data.navigationMode,
    completion_percent: parsed.data.completionPercent, certificate_expiry_months: parsed.data.certificateExpiryMonths || null,
    status: parsed.data.status, updated_at: new Date().toISOString(),
  }).eq("id", courseId);
  if (error) throw new Error(error.message);
  revalidatePath("/courses");
  revalidatePath(`/courses/${course.slug}`);
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function deleteCourse(formData: FormData) {
  await requireOrganizationRole(["owner", "admin"]);
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const { supabase } = await requireCourseManager(courseId);
  const { error } = await supabase.from("courses").delete().eq("id", courseId);
  if (error) throw new Error(error.message);
  revalidatePath("/courses");
  revalidatePath("/admin/courses");
  redirect("/admin/courses");
}

export async function createCourseModule(formData: FormData) {
  const parsed = moduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Enter valid module details.");
  const { organization, supabase } = await requireCourseManager(parsed.data.courseId);
  const unlockAt = parsed.data.unlockRequirement === "date" && parsed.data.unlockAt ? new Date(parsed.data.unlockAt).toISOString() : null;
  const { error } = await supabase.from("course_modules").insert({ tenant_id: organization.id, course_id: parsed.data.courseId, title: parsed.data.title, description: parsed.data.description || null, position: parsed.data.position, unlock_requirement: parsed.data.unlockRequirement, unlock_at: unlockAt });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${parsed.data.courseId}`);
}

export async function updateCourseModule(formData: FormData) {
  const moduleId = z.string().uuid().parse(formData.get("moduleId"));
  const parsed = moduleSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Enter valid module details.");
  const { supabase } = await requireCourseManager(parsed.data.courseId);
  const unlockAt = parsed.data.unlockRequirement === "date" && parsed.data.unlockAt ? new Date(parsed.data.unlockAt).toISOString() : null;
  const { error } = await supabase.from("course_modules").update({ title: parsed.data.title, description: parsed.data.description || null, position: parsed.data.position, unlock_requirement: parsed.data.unlockRequirement, unlock_at: unlockAt, updated_at: new Date().toISOString() }).eq("id", moduleId).eq("course_id", parsed.data.courseId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${parsed.data.courseId}`);
}

export async function deleteCourseModule(formData: FormData) {
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const moduleId = z.string().uuid().parse(formData.get("moduleId"));
  const { supabase } = await requireCourseManager(courseId);
  const { error } = await supabase.from("course_modules").delete().eq("id", moduleId).eq("course_id", courseId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function createModuleItem(formData: FormData) {
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Enter valid lesson content and completion settings.");
  const { organization, supabase } = await requireCourseManager(parsed.data.courseId);
  const quizOptions = parsed.data.quizOptions.split("\n").map((value) => value.trim()).filter(Boolean);
  if (parsed.data.itemType === "quiz" && (quizOptions.length < 2 || !quizOptions.includes(parsed.data.correctAnswer))) throw new Error("Add at least two quiz options and make the correct answer match one option exactly.");
  const { error } = await supabase.from("module_items").insert({ tenant_id: organization.id, course_id: parsed.data.courseId, module_id: parsed.data.moduleId, item_type: parsed.data.itemType, title: parsed.data.title, content_url: parsed.data.contentUrl || null, content_body: { text: parsed.data.contentBody, options: quizOptions, correctAnswer: parsed.data.correctAnswer }, estimated_minutes: parsed.data.estimatedMinutes, position: parsed.data.position, completion_requirement: parsed.data.completionRequirement, score_threshold: parsed.data.scoreThreshold === "" ? null : parsed.data.scoreThreshold, watch_threshold: parsed.data.watchThreshold, is_required: parsed.data.isRequired, is_preview: parsed.data.isPreview });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${parsed.data.courseId}`);
}

export async function updateModuleItem(formData: FormData) {
  const itemId = z.string().uuid().parse(formData.get("itemId"));
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) throw new Error("Enter valid lesson content and completion settings.");
  const { supabase } = await requireCourseManager(parsed.data.courseId);
  const quizOptions = parsed.data.quizOptions.split("\n").map((value) => value.trim()).filter(Boolean);
  if (parsed.data.itemType === "quiz" && (quizOptions.length < 2 || !quizOptions.includes(parsed.data.correctAnswer))) throw new Error("Add at least two quiz options and make the correct answer match one option exactly.");
  const { error } = await supabase.from("module_items").update({ module_id: parsed.data.moduleId, item_type: parsed.data.itemType, title: parsed.data.title, content_url: parsed.data.contentUrl || null, content_body: { text: parsed.data.contentBody, options: quizOptions, correctAnswer: parsed.data.correctAnswer }, estimated_minutes: parsed.data.estimatedMinutes, position: parsed.data.position, completion_requirement: parsed.data.completionRequirement, score_threshold: parsed.data.scoreThreshold === "" ? null : parsed.data.scoreThreshold, watch_threshold: parsed.data.watchThreshold, is_required: parsed.data.isRequired, is_preview: parsed.data.isPreview, updated_at: new Date().toISOString() }).eq("id", itemId).eq("course_id", parsed.data.courseId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${parsed.data.courseId}`);
}

export async function deleteModuleItem(formData: FormData) {
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const itemId = z.string().uuid().parse(formData.get("itemId"));
  const { supabase } = await requireCourseManager(courseId);
  const { error } = await supabase.from("module_items").delete().eq("id", itemId).eq("course_id", courseId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${courseId}`);
}

export async function setCourseInstructor(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const enabled = z.enum(["true", "false"]).parse(formData.get("enabled")) === "true";
  const supabase = await createClient();
  let userId = String(formData.get("userId") ?? "");
  if (!userId) {
    const email = z.string().trim().toLowerCase().email().parse(formData.get("email"));
    const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
    if (!profile) throw new Error("No organization member has that email address.");
    userId = profile.id;
  }
  if (enabled) {
    const { error } = await supabase.from("course_instructors").upsert({ tenant_id: organization.id, course_id: courseId, user_id: z.string().uuid().parse(userId), assigned_by: (await verifyUser()).id });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("course_instructors").delete().eq("course_id", courseId).eq("user_id", z.string().uuid().parse(userId));
    if (error) throw new Error(error.message);
  }
  revalidatePath(`/admin/courses/${courseId}`);
}

export type LmsActionResult = { ok: true; value?: string | number | boolean } | { ok: false; error: string };

async function signEarnedBadge(userId: string, itemId: string) {
  const admin = createAdminClient();
  const { data: selectedItem } = await admin.from("module_items").select("course_id").eq("id", itemId).maybeSingle();
  if (!selectedItem) return;
  const { data: award } = await admin.from("course_badge_awards").select("id").eq("course_id", selectedItem.course_id).eq("user_id", userId).maybeSingle();
  if (award) await signBadgeAward(admin, award.id);
}

export async function enrollInCourse(courseId: string, useDummyPayment = false): Promise<LmsActionResult> {
  const parsedCourseId = z.string().uuid().safeParse(courseId);
  if (!parsedCourseId.success) return { ok: false, error: "Invalid course." };
  await verifyUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lms_enroll_course", { check_course_id: parsedCourseId.data, use_dummy_payment: useDummyPayment });
  if (error) return { ok: false, error: error.message };
  revalidatePath("/courses");
  return { ok: true, value: String(data) };
}

export async function startLearningItem(itemId: string): Promise<LmsActionResult> {
  const parsedItemId = z.string().uuid().safeParse(itemId);
  if (!parsedItemId.success) return { ok: false, error: "Invalid lesson." };
  await verifyUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lms_start_course_item", { check_item_id: parsedItemId.data });
  return error ? { ok: false, error: error.message } : { ok: true, value: String(data) };
}

export async function recordLearningHeartbeat(itemId: string, sessionKey: string, heartbeatKey: string, seconds = 30): Promise<LmsActionResult> {
  const parsed = z.object({ itemId: z.string().uuid(), sessionKey: z.string().uuid(), heartbeatKey: z.string().uuid(), seconds: z.number().int().min(1).max(60) }).safeParse({ itemId, sessionKey, heartbeatKey, seconds });
  if (!parsed.success) return { ok: false, error: "Invalid learning session." };
  await verifyUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lms_record_heartbeat", { check_item_id: parsed.data.itemId, check_session_key: parsed.data.sessionKey, check_heartbeat_key: parsed.data.heartbeatKey, check_seconds: parsed.data.seconds });
  return error ? { ok: false, error: error.message } : { ok: true, value: Number(data) };
}

export async function completeLearningItem(itemId: string, watchPercent?: number, score?: number, submissionUrl?: string): Promise<LmsActionResult> {
  const parsed = z.object({ itemId: z.string().uuid(), watchPercent: z.number().int().min(0).max(100).optional(), score: z.number().min(0).max(100).optional(), submissionUrl: z.string().trim().url().max(1000).optional() }).safeParse({ itemId, watchPercent, score, submissionUrl: submissionUrl || undefined });
  if (!parsed.success) return { ok: false, error: "Check the completion details and try again." };
  const user = await verifyUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lms_complete_course_item", { check_item_id: parsed.data.itemId, submitted_watch_percent: parsed.data.watchPercent ?? null, submitted_score: parsed.data.score ?? null, submitted_url: parsed.data.submissionUrl ?? null });
  if (error) return { ok: false, error: error.message };
  await signEarnedBadge(user.id, parsed.data.itemId);
  revalidatePath("/courses");
  return { ok: true, value: Boolean(data) };
}

export async function submitQuizAnswer(itemId: string, answer: string): Promise<LmsActionResult> {
  const parsed = z.object({ itemId: z.string().uuid(), answer: z.string().trim().min(1).max(500) }).safeParse({ itemId, answer });
  if (!parsed.success) return { ok: false, error: "Choose an answer first." };
  const user = await verifyUser();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("lms_submit_quiz", { check_item_id: parsed.data.itemId, submitted_answer: parsed.data.answer });
  if (error) return { ok: false, error: error.message };
  if (Number(data) < 100) return { ok: false, error: "That answer is not correct yet. Review the lesson and try again." };
  await signEarnedBadge(user.id, parsed.data.itemId);
  revalidatePath("/courses");
  return { ok: true, value: Number(data) };
}

export async function setCertificateRevocation(formData: FormData) {
  await requireOrganizationRole(["owner", "admin"]);
  const certificateId = z.string().uuid().parse(formData.get("certificateId"));
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const revoked = z.enum(["true", "false"]).parse(formData.get("revoked")) === "true";
  const reason = z.string().trim().max(500).parse(formData.get("reason") ?? "");
  if (revoked && !reason) throw new Error("Add a reason before revoking this certificate.");
  const supabase = await createClient();
  const { error } = await supabase.from("course_certificates").update({ revoked, revoked_at: revoked ? new Date().toISOString() : null, revoked_reason: revoked ? reason : null }).eq("id", certificateId).eq("course_id", courseId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${courseId}/credentials`);
}

export async function enrollLearnerByEmail(formData: FormData) {
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const email = z.string().trim().toLowerCase().email().parse(formData.get("email"));
  const { organization, supabase } = await requireCourseManager(courseId);
  const { data: profile } = await supabase.from("profiles").select("id").eq("email", email).maybeSingle();
  if (!profile) throw new Error("No organization member has that email address.");
  const { data: membership } = await supabase.from("tenant_memberships").select("user_id").eq("tenant_id", organization.id).eq("user_id", profile.id).eq("status", "active").maybeSingle();
  if (!membership) throw new Error("This person is not an active organization member.");
  const { error } = await supabase.from("course_enrollments").upsert({ tenant_id: organization.id, course_id: courseId, user_id: profile.id, status: "active", dropped_at: null }, { onConflict: "course_id,user_id" });
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${courseId}/analytics`);
}

export async function setLearnerEnrollmentStatus(formData: FormData) {
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const enrollmentId = z.string().uuid().parse(formData.get("enrollmentId"));
  const status = z.enum(["active", "dropped"]).parse(formData.get("status"));
  const { supabase } = await requireCourseManager(courseId);
  const { error } = await supabase.from("course_enrollments").update({ status, dropped_at: status === "dropped" ? new Date().toISOString() : null }).eq("id", enrollmentId).eq("course_id", courseId);
  if (error) throw new Error(error.message);
  revalidatePath(`/admin/courses/${courseId}/analytics`);
}

export async function saveCourseBadge(formData: FormData) {
  const courseId = z.string().uuid().parse(formData.get("courseId"));
  const name = z.string().trim().min(3).max(160).parse(formData.get("name"));
  const description = z.string().trim().min(10).max(1000).parse(formData.get("description"));
  const criteria = z.string().trim().min(10).max(2000).parse(formData.get("criteria"));
  const { organization, supabase } = await requireCourseManager(courseId);
  const { data: existing } = await supabase.from("course_badges").select("id").eq("course_id", courseId).eq("award_mode", "course_completion").maybeSingle();
  const values = { tenant_id: organization.id, course_id: courseId, name, description, criteria_text: criteria, image_url: "/badges/professional-learning.svg", award_mode: "course_completion", open_badge_json: { version: "3.0", achievementType: "Certificate" } };
  const result = existing ? await supabase.from("course_badges").update(values).eq("id", existing.id) : await supabase.from("course_badges").insert({ ...values, created_by: (await verifyUser()).id });
  if (result.error) throw new Error(result.error.message);
  revalidatePath(`/admin/courses/${courseId}/credentials`);
}
