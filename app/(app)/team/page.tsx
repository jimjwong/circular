import { redirect } from "next/navigation";
import { getActiveOrganization, hasOrganizationPermission, verifyUser } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { TeamManager } from "@/components/organizations/team-manager";
import type { TenantRole } from "@/lib/auth/types";

export default async function TeamPage() {
  const user = await verifyUser();
  const organization = await getActiveOrganization();
  if (!organization) redirect("/onboarding");
  const [canManageMembers, canManageRoles] = await Promise.all([
    hasOrganizationPermission(organization.id, "members.manage"),
    hasOrganizationPermission(organization.id, "roles.manage"),
  ]);
  if (!canManageMembers && !canManageRoles) redirect("/dashboard");
  const supabase = await createClient();
  const [{ data: membershipRows, error: memberError }, { data: invitations }, { data: auditRows }, { data: accessRoles }, { data: permissionRows }, { data: assignments }] = await Promise.all([
    supabase.from("tenant_memberships").select("user_id, role, status, joined_at, membership_tier").eq("tenant_id", organization.id).order("joined_at"),
    supabase.from("organization_invitations").select("id, email, role, expires_at, created_at").eq("tenant_id", organization.id).eq("status", "pending").order("created_at", { ascending: false }),
    supabase.from("audit_logs").select("id, actor_id, action, target_type, created_at").eq("tenant_id", organization.id).order("created_at", { ascending: false }).limit(12),
    supabase.from("tenant_access_roles").select("id, name, slug, description, is_system, tenant_access_role_permissions(permission_key)").eq("tenant_id", organization.id).order("created_at"),
    supabase.from("access_permissions").select("key, name, description, category, position").order("position"),
    supabase.from("tenant_member_access_roles").select("user_id, role_id").eq("tenant_id", organization.id),
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
    canManageMembers={canManageMembers}
    canManageRoles={canManageRoles}
    currentUserId={user.id}
    members={(membershipRows??[]).map(row=>({ userId:row.user_id, name:nameById.get(row.user_id)||"Member", email:emailById.get(row.user_id)||"Private email", role:row.role as TenantRole, status:row.status, joinedAt:row.joined_at, membershipTier: row.membership_tier, accessRoleIds:(assignments??[]).filter(item=>item.user_id===row.user_id).map(item=>item.role_id) }))}
    accessRoles={(accessRoles??[]).map(role=>({ id:role.id,name:role.name,slug:role.slug,description:role.description??"",isSystem:role.is_system,permissionKeys:(role.tenant_access_role_permissions??[]).map((item:{permission_key:string})=>item.permission_key) }))}
    permissions={(permissionRows??[]).map(permission=>({ key:permission.key,name:permission.name,description:permission.description,category:permission.category }))}
    invitations={(invitations??[]).map(row=>({ id:row.id,email:row.email,role:row.role as TenantRole,expiresAt:row.expires_at,createdAt:row.created_at }))}
    audits={(auditRows??[]).map(row=>({ id:row.id,action:row.action,targetType:row.target_type,createdAt:row.created_at,actorName:row.actor_id?nameById.get(row.actor_id)||"Member":"System" }))}
  />;
}
