import "server-only";

import { redirect } from "next/navigation";
import { getActiveOrganization, hasOrganizationPermission, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export type DirectoryEntry = {
  user_id: string;
  display_name: string;
  avatar_url: string | null;
  bio: string | null;
  headline: string | null;
  location: string | null;
  interests: string[];
  pronouns: string | null;
  website_url: string | null;
  linkedin_url: string | null;
  email: string | null;
  membership_tier: "guest" | "associate" | "professional" | "corporate";
  account_role: "owner" | "admin" | "moderator" | "member";
  joined_at: string;
  activity_score: number;
  availability: string | null;
  directory_visibility: "members" | "admins" | "hidden";
  show_email: boolean;
  show_location: boolean;
  show_activity: boolean;
  show_courses: boolean;
  show_events: boolean;
  custom_values: Record<string, string | number | boolean>;
};

export type MemberProfileField = {
  id: string;
  field_key: string;
  label: string;
  field_type: "text" | "url" | "number" | "select" | "boolean";
  options: string[];
  help_text: string | null;
  visibility: "members" | "admins" | "self";
  is_required: boolean;
  is_active: boolean;
  position: number;
};

export async function loadMemberDirectory() {
  const [organization, user] = await Promise.all([getActiveOrganization(), verifyUser()]);
  if (!organization) redirect("/onboarding");
  const supabase = await createClient();
  const canManage = await hasOrganizationPermission(organization.id, "members.manage");
  const [{ data: directory, error }, { data: tags }, { data: assignments }, { data: fields }, { data: segments }, { data: ownMembership }] = await Promise.all([
    supabase.rpc("get_member_directory", { check_tenant_id: organization.id }),
    supabase.from("tags").select("id, name, color").eq("tenant_id", organization.id).order("name"),
    supabase.from("member_tags").select("tag_id, user_id").eq("tenant_id", organization.id),
    supabase.from("member_profile_fields").select("id, field_key, label, field_type, options, help_text, visibility, is_required, is_active, position").eq("tenant_id", organization.id).order("position"),
    canManage ? supabase.from("member_segments").select("id, name, criteria, created_at").eq("tenant_id", organization.id).order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
    supabase.from("tenant_memberships").select("membership_tier").eq("tenant_id", organization.id).eq("user_id", user.id).single(),
  ]);
  if (error) throw new Error(`Unable to load member directory: ${error.message}`);
  return {
    organization,
    user,
    canManage,
    viewerTier: ownMembership?.membership_tier as DirectoryEntry["membership_tier"],
    entries: (directory ?? []) as DirectoryEntry[],
    tags: tags ?? [],
    assignments: assignments ?? [],
    fields: (fields ?? []) as MemberProfileField[],
    segments: segments ?? [],
  };
}

export function memberInitials(name: string) {
  return name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "M";
}

export function membershipLabel(tier: DirectoryEntry["membership_tier"]) {
  if (tier === "professional") return "Professional Member";
  if (tier === "corporate") return "Corporate Member";
  if (tier === "associate") return "Associate Member";
  return "Guest";
}
