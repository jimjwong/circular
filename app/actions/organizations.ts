"use server";

import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import type { Route } from "next";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { ACTIVE_TENANT_COOKIE, getOrganizations, requireOrganizationRole, verifyUser } from "@/lib/auth/dal";
import type { AuthState, TenantRole } from "@/lib/auth/types";
import { createClient } from "@/lib/supabase/server";

const organizationSchema = z.object({
  name: z.string().trim().min(2, "Enter an organization name."),
  slug: z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase letters, numbers, and single hyphens."),
});

const inviteSchema = z.object({
  email: z.string().trim().toLowerCase().email("Enter a valid email address."),
  role: z.enum(["admin", "moderator", "member"]),
});

export type OrganizationActionState = AuthState & { inviteUrl?: string };

export async function createOrganization(
  _: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const parsed = organizationSchema.safeParse({ name: formData.get("name"), slug: formData.get("slug") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_organization", {
    organization_name: parsed.data.name,
    organization_slug: parsed.data.slug,
  });

  if (error) {
    return { message: error.code === "23505" ? "That organization URL is already in use." : error.message };
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, data, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  redirect("/dashboard");
}

export async function switchOrganization(tenantId: string) {
  const organizations = await getOrganizations();
  if (!organizations.some((organization) => organization.id === tenantId)) {
    throw new Error("You do not have access to that organization.");
  }

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, tenantId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
  });
  revalidatePath("/dashboard");
}

export async function inviteMember(
  _: OrganizationActionState | undefined,
  formData: FormData,
): Promise<OrganizationActionState> {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const user = await verifyUser();
  const parsed = inviteSchema.safeParse({ email: formData.get("email"), role: formData.get("role") });
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };

  if (organization.role === "admin" && parsed.data.role === "admin") {
    return { message: "Only the organization owner can invite another administrator." };
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const supabase = await createClient();

  await supabase
    .from("organization_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("tenant_id", organization.id)
    .eq("email", parsed.data.email)
    .eq("status", "pending");

  const { error } = await supabase.from("organization_invitations").insert({
    tenant_id: organization.id,
    email: parsed.data.email,
    role: parsed.data.role,
    token_hash: tokenHash,
    invited_by: user.id,
  });

  if (error) return { message: error.message };

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  revalidatePath("/team");
  return { success: "Invitation created. Share this local link with the teammate.", inviteUrl: `${siteUrl}/invite/${rawToken}` };
}

export async function revokeInvitation(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const invitationId = String(formData.get("invitationId") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("organization_invitations")
    .update({ status: "revoked", revoked_at: new Date().toISOString() })
    .eq("id", invitationId)
    .eq("tenant_id", organization.id)
    .eq("status", "pending");
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function updateMember(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const userId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "member") as TenantRole;
  const status = String(formData.get("status") ?? "active");
  if (!(["admin", "moderator", "member"] as string[]).includes(role)) throw new Error("Invalid role.");
  if (!(["active", "suspended"] as string[]).includes(status)) throw new Error("Invalid status.");
  if (organization.role === "admin" && role === "admin") throw new Error("Only the owner can assign administrators.");

  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_memberships")
    .update({ role, status, updated_at: new Date().toISOString() })
    .eq("tenant_id", organization.id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function removeMember(formData: FormData) {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const userId = String(formData.get("userId") ?? "");
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenant_memberships")
    .delete()
    .eq("tenant_id", organization.id)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  revalidatePath("/team");
}

export async function transferOwnership(formData: FormData) {
  const organization = await requireOrganizationRole(["owner"]);
  const targetUserId = String(formData.get("userId") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.rpc("transfer_tenant_ownership", {
    check_tenant_id: organization.id,
    target_user_id: targetUserId,
  });
  if (error) throw new Error(error.message);
  revalidatePath("/team");
  revalidatePath("/dashboard");
}

export async function acceptInvitation(formData: FormData) {
  await verifyUser();
  const token = String(formData.get("token") ?? "");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("accept_organization_invitation", { raw_token: token });
  if (error) redirect(`/invite/${encodeURIComponent(token)}?error=${encodeURIComponent(error.message)}` as Route);

  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_TENANT_COOKIE, data, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/" });
  redirect("/dashboard");
}
