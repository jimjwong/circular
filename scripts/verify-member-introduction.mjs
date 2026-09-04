import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishableKey || !secretKey) throw new Error("Supabase local environment variables are required.");

const password = "Demo123!";
const member = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const owner = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

const [{ data: memberSession, error: memberLogin }, { error: ownerLogin }] = await Promise.all([
  member.auth.signInWithPassword({ email: "member@circular.demo", password }),
  owner.auth.signInWithPassword({ email: "owner@circular.demo", password }),
]);
if (memberLogin) throw memberLogin;
if (ownerLogin) throw ownerLogin;

const { data: tenant, error: tenantError } = await member.from("tenants").select("id").eq("slug", "creator-collective-demo").single();
if (tenantError) throw tenantError;

let postId;
try {
  const { data, error } = await member.rpc("publish_member_introduction", {
    check_tenant_id: tenant.id,
    intro_display_name: "Morgan Member",
    intro_headline: "Independent creator",
    intro_location: "Singapore",
    intro_bio: "I am building a practical membership program for independent designers and creative founders.",
    intro_interests: ["community building", "design", "creator business"],
    intro_goal: "I would like to meet thoughtful builders and get feedback on my first member journey.",
  });
  if (error) throw error;
  postId = data;

  const [{ data: onboarding }, { data: post }, { data: profile }, { data: notification }] = await Promise.all([
    member.from("member_onboarding").select("completed_at, introduction_post_id").eq("tenant_id", tenant.id).eq("user_id", memberSession.user.id).single(),
    member.from("posts").select("title, body, space_id").eq("id", postId).single(),
    member.from("profiles").select("display_name, headline, location, interests").eq("id", memberSession.user.id).single(),
    owner.from("notifications").select("kind, entity_id").eq("kind", "member.introduction").eq("entity_id", postId).maybeSingle(),
  ]);

  if (!onboarding?.completed_at || onboarding.introduction_post_id !== postId) throw new Error("Introduction onboarding was not completed.");
  if (post?.title !== "👋 Hi, I'm Morgan Member" || post?.body?.type !== "introduction") throw new Error("Introduction post was not created correctly.");
  if (profile?.headline !== "Independent creator" || profile?.location !== "Singapore" || profile?.interests?.length !== 3) throw new Error("Member profile was not updated correctly.");
  if (notification?.entity_id !== postId) throw new Error("Community staff did not receive an introduction notification.");
} finally {
  if (postId) {
    await admin.from("notifications").delete().eq("entity_id", postId);
    await admin.from("member_onboarding").delete().eq("tenant_id", tenant.id).eq("user_id", memberSession.user.id);
    await admin.from("posts").delete().eq("id", postId);
  }
  await admin.from("profiles").update({
    display_name: "Morgan Member",
    headline: "Independent creator",
    bio: "Independent creator. I am here to learn, contribute, and meet thoughtful community builders.",
    location: "Singapore",
    interests: ["community building", "creator business"],
  }).eq("id", memberSession.user.id);
}

console.log(JSON.stringify({ memberIntroductionRpcVerified: true, profileUpdateVerified: true, introductionPostVerified: true, staffNotificationVerified: true, demoStateRestored: true }, null, 2));
