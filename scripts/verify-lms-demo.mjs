import { createClient } from "@supabase/supabase-js";
import { createPublicKey, verify as verifySignature } from "node:crypto";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase environment variables are required.");
const client = () => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const sessions = { owner: client(), admin: client(), moderator: client(), member: client(), student: client() };
await Promise.all(Object.entries(sessions).map(async ([role, session]) => {
  const { error } = await session.auth.signInWithPassword({ email: `${role}@circular.demo`, password: "Demo123!" });
  if (error) throw error;
}));
const { data: tenant, error: tenantError } = await sessions.owner.from("tenants").select("id").eq("slug", "creator-collective-demo").single();
if (tenantError) throw tenantError;
const { data: ownerCourses, error: coursesError } = await sessions.owner.from("courses").select("id, slug, access_mode").eq("tenant_id", tenant.id).in("slug", ["creator-os", "community-foundations", "speaker-mastery-lab"]);
if (coursesError || ownerCourses?.length !== 3) throw coursesError ?? new Error("The three LMS demo courses were not seeded.");
const courseMap = new Map(ownerCourses.map((course) => [course.slug, course]));
const { data: modules } = await sessions.owner.from("course_modules").select("id").in("course_id", ownerCourses.map((course) => course.id));
const { data: items } = await sessions.owner.from("module_items").select("id, course_id, title, content_body").in("course_id", ownerCourses.map((course) => course.id));
if (modules?.length !== 6 || items?.length !== 10) throw new Error("The demo LMS hierarchy is incomplete.");

const { data: memberPrivateCourse } = await sessions.member.from("courses").select("id").eq("id", courseMap.get("speaker-mastery-lab").id).maybeSingle();
if (memberPrivateCourse) throw new Error("An uninvited member can see the private course.");
const { data: studentPrivateCourse, error: studentPrivateError } = await sessions.student.from("courses").select("id").eq("id", courseMap.get("speaker-mastery-lab").id).single();
if (studentPrivateError || !studentPrivateCourse) throw studentPrivateError ?? new Error("The invited student cannot see the private course.");

const quiz = items.find((item) => item.title === "Foundation knowledge check");
const correctAnswer = quiz?.content_body?.correctAnswer;
if (!quiz || !correctAnswer) throw new Error("Server-graded quiz configuration is missing.");
const { error: spoofedScoreError } = await sessions.student.rpc("lms_complete_course_item", { check_item_id: quiz.id, submitted_watch_percent: null, submitted_score: 100, submitted_url: null });
if (!spoofedScoreError) throw new Error("A learner fabricated a quiz score through the generic completion endpoint.");
const { data: wrongScore, error: wrongAnswerError } = await sessions.student.rpc("lms_submit_quiz", { check_item_id: quiz.id, submitted_answer: "A place for everyone to network" });
if (wrongAnswerError || Number(wrongScore) !== 0) throw wrongAnswerError ?? new Error("Incorrect quiz answers were not rejected by server grading.");
const { data: passingScore, error: passingAnswerError } = await sessions.student.rpc("lms_submit_quiz", { check_item_id: quiz.id, submitted_answer: correctAnswer });
if (passingAnswerError || Number(passingScore) !== 100) throw passingAnswerError ?? new Error("The correct quiz answer was not graded on the server.");

const { data: moderatorUser } = await sessions.moderator.auth.getUser();
const { data: completedEnrollment, error: completedError } = await sessions.moderator.from("course_enrollments").select("id, status").eq("course_id", courseMap.get("community-foundations").id).eq("user_id", moderatorUser.user.id).single();
if (completedError || completedEnrollment.status !== "completed") throw completedError ?? new Error("Completed demo learner is missing.");
const [{ data: certificate }, { data: award }] = await Promise.all([
  sessions.moderator.from("course_certificates").select("verification_id").eq("enrollment_id", completedEnrollment.id).single(),
  sessions.moderator.from("course_badge_awards").select("verification_id, assertion_json").eq("course_id", courseMap.get("community-foundations").id).eq("user_id", moderatorUser.user.id).single(),
]);
if (!certificate || !award?.assertion_json?.compactJwt) throw new Error("Certificate or signed badge demo is missing.");
const [header, payload, signature] = award.assertion_json.compactJwt.split(".");
const signatureValid = verifySignature(null, Buffer.from(`${header}.${payload}`), createPublicKey({ key: JSON.parse(process.env.OPEN_BADGES_PUBLIC_JWK), format: "jwk" }), Buffer.from(signature, "base64url"));
if (!signatureValid) throw new Error("The seeded Open Badge signature is invalid.");
const { data: publicCertificate } = await client().rpc("verify_course_certificate", { check_verification_id: certificate.verification_id });
const { data: publicBadge } = await client().rpc("verify_course_badge", { check_verification_id: award.verification_id });
if (publicCertificate?.[0]?.credential_status !== "valid" || publicBadge?.[0]?.credential_status !== "valid") throw new Error("Public demo credential verification failed.");
const { data: memberUser } = await sessions.member.auth.getUser();
const { data: leakedProgress } = await sessions.member.from("course_item_progress").select("id").neq("user_id", memberUser.user.id);
if (leakedProgress?.length) throw new Error("A learner can read another learner's progress.");
const { data: dummyPayment } = await sessions.student.from("course_payments").select("status, amount_cents").eq("course_id", courseMap.get("creator-os").id).single();
if (dummyPayment?.status !== "succeeded" || dummyPayment.amount_cents !== 14900) throw new Error("Dummy paid-course checkout is missing.");

console.log(JSON.stringify({ demoCourses: 3, demoModules: 6, demoItems: 10, freePaidPrivateAccessVerified: true, privateEnrollmentVerified: true, serverGradedQuizVerified: true, scoreSpoofingRejected: true, completedLearnerVerified: true, certificateVerified: true, openBadgeEdDsaVerified: true, learnerPrivacyVerified: true, dummyPaymentVerified: true }, null, 2));
