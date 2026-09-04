import { redirect } from "next/navigation";
import { getActiveOrganization, getOrganizations, verifyUser } from "@/lib/auth/dal";
import { AuthenticatedApp } from "@/components/organizations/authenticated-app";

export default async function DashboardPage({ searchParams }: { searchParams: Promise<{ view?: string }> }) {
  const { view } = await searchParams;
  const [user, organizations, activeOrganization] = await Promise.all([
    verifyUser(),
    getOrganizations(),
    getActiveOrganization(),
  ]);

  if (!organizations.length || !activeOrganization) redirect("/onboarding");
  if (["suspended", "cancelled"].includes(activeOrganization.status)) redirect("/organization-unavailable");

  return <AuthenticatedApp organizations={organizations} activeOrganizationId={activeOrganization.id} currentUser={user} initialView={view}/>;
}
