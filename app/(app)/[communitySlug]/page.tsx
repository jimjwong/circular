import { notFound } from "next/navigation";
import CommunityPage from "@/app/(app)/community/page";
import { getActiveOrganization } from "@/lib/auth/dal";

export default async function CommunitySlugPage({ params }: { params: Promise<{ communitySlug: string }> }) {
  const { communitySlug } = await params;
  const organization = await getActiveOrganization();
  if (!organization || organization.slug !== communitySlug) notFound();
  return <CommunityPage searchParams={Promise.resolve({})}/>;
}
