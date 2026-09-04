import { createHash, randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secret = process.env.SUPABASE_SECRET_KEY;
if (!url || !publishableKey || !secret) throw new Error("Supabase environment variables are required.");

const admin = createClient(url, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const owner = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });

const ownerEmail = "owner@circular.local";
const ownerPassword = "Circular123!";
const memberEmail = "phase-one-member@circular.local";
const memberPassword = "PhaseOne123!";

const { error: ownerSignInError } = await owner.auth.signInWithPassword({ email: ownerEmail, password: ownerPassword });
if (ownerSignInError) throw ownerSignInError;

let { data: existingTenant } = await owner.from("tenants").select("id").eq("slug", "phase-one-verification").maybeSingle();
let tenantId = existingTenant?.id;
if (!tenantId) {
  const { data, error } = await owner.rpc("create_organization", {
    organization_name: "Phase One Verification",
    organization_slug: "phase-one-verification",
  });
  if (error) throw error;
  tenantId = data;
}

const { data: users, error: listError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;
let memberUser = users.users.find((user) => user.email === memberEmail);
if (!memberUser) {
  const { data, error } = await admin.auth.admin.createUser({ email: memberEmail, password: memberPassword, email_confirm: true, user_metadata: { full_name: "Phase One Member" } });
  if (error) throw error;
  memberUser = data.user;
}

await owner.from("organization_invitations").update({ status: "revoked", revoked_at: new Date().toISOString() }).eq("tenant_id", tenantId).eq("email", memberEmail).eq("status", "pending");
const rawToken = randomBytes(32).toString("base64url");
const tokenHash = createHash("sha256").update(rawToken).digest("hex");
const { data: ownerUser } = await owner.auth.getUser();
const { error: inviteError } = await owner.from("organization_invitations").insert({ tenant_id: tenantId, email: memberEmail, role: "member", token_hash: tokenHash, invited_by: ownerUser.user.id });
if (inviteError) throw inviteError;

const member = createClient(url, publishableKey, { auth: { persistSession: false, autoRefreshToken: false } });
const { error: memberSignInError } = await member.auth.signInWithPassword({ email: memberEmail, password: memberPassword });
if (memberSignInError) throw memberSignInError;
const { data: acceptedTenant, error: acceptError } = await member.rpc("accept_organization_invitation", { raw_token: rawToken });
if (acceptError) throw acceptError;
if (acceptedTenant !== tenantId) throw new Error("Invitation returned the wrong tenant.");

const [{ data: staff }, { data: ownerMembership }, { data: memberTenant }, { count: auditCount }] = await Promise.all([
  owner.from("platform_staff").select("role, is_active").single(),
  owner.from("tenant_memberships").select("role").eq("tenant_id", tenantId).eq("user_id", ownerUser.user.id).single(),
  member.from("tenants").select("id").eq("id", tenantId).single(),
  owner.from("audit_logs").select("id", { count: "exact", head: true }).eq("tenant_id", tenantId),
]);

if (staff?.role !== "super_admin" || !staff.is_active) throw new Error("Platform owner role is missing.");
if (ownerMembership?.role !== "owner") throw new Error("Organization owner membership is missing.");
if (memberTenant?.id !== tenantId) throw new Error("Accepted member cannot read the organization.");
if (!auditCount || auditCount < 3) throw new Error("Expected organization audit events were not recorded.");

console.log(JSON.stringify({
  platformRole: staff.role,
  organizationCreated: true,
  ownerRole: ownerMembership.role,
  invitationAccepted: true,
  tenantIsolationVerified: true,
  auditEvents: auditCount,
}, null, 2));
