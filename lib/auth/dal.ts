import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser, OrganizationSummary, PlatformRole, TenantRole } from "@/lib/auth/types";

const ACTIVE_TENANT_COOKIE = "circular-active-tenant";

export const verifyUser = cache(async (): Promise<CurrentUser> => {
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (error || !claims?.sub) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name")
    .eq("id", claims.sub)
    .maybeSingle();

  const email = typeof claims.email === "string" ? claims.email : "";
  const displayName: string = profile?.display_name || email.split("@")[0] || "Member";
  const initials = displayName
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");

  return { id: claims.sub, email, displayName, initials };
});

export const getOrganizations = cache(async (): Promise<OrganizationSummary[]> => {
  const user = await verifyUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("role, status, tenants!inner(id, name, slug, status, plan)")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) throw new Error(`Unable to load organizations: ${error.message}`);

  return (data ?? []).map((row) => {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      role: row.role as TenantRole,
      status: tenant.status,
      plan: tenant.plan,
    };
  });
});

export async function getActiveOrganization() {
  const organizations = await getOrganizations();
  if (!organizations.length) return null;

  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;
  return organizations.find((organization) => organization.id === requestedId) ?? organizations[0];
}

export async function requireOrganizationRole(allowedRoles: TenantRole[]) {
  const organization = await getActiveOrganization();
  if (!organization) redirect("/onboarding");
  if (!allowedRoles.includes(organization.role)) redirect("/dashboard");
  return organization;
}

export const getPlatformRole = cache(async (): Promise<PlatformRole | null> => {
  const user = await verifyUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("platform_staff")
    .select("role")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();

  if (error) throw new Error(`Unable to verify platform access: ${error.message}`);
  return (data?.role as PlatformRole | undefined) ?? null;
});

export async function requirePlatformRole(allowedRoles: PlatformRole[]) {
  const role = await getPlatformRole();
  if (!role || !allowedRoles.includes(role)) redirect("/dashboard");
  return role;
}

export { ACTIVE_TENANT_COOKIE };
