import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !publishableKey) throw new Error("Supabase environment variables are required.");

const platformOwner = createClient(url, publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const { error: signInError } = await platformOwner.auth.signInWithPassword({
  email: "owner@circular.local",
  password: "Circular123!",
});
if (signInError) throw signInError;

// The local Auth container can lead PostgREST by a fraction of a second.
await new Promise((resolve) => setTimeout(resolve, 1200));

const [
  { data: staff, error: staffError },
  { data: tenants, error: tenantError },
  { data: memberships, error: membershipError },
  { data: plans, error: planError },
  { data: subscriptions, error: subscriptionError },
  { data: usage, error: usageError },
] = await Promise.all([
  platformOwner.from("platform_staff").select("role, is_active").single(),
  platformOwner.from("tenants").select("id, status"),
  platformOwner.from("tenant_memberships").select("tenant_id, user_id, status"),
  platformOwner.from("subscription_plans").select("id, name"),
  platformOwner.from("tenant_subscriptions").select("tenant_id, plan_id, status, billing_provider"),
  platformOwner.from("tenant_usage_counters").select("tenant_id, metric_key, quantity"),
]);

if (staffError) throw staffError;
if (tenantError) throw tenantError;
if (membershipError) throw membershipError;
if (planError) throw planError;
if (subscriptionError) throw subscriptionError;
if (usageError) throw usageError;
if (staff.role !== "super_admin" || !staff.is_active) throw new Error("The local platform owner is not an active super administrator.");
if (plans?.length !== 3) throw new Error("Expected the three local subscription plans.");
if (subscriptions?.length !== tenants?.length) throw new Error("Every organization must have one subscription.");
if (!usage?.some((counter) => counter.metric_key === "active_members")) throw new Error("Active-member usage is not being metered.");

const firstTenant = tenants?.[0];
if (firstTenant) {
  const subscription = subscriptions.find((candidate) => candidate.tenant_id === firstTenant.id);
  if (!subscription) throw new Error("The verification organization has no subscription.");
  const { error } = await platformOwner.rpc("update_tenant_subscription", {
    check_tenant_id: firstTenant.id,
    next_plan_id: subscription.plan_id,
    next_status: subscription.status,
    change_reason: "Phase 2 authorization verification",
  });
  if (error) throw error;

  const { data: memberLimit, error: entitlementError } = await platformOwner.rpc("get_tenant_entitlement", {
    check_tenant_id: firstTenant.id,
    check_entitlement_key: "members.max",
  });
  if (entitlementError) throw entitlementError;
  if (typeof memberLimit !== "number" || memberLimit <= 0) throw new Error("The member entitlement is invalid.");
}

console.log(JSON.stringify({
  platformRole: staff.role,
  organizationsVisible: tenants?.length ?? 0,
  membershipsVisible: memberships?.length ?? 0,
  plansAvailable: plans?.length ?? 0,
  subscriptionsVisible: subscriptions?.length ?? 0,
  usageMetersVisible: usage?.length ?? 0,
  subscriptionControlAuthorized: Boolean(firstTenant),
  entitlementResolutionVerified: Boolean(firstTenant),
}, null, 2));
