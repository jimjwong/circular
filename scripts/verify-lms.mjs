import { createClient } from "@supabase/supabase-js";
import { createPublicKey, verify as verifySignature } from "node:crypto";
import { signBadgeAward } from "../lib/badges/open-badge.ts";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !key || !secret) throw new Error("Supabase environment variables are required.");
const makeClient = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const owner = makeClient();
const member = makeClient();
const anonymous = makeClient();
const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const [{ error: ownerAuthError }, { error: memberAuthError }] = await Promise.all([
  owner.auth.signInWithPassword({ email: "owner@circular.local", password: "Circular123!" }),
  member.auth.signInWithPassword({ email: "phase-one-member@circular.local", password: "PhaseOne123!" }),
]);
if (ownerAuthError) throw ownerAuthError;
if (memberAuthError) throw memberAuthError;
const [{ data: ownerUser }, { data: memberUser }] = await Promise.all([owner.auth.getUser(), member.auth.getUser()]);
const { data: tenant, error: tenantError } = await owner.from("tenants").select("id").eq("slug", "phase-one-verification").single();
if (tenantError) throw tenantError;

let { data: draftCourse } = await owner.from("courses").select("id").eq("tenant_id", tenant.id).eq("slug", "lms-draft-visibility-verification").maybeSingle();
if (!draftCourse) {
  const { data, error } = await owner.from("courses").insert({ tenant_id: tenant.id, title: "LMS Draft Visibility Verification", slug: "lms-draft-visibility-verification", description: "Must remain invisible to learners.", status: "draft", category: "CPD", cpd_hours_total: 1, created_by: ownerUser.user.id }).select("id").single();
  if (error) throw error;
  draftCourse = data;
}
const { data: hiddenDraft, error: hiddenDraftError } = await member.from("courses").select("id").eq("id", draftCourse.id).maybeSingle();
if (hiddenDraftError || hiddenDraft) throw hiddenDraftError ?? new Error("A learner could read a draft course.");

let { data: course } = await owner.from("courses").select("id").eq("tenant_id", tenant.id).eq("slug", "lms-foundation-verification").maybeSingle();
if (!course) {
  const { data, error } = await owner.from("courses").insert({ tenant_id: tenant.id, title: "LMS Foundation Verification", slug: "lms-foundation-verification", description: "Verifies tenant-scoped LMS access.", status: "draft", category: "CPD", cpd_hours_total: 1, created_by: ownerUser.user.id }).select("id").single();
  if (error) throw error;
  course = data;
}
const { error: resetInstructorError } = await owner.from("course_instructors").delete().eq("course_id", course.id).eq("user_id", memberUser.user.id);
if (resetInstructorError) throw resetInstructorError;
const { error: forbiddenCourseError } = await member.from("courses").insert({ tenant_id: tenant.id, title: "Forbidden member course", slug: `forbidden-member-course-${Date.now()}`, created_by: memberUser.user.id });
if (!forbiddenCourseError) throw new Error("A learner was able to create a course.");

let { data: moduleRow } = await owner.from("course_modules").select("id").eq("course_id", course.id).eq("title", "Foundation module").maybeSingle();
if (!moduleRow) {
  const { data, error } = await owner.from("course_modules").insert({ tenant_id: tenant.id, course_id: course.id, title: "Foundation module", position: 10 }).select("id").single();
  if (error) throw error;
  moduleRow = data;
}
const { error: forbiddenModuleError } = await member.from("course_modules").insert({ tenant_id: tenant.id, course_id: course.id, title: "Forbidden learner module" });
if (!forbiddenModuleError) throw new Error("A learner was able to author a module.");
await owner.from("courses").update({ status: "published" }).eq("id", course.id);
const { data: publishedCourse, error: publishedCourseError } = await member.from("courses").select("id").eq("id", course.id).single();
if (publishedCourseError || publishedCourse.id !== course.id) throw publishedCourseError ?? new Error("A learner could not read a published course.");
const { data: publishedModule, error: publishedModuleError } = await member.from("course_modules").select("id").eq("id", moduleRow.id).single();
if (publishedModuleError || publishedModule.id !== moduleRow.id) throw publishedModuleError ?? new Error("A learner could not read a published course module.");

let { data: itemRow } = await owner.from("module_items").select("id").eq("module_id", moduleRow.id).eq("title", "Verified reading lesson").maybeSingle();
if (!itemRow) {
  const { data, error } = await owner.from("module_items").insert({ tenant_id: tenant.id, course_id: course.id, module_id: moduleRow.id, item_type: "reading", title: "Verified reading lesson", content_body: { text: "A tenant-scoped authoring test lesson." }, estimated_minutes: 5, position: 10, completion_requirement: "manual_mark_complete", is_required: true, is_preview: true }).select("id").single();
  if (error) throw error;
  itemRow = data;
}
const { data: publishedItem, error: publishedItemError } = await member.from("module_items").select("id").eq("id", itemRow.id).single();
if (publishedItemError || publishedItem.id !== itemRow.id) throw publishedItemError ?? new Error("A learner could not read a published lesson.");
const { error: forbiddenItemError } = await member.from("module_items").insert({ tenant_id: tenant.id, course_id: course.id, module_id: moduleRow.id, item_type: "reading", title: "Forbidden learner lesson" });
if (!forbiddenItemError) throw new Error("A learner was able to author a lesson.");
let { data: completionItem } = await owner.from("module_items").select("id").eq("module_id", moduleRow.id).eq("title", "Verified completion trigger lesson").maybeSingle();
if (!completionItem) {
  const { data, error } = await owner.from("module_items").insert({ tenant_id: tenant.id, course_id: course.id, module_id: moduleRow.id, item_type: "reading", title: "Verified completion trigger lesson", content_body: { text: "Completing this lesson verifies automatic course completion." }, estimated_minutes: 5, position: 20, completion_requirement: "manual_mark_complete", is_required: true }).select("id").single();
  if (error) throw error;
  completionItem = data;
}

