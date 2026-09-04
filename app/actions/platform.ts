"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requirePlatformRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const lifecycleSchema = z.object({
  tenantId: z.string().uuid(),
  status: z.enum(["trial", "active", "past_due", "suspended", "cancelled"]),
  reason: z.string().trim().max(300).optional(),
});

const subscriptionSchema = z.object({
  tenantId: z.string().uuid(),
  planId: z.string().regex(/^[a-z][a-z0-9_-]*$/),
  subscriptionStatus: z.enum(["trialing", "active", "past_due", "paused", "cancelled"]),
  reason: z.string().trim().max(300).optional(),
});

export async function updateTenantLifecycle(formData: FormData) {
  await requirePlatformRole(["super_admin"]);
  const parsed = lifecycleSchema.safeParse({
    tenantId: formData.get("tenantId"),
    status: formData.get("status"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) throw new Error("The organization status request is invalid.");
  if (["suspended", "cancelled"].includes(parsed.data.status) && !parsed.data.reason) {
    throw new Error("Add a reason before suspending or cancelling an organization.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_tenant_lifecycle", {
    check_tenant_id: parsed.data.tenantId,
    next_status: parsed.data.status,
    change_reason: parsed.data.reason ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/platform");
}

export async function updateTenantSubscription(formData: FormData) {
  await requirePlatformRole(["super_admin", "billing_admin"]);
  const parsed = subscriptionSchema.safeParse({
    tenantId: formData.get("tenantId"),
    planId: formData.get("planId"),
    subscriptionStatus: formData.get("subscriptionStatus"),
    reason: formData.get("reason") || undefined,
  });

  if (!parsed.success) throw new Error("The subscription update is invalid.");
  if (["paused", "cancelled"].includes(parsed.data.subscriptionStatus) && !parsed.data.reason) {
    throw new Error("Add a reason before pausing or cancelling a subscription.");
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("update_tenant_subscription", {
    check_tenant_id: parsed.data.tenantId,
    next_plan_id: parsed.data.planId,
    next_status: parsed.data.subscriptionStatus,
    change_reason: parsed.data.reason ?? null,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/platform");
  revalidatePath("/dashboard");
}
