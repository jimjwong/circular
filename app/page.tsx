import { redirect } from "next/navigation";
import { getOrganizations, getPlatformRole, verifyUser } from "@/lib/auth/dal";

export default async function Home() {
  await verifyUser();
  const [organizations, platformRole] = await Promise.all([getOrganizations(), getPlatformRole()]);
  if (platformRole) redirect("/platform");
  redirect(organizations.length ? "/dashboard" : "/onboarding");
}
