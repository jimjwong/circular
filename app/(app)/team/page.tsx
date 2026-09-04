import { requireOrganizationRole, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { TeamManager } from "@/components/organizations/team-manager";
import type { TenantRole } from "@/lib/auth/types";

export default async function TeamPage() {
  const user = await verifyUser();
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const supabase = await createClient();
  const [{ data: membershipRows, error: memberError }, { data: invitations }, { data: auditRows }] = await Promise.all([
    supabase.from("tenant_memberships").select("user_id, role, status, joined_at").eq("tenant_id", organization.id).order("joined_at"),
    supabase.from("organization_invitations").select("id, email, role, expires_at, created_at").eq("tenant_id", organization.id).eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("audit_logs").select("id, actor_id, action, target_type, created_at").eq("tenant_id", organization.id).order("created_at", { ascending: false }).limit(12),
  ]);
  if (memberError) throw new Error(memberError.message);

  const profileIds = [...new Set([...(membershipRows??[]).map(row=>row.user_id), ...(auditRows??[]).flatMap(row=>row.actor_id?[row.actor_id]:[])])];
  const { data: profiles } = profileIds.length ? await supabase.from("profiles").select("id, display_name, email").in("id", profileIds) : { data: [] };
  const nameById = new Map((profiles??[]).map(profile=>[profile.id, profile.display_name||"Member"]));
  const emailById = new Map((profiles??[]).map(profile=>[profile.id, profile.email||"Private email"]));
  emailById.set(user.id,user.email);

  return <TeamManager
    organizationName={organization.name}
    currentRole={organization.role}
    currentUserId={user.id}
    members={(membershipRows??[]).map(row=>({ userId:row.user_id, name:nameById.get(row.user_id)||"Member", email:emailById.get(row.user_id)||"Private email", role:row.role as TenantRole, status:row.status, joinedAt:row.joined_at }))}
    invitations={(invitations??[]).map(row=>({ id:row.id,email:row.email,role:row.role as TenantRole,expiresAt:row.expires_at,createdAt:row.created_at }))}
    audits={(auditRows??[]).map(row=>({ id:row.id,action:row.action,targetType:row.target_type,createdAt:row.created_at,actorName:row.actor_id?nameById.get(row.actor_id)||"Member":"System" }))}
  />;
}