const { error: instructorError } = await owner.from("course_instructors").upsert({ tenant_id: tenant.id, course_id: course.id, user_id: memberUser.user.id, assigned_by: ownerUser.user.id }, { onConflict: "course_id,user_id" });
if (instructorError) throw instructorError;
const instructorTitle = `Verified by instructor ${Date.now()}`;
const { data: instructorUpdate, error: instructorUpdateError } = await member.from("module_items").update({ title: instructorTitle }).eq("id", itemRow.id).select("id").single();
if (instructorUpdateError || instructorUpdate.id !== itemRow.id) throw instructorUpdateError ?? new Error("An assigned instructor could not update course content.");
const { error: restoreError } = await owner.from("module_items").update({ title: "Verified reading lesson" }).eq("id", itemRow.id);
if (restoreError) throw restoreError;

const { data: enrollmentId, error: enrollmentError } = await member.rpc("lms_enroll_course", { check_course_id: course.id, use_dummy_payment: false });
if (enrollmentError || !enrollmentId) throw enrollmentError ?? new Error("A learner could not enroll in a free course.");
const { error: startError } = await member.rpc("lms_start_course_item", { check_item_id: completionItem.id });
if (startError) throw startError;
const sessionKey = crypto.randomUUID();
const heartbeatKey = crypto.randomUUID();
const { data: acceptedSeconds, error: heartbeatError } = await member.rpc("lms_record_heartbeat", { check_item_id: completionItem.id, check_session_key: sessionKey, check_heartbeat_key: heartbeatKey, check_seconds: 30 });
if (heartbeatError || acceptedSeconds !== 30) throw heartbeatError ?? new Error("A valid learning heartbeat was not recorded.");
const { data: duplicateSeconds, error: duplicateHeartbeatError } = await member.rpc("lms_record_heartbeat", { check_item_id: completionItem.id, check_session_key: sessionKey, check_heartbeat_key: heartbeatKey, check_seconds: 30 });
if (duplicateHeartbeatError || duplicateSeconds !== 0) throw duplicateHeartbeatError ?? new Error("Duplicate heartbeat protection failed.");
const { error: completionError } = await member.rpc("lms_complete_course_item", { check_item_id: completionItem.id, submitted_watch_percent: null, submitted_score: null, submitted_url: null });
if (completionError) throw completionError;
const { data: rollup, error: rollupError } = await member.rpc("lms_course_progress", { check_course_id: course.id });
if (rollupError || !rollup?.[0] || rollup[0].completed_items < 1 || rollup[0].time_spent_seconds < 30) throw rollupError ?? new Error("Progress rollup is incorrect.");
const { data: completedEnrollment, error: completedEnrollmentError } = await member.from("course_enrollments").select("status, completed_at").eq("id", enrollmentId).single();
if (completedEnrollmentError || completedEnrollment.status !== "completed" || !completedEnrollment.completed_at) throw completedEnrollmentError ?? new Error("Course completion was not derived from required item progress.");
const { data: certificate, error: certificateError } = await member.from("course_certificates").select("id, verification_id").eq("enrollment_id", enrollmentId).single();
if (certificateError) throw certificateError;
const { data: publicCertificate, error: publicCertificateError } = await anonymous.rpc("verify_course_certificate", { check_verification_id: certificate.verification_id });
if (publicCertificateError || publicCertificate?.[0]?.credential_status !== "valid") throw publicCertificateError ?? new Error("Public certificate verification failed.");
const { data: badgeAward, error: badgeAwardError } = await member.from("course_badge_awards").select("id, verification_id").eq("course_id", course.id).eq("user_id", memberUser.user.id).single();
if (badgeAwardError) throw badgeAwardError;
const assertion = await signBadgeAward(admin, badgeAward.id);
const [encodedHeader, encodedPayload, encodedSignature] = assertion.compactJwt.split(".");
const signatureValid = verifySignature(null, Buffer.from(`${encodedHeader}.${encodedPayload}`), createPublicKey({ key: JSON.parse(process.env.OPEN_BADGES_PUBLIC_JWK), format: "jwk" }), Buffer.from(encodedSignature, "base64url"));
if (!signatureValid || assertion.credential.type[1] !== "OpenBadgeCredential") throw new Error("Open Badge signature verification failed.");
const { data: publicBadge, error: publicBadgeError } = await anonymous.rpc("verify_course_badge", { check_verification_id: badgeAward.verification_id });
if (publicBadgeError || publicBadge?.[0]?.credential_status !== "valid") throw publicBadgeError ?? new Error("Public badge verification failed.");

console.log(JSON.stringify({ lmsSchemaAvailable: true, draftCourseHiddenFromLearners: true, learnerAuthoringRejected: true, publishedCourseHierarchyReadable: true, learnerItemAccessVerified: true, courseInstructorScopeVerified: true, learnerEnrollmentVerified: true, duplicateHeartbeatRejected: true, itemCompletionVerified: true, courseCompletionVerified: true, progressRollupVerified: true, certificateIssuanceVerified: true, publicCertificateVerificationVerified: true, openBadgeEdDsaSignatureVerified: true, publicBadgeVerificationVerified: true, tenantScopedPoliciesActive: true }, null, 2));
