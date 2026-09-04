import Link from "next/link";
import { ArrowUpRight, Building2, CreditCard, Gauge, ShieldCheck, Users } from "lucide-react";
import { updateTenantSubscription } from "@/app/actions/platform";
import { signOut } from "@/app/actions/auth";
import { requirePlatformRole, verifyUser } from "@/lib/auth/dal";
import type { SubscriptionStatus, TenantStatus } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

const subscriptionStatuses: SubscriptionStatus[] = ["trialing", "active", "past_due", "paused", "cancelled"];

function label(value: string) {
  return value.replaceAll("_", " ").replace(/^./, (letter) => letter.toUpperCase());
}

function statusTone(status: TenantStatus) {
  if (status === "active") return "bg-emerald-50 text-emerald-700";
  if (status === "trial") return "bg-blue-50 text-blue-700";
  if (status === "past_due") return "bg-amber-50 text-amber-700";
  return "bg-rose-50 text-rose-700";
}

export default async function PlatformPage() {
  const [user, platformRole] = await Promise.all([
    verifyUser(),
    requirePlatformRole(["super_admin", "support_admin", "billing_admin"]),
  ]);
  const supabase = await createClient();
  const [
    { data: tenants, error: tenantError },
    { data: memberships },
    { data: audits },
    { data: plans, error: planError },
    { data: entitlements },
    { data: subscriptions, error: subscriptionError },
    { data: usageCounters },
  ] = await Promise.all([
    supabase.from("tenants").select("id, name, slug, plan, status, trial_ends_at, created_at").order("created_at", { ascending: false }),
    supabase.from("tenant_memberships").select("tenant_id, user_id, role, status"),
    supabase.from("audit_logs").select("id, tenant_id, action, created_at, metadata").order("created_at", { ascending: false }).limit(8),
    supabase.from("subscription_plans").select("id, name, description, monthly_price_cents, annual_price_cents").eq("is_active", true).order("display_order"),
    supabase.from("plan_entitlements").select("plan_id, entitlement_key, value, description"),
    supabase.from("tenant_subscriptions").select("tenant_id, plan_id, status, billing_provider, current_period_ends_at, trial_ends_at"),
    supabase.from("tenant_usage_counters").select("tenant_id, metric_key, period_starts_on, quantity").order("period_starts_on", { ascending: false }),
  ]);

  if (tenantError) throw new Error(`Unable to load organizations: ${tenantError.message}`);
  if (planError) throw new Error(`Unable to load plans: ${planError.message}`);
  if (subscriptionError) throw new Error(`Unable to load subscriptions: ${subscriptionError.message}`);
  const organizations = (tenants ?? []) as Array<{
    id: string; name: string; slug: string; plan: string; status: TenantStatus; trial_ends_at: string; created_at: string;
  }>;
  const planCatalog = (plans ?? []) as Array<{
    id: string; name: string; description: string; monthly_price_cents: number; annual_price_cents: number;
  }>;
  const subscriptionsByTenant = new Map((subscriptions ?? []).map((subscription) => [subscription.tenant_id, subscription as {
    tenant_id: string; plan_id: string; status: SubscriptionStatus; billing_provider: string; current_period_ends_at: string | null; trial_ends_at: string | null;
  }]));
  const entitlementByPlan = new Map<string, Map<string, unknown>>();
  for (const entitlement of entitlements ?? []) {
    const planEntitlements = entitlementByPlan.get(entitlement.plan_id) ?? new Map<string, unknown>();
    planEntitlements.set(entitlement.entitlement_key, entitlement.value);
    entitlementByPlan.set(entitlement.plan_id, planEntitlements);
  }
  const latestUsage = new Map<string, number>();
  for (const counter of usageCounters ?? []) {
    const key = `${counter.tenant_id}:${counter.metric_key}`;
    if (!latestUsage.has(key)) latestUsage.set(key, Number(counter.quantity));
  }
  const memberCounts = new Map<string, number>();
  for (const membership of memberships ?? []) {
    if (membership.status === "active") memberCounts.set(membership.tenant_id, (memberCounts.get(membership.tenant_id) ?? 0) + 1);
  }
  const totalMembers = [...memberCounts.values()].reduce((sum, count) => sum + count, 0);
  const activeOrganizations = organizations.filter((tenant) => tenant.status === "active").length;
  const attentionOrganizations = organizations.filter((tenant) => ["past_due", "suspended"].includes(tenant.status)).length;
  const monthlyRecurringRevenue = (subscriptions ?? []).reduce((sum, subscription) => {
    if (!(["active", "trialing"] as string[]).includes(subscription.status)) return sum;
    return sum + (planCatalog.find((plan) => plan.id === subscription.plan_id)?.monthly_price_cents ?? 0);
  }, 0);

  return (
    <main className="min-h-screen bg-[#f4f7f5] text-[#17251f]">
      <header className="border-b border-[#dfe7e2] bg-white/90 px-5 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1480px] items-center gap-3">
          <span className="grid size-9 place-items-center rounded-xl bg-[#173f31] font-display font-bold text-white">C</span>
          <div><b className="font-display block text-sm">Circular Platform</b><span className="block text-[10px] uppercase tracking-[.14em] text-[#7d8b83]">Owner console</span></div>
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-right sm:block"><b className="block text-xs">{user.displayName}</b><small className="capitalize text-[#7d8b83]">{label(platformRole)}</small></span>
            <form action={signOut}><button className="rounded-xl border border-[#dce5df] bg-white px-3 py-2 text-xs font-semibold hover:bg-[#f5f8f6]">Sign out</button></form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1480px] space-y-6 p-5 sm:p-8">
        <section className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div><p className="text-[10px] font-bold uppercase tracking-[.17em] text-[#367458]">Platform operations</p><h1 className="font-display mt-2 text-3xl font-bold tracking-[-.04em]">Organization control center</h1><p className="mt-2 text-sm text-[#718078]">Monitor subscribers, members, lifecycle state, and platform activity.</p></div>
          <Link href="/dashboard" className="inline-flex h-10 items-center gap-2 self-start rounded-xl border border-[#dce5df] bg-white px-4 text-xs font-semibold shadow-sm">Open workspace <ArrowUpRight size={14}/></Link>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Organizations", organizations.length, Building2],
            ["Active organizations", activeOrganizations, ShieldCheck],
            ["Active memberships", totalMembers, Users],
            ["Local MRR", `$${(monthlyRecurringRevenue / 100).toLocaleString()}`, CreditCard],
          ].map(([metric, value, Icon]) => {
            const MetricIcon = Icon as typeof Building2;
            return <div key={String(metric)} className="rounded-[20px] border border-[#e0e7e2] bg-white p-5 shadow-[0_1px_2px_rgba(20,45,33,.03)]"><div className="flex items-start justify-between"><span className="text-sm text-[#718078]">{String(metric)}</span><span className="grid size-9 place-items-center rounded-xl bg-[#edf4f0] text-[#27674d]"><MetricIcon size={17}/></span></div><b className="font-display mt-5 block text-3xl">{String(value)}</b></div>;
          })}
        </section>

        <section>
          <div className="mb-4 flex items-end justify-between"><div><h2 className="font-display text-lg font-bold">Plan catalog</h2><p className="mt-1 text-xs text-[#7a8880]">Circular entitlements remain authoritative; a billing provider can synchronize into this model later.</p></div><span className="text-xs font-semibold text-[#6f7f76]">{attentionOrganizations} need attention</span></div>
          <div className="grid gap-4 lg:grid-cols-3">{planCatalog.map((plan) => {
            const planEntitlements = entitlementByPlan.get(plan.id);
            const memberLimit = Number(planEntitlements?.get("members.max") ?? 0);
            const spaceLimit = Number(planEntitlements?.get("spaces.max") ?? 0);
            const aiLimit = Number(planEntitlements?.get("ai_agents.max") ?? 0);
            return <article key={plan.id} className="rounded-[20px] border border-[#e0e7e2] bg-white p-5 shadow-[0_1px_2px_rgba(20,45,33,.03)]"><div className="flex items-start justify-between"><div><h3 className="font-display font-bold">{plan.name}</h3><p className="mt-1 text-xs leading-5 text-[#78867e]">{plan.description}</p></div><span className="grid size-9 shrink-0 place-items-center rounded-xl bg-[#edf4f0] text-[#27674d]"><Gauge size={17}/></span></div><p className="mt-5"><b className="font-display text-2xl">${(plan.monthly_price_cents / 100).toLocaleString()}</b><span className="text-xs text-[#7a8880]"> / month</span></p><div className="mt-4 grid grid-cols-3 gap-2 text-center text-[10px]"><span className="rounded-xl bg-[#f4f7f5] p-2"><b className="block text-xs">{memberLimit.toLocaleString()}</b>members</span><span className="rounded-xl bg-[#f4f7f5] p-2"><b className="block text-xs">{spaceLimit}</b>spaces</span><span className="rounded-xl bg-[#f4f7f5] p-2"><b className="block text-xs">{aiLimit}</b>AI agents</span></div></article>;
          })}</div>
        </section>

        <section className="grid gap-5 xl:grid-cols-[1fr_340px]">
          <div className="overflow-hidden rounded-[22px] border border-[#e0e7e2] bg-white">
            <div className="border-b border-[#e8edea] p-5"><h2 className="font-display font-bold">Organizations</h2><p className="mt-1 text-xs text-[#7a8880]">Tenant-wide status controls are protected and audit logged.</p></div>
            <div className="divide-y divide-[#edf1ee]">
              {organizations.map((tenant) => (
                <div key={tenant.id} className="p-5">
                  {(() => {
                    const subscription = subscriptionsByTenant.get(tenant.id);
                    const planId = subscription?.plan_id ?? tenant.plan;
                    const memberLimit = Number(entitlementByPlan.get(planId)?.get("members.max") ?? 0);
                    const activeMembers = memberCounts.get(tenant.id) ?? latestUsage.get(`${tenant.id}:active_members`) ?? 0;
                    const usagePercent = memberLimit ? Math.min(100, Math.round((activeMembers / memberLimit) * 100)) : 0;
                    return <div className="space-y-4">
                      <div className="flex items-center gap-3"><span className="grid size-11 shrink-0 place-items-center rounded-2xl bg-[#e9f2ed] font-display font-bold text-[#26664d]">{tenant.name[0]?.toUpperCase()}</span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><b className="truncate text-sm">{tenant.name}</b><span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${statusTone(tenant.status)}`}>{label(tenant.status)}</span><span className="rounded-full bg-[#f0edfa] px-2.5 py-1 text-[10px] font-semibold text-[#6e56a6]">{label(subscription?.status ?? "trialing")}</span></div><p className="mt-1 text-xs text-[#7e8b84]">/{tenant.slug} · {label(planId)} · {activeMembers} active members</p></div></div>
                      <div><div className="mb-1.5 flex justify-between text-[10px] text-[#74827a]"><span>Member usage</span><b>{activeMembers.toLocaleString()} / {memberLimit.toLocaleString()}</b></div><div className="h-1.5 overflow-hidden rounded-full bg-[#edf1ee]"><div className="h-full rounded-full bg-[#398263]" style={{ width: `${usagePercent}%` }}/></div></div>
                      {(["super_admin", "billing_admin"] as string[]).includes(platformRole) && <form action={updateTenantSubscription} className="grid gap-2 md:grid-cols-[130px_140px_minmax(180px,1fr)_auto]">
                        <input type="hidden" name="tenantId" value={tenant.id}/>
                        <select name="planId" defaultValue={planId} aria-label={`Plan for ${tenant.name}`} className="h-10 rounded-xl border border-[#dce5df] bg-white px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#b9d8c8]">{planCatalog.map((plan) => <option key={plan.id} value={plan.id}>{plan.name}</option>)}</select>
                        <select name="subscriptionStatus" defaultValue={subscription?.status ?? "trialing"} aria-label={`Subscription status for ${tenant.name}`} className="h-10 rounded-xl border border-[#dce5df] bg-white px-3 text-xs font-semibold outline-none focus:ring-2 focus:ring-[#b9d8c8]">{subscriptionStatuses.map((status) => <option key={status} value={status}>{label(status)}</option>)}</select>
                        <input name="reason" placeholder="Reason (required to pause or cancel)" maxLength={300} className="h-10 rounded-xl border border-[#dce5df] px-3 text-xs outline-none focus:ring-2 focus:ring-[#b9d8c8]"/>
                        <button className="h-10 rounded-xl bg-[#183f30] px-4 text-xs font-semibold text-white hover:bg-[#245841]">Save subscription</button>
                      </form>}
                    </div>;
                  })()}
                </div>
              ))}
              {!organizations.length && <p className="p-8 text-center text-sm text-[#7a8880]">No organizations have been created yet.</p>}
            </div>
          </div>

          <aside className="h-fit rounded-[22px] border border-[#e0e7e2] bg-white p-5">
            <h2 className="font-display font-bold">Recent platform activity</h2>
            <div className="mt-5 space-y-4">{(audits ?? []).map((event) => <div key={event.id} className="border-l-2 border-[#cfe0d6] pl-3"><b className="block text-xs">{label(event.action)}</b><span className="mt-1 block text-[10px] text-[#829088]">{new Intl.DateTimeFormat("en", { dateStyle: "medium", timeStyle: "short" }).format(new Date(event.created_at))}</span></div>)}</div>
            {!(audits ?? []).length && <p className="mt-4 text-xs text-[#7a8880]">No platform activity yet.</p>}
          </aside>
        </section>
      </div>
    </main>
  );
}
