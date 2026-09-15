import "server-only";
import { createClient } from "@/lib/supabase/server";

export type EmailRecipient = {
  userId: string;
  email: string;
  displayName: string;
  membershipTier: string;
  roleSlugs: string[];
};

export async function resolveEmailAudience(tenantId: string, filters: string[]): Promise<EmailRecipient[]> {
  const supabase = await createClient();
  const { data: memberships, error } = await supabase
    .from("tenant_memberships")
    .select("user_id, membership_tier")
    .eq("tenant_id", tenantId)
    .eq("status", "active");
  if (error) throw new Error(`Unable to load the audience: ${error.message}`);
  const userIds = (memberships ?? []).map((membership) => membership.user_id);
  if (!userIds.length) return [];

  const segmentIds = filters.filter((value) => value.startsWith("segment:")).map((value) => value.slice(8));
  const [{ data: profiles, error: profileError }, { data: assignments, error: assignmentError }, { data: roles, error: roleError }, { data: segments, error: segmentError }, { data: memberTags, error: tagError }] = await Promise.all([
    supabase.from("profiles").select("id, email, display_name, location, interests").in("id", userIds),
    supabase.from("tenant_member_access_roles").select("user_id, role_id").eq("tenant_id", tenantId),
    supabase.from("tenant_access_roles").select("id, slug").eq("tenant_id", tenantId),
    segmentIds.length ? supabase.from("member_segments").select("id, criteria").eq("tenant_id", tenantId).in("id", segmentIds) : Promise.resolve({ data: [], error: null }),
    segmentIds.length ? supabase.from("member_tags").select("user_id, tag_id").eq("tenant_id", tenantId) : Promise.resolve({ data: [], error: null }),
  ]);
  if (profileError) throw new Error(`Unable to load member emails: ${profileError.message}`);
  if (assignmentError || roleError) throw new Error("Unable to load member roles.");
  if (segmentError || tagError) throw new Error("Unable to load saved audience segments.");

  const profileById = new Map((profiles ?? []).map((profile) => [profile.id, profile]));
  const roleById = new Map((roles ?? []).map((role) => [role.id, role.slug]));
  const rolesByUser = new Map<string, string[]>();
  for (const assignment of assignments ?? []) {
    const slug = roleById.get(assignment.role_id);
    if (slug) rolesByUser.set(assignment.user_id, [...(rolesByUser.get(assignment.user_id) ?? []), slug]);
  }
  const tagsByUser = new Map<string, Set<string>>();
  for (const assignment of memberTags ?? []) {
    const current = tagsByUser.get(assignment.user_id) ?? new Set<string>();
    current.add(assignment.tag_id);
    tagsByUser.set(assignment.user_id, current);
  }

  const tiers = new Set(filters.filter((value) => value.startsWith("tier:")).map((value) => value.slice(5)));
  const roleSlugs = new Set(filters.filter((value) => value.startsWith("role:")).map((value) => value.slice(5)));
  const includeAll = filters.includes("all") || (!tiers.size && !roleSlugs.size && !segmentIds.length);

  return (memberships ?? []).flatMap((membership) => {
    const profile = profileById.get(membership.user_id);
    const memberRoles = rolesByUser.get(membership.user_id) ?? [];
    const matchesSegment = (segments ?? []).some((segment) => {
      const criteria = segment.criteria as { membershipTier?: string | null; tagId?: string | null; interest?: string | null; location?: string | null };
      const tierMatches = !criteria.membershipTier || criteria.membershipTier === "any" || criteria.membershipTier === membership.membership_tier;
      const tagMatches = !criteria.tagId || tagsByUser.get(membership.user_id)?.has(criteria.tagId) === true;
      const interestNeedle = criteria.interest?.trim().toLowerCase();
      const interestMatches = !interestNeedle || (profile?.interests ?? []).some((interest: string) => interest.toLowerCase().includes(interestNeedle));
      const locationNeedle = criteria.location?.trim().toLowerCase();
      const locationMatches = !locationNeedle || profile?.location?.toLowerCase().includes(locationNeedle) === true;
      return tierMatches && tagMatches && interestMatches && locationMatches;
    });
    const matches = includeAll || tiers.has(membership.membership_tier) || memberRoles.some((role) => roleSlugs.has(role)) || matchesSegment;
    if (!matches || !profile?.email) return [];
    return [{ userId: membership.user_id, email: profile.email.trim().toLowerCase(), displayName: profile.display_name || profile.email, membershipTier: membership.membership_tier, roleSlugs: memberRoles }];
  });
}
