import "server-only";

import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CurrentUser, OrganizationSummary, PlatformRole, TenantRole } from "@/lib/auth/types";

const ACTIVE_TENANT_COOKIE = "commune-active-tenant";

/**
 * The claims check behind verifyUser, without the redirect — for routes that must serve
 * anonymous visitors (a public site mount) and only special-case a signed-in viewer.
 * Calling verifyUser() itself there would redirect every anonymous visitor to /login
 * before the route ever got to decide whether this was actually a public page.
 */
export const getOptionalUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data: claimsData, error } = await supabase.auth.getClaims();
  const claims = claimsData?.claims;

  if (error || !claims?.sub) return null;

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

export const verifyUser = cache(async (): Promise<CurrentUser> => {
  const user = await getOptionalUser();
  if (!user) redirect("/login");
  return user;
});

export const getOrganizations = cache(async (): Promise<OrganizationSummary[]> => {
  const user = await verifyUser();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("role, status, tenants!tenant_memberships_tenant_id_fkey!inner(id, name, slug, description, status, plan)")
    .eq("user_id", user.id)
    .eq("status", "active");

  if (error) throw new Error(`Unable to load organizations: ${error.message}`);

  return (data ?? []).map((row) => {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    return {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      description: tenant.description,
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

/**
 * getActiveOrganization for a route that must not force anonymous visitors through
 * /login — returns null instead. A tenant slug can collide with a public website's own
 * directory mount (both are the first path segment); a signed-in member's own
 * organization takes precedence over that coincidence, an anonymous visitor's doesn't.
 */
export async function getOptionalActiveOrganization() {
  const user = await getOptionalUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tenant_memberships")
    .select("role, status, tenants!tenant_memberships_tenant_id_fkey!inner(id, name, slug, description, status, plan)")
    .eq("user_id", user.id)
    .eq("status", "active");
  if (error) throw new Error(`Unable to load organizations: ${error.message}`);

  const organizations: OrganizationSummary[] = (data ?? []).map((row) => {
    const tenant = Array.isArray(row.tenants) ? row.tenants[0] : row.tenants;
    return {
      id: tenant.id, name: tenant.name, slug: tenant.slug, description: tenant.description,
      role: row.role as TenantRole, status: tenant.status, plan: tenant.plan,
    };
  });
  if (!organizations.length) return null;

  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_TENANT_COOKIE)?.value;
  return organizations.find((organization) => organization.id === requestedId) ?? organizations[0];
}

export async function requireOrganizationRole(allowedRoles: TenantRole[]) {
  const organization = await getActiveOrganization();
  if (!organization) redirect("/onboarding");
  if (!allowedRoles.includes(organization.role)) {
    const fullAccess = allowedRoles.includes("admin") && await hasOrganizationPermission(organization.id, "workspace.full_access");
    if (!fullAccess) redirect("/dashboard");
  }
  return organization;
}

export const hasOrganizationPermission = cache(async (tenantId: string, permission: string): Promise<boolean> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("has_tenant_permission", {
    check_tenant_id: tenantId,
    check_permission: permission,
  });
  if (error) throw new Error(`Unable to verify organization permission: ${error.message}`);
  return Boolean(data);
});

export const getOrganizationPermissions = cache(async (tenantId: string): Promise<string[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_tenant_permissions", { check_tenant_id: tenantId });
  if (error) throw new Error(`Unable to load organization permissions: ${error.message}`);
  return (data ?? []).map((row: { permission_key: string }) => row.permission_key);
});

export async function requireOrganizationPermission(permission: string) {
  const organization = await getActiveOrganization();
  if (!organization) redirect("/onboarding");
  if (!await hasOrganizationPermission(organization.id, permission)) redirect("/dashboard");
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
