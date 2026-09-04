import { redirect } from "next/navigation";
import { getActiveOrganization, getOrganizationPermissions, getOrganizations, verifyUser } from "@/lib/auth/dal";
import { canAccessDashboardView } from "@/lib/auth/feature-permissions";
import { AuthenticatedApp } from "@/components/organizations/authenticated-app";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  if (view === "settings") redirect("/settings/general");
  const [user, organizations, activeOrganization] = await Promise.all([
    verifyUser(),
    getOrganizations(),
    getActiveOrganization(),
  ]);

  if (!organizations.length || !activeOrganization) redirect("/onboarding");
  if (["suspended", "cancelled"].includes(activeOrganization.status)) redirect("/organization-unavailable");
  const grantedPermissions = await getOrganizationPermissions(activeOrganization.id);
  if (!canAccessDashboardView("overview", grantedPermissions)) redirect(`/${activeOrganization.slug}`);
  if (view && !canAccessDashboardView(view, grantedPermissions)) redirect("/dashboard");

  return <AuthenticatedApp organizations={organizations} activeOrganizationId={activeOrganization.id} currentUser={user} initialView={view} grantedPermissions={grantedPermissions}/>;
}
