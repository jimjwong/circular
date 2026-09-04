export type TenantRole = "owner" | "admin" | "moderator" | "member";
export type TenantStatus = "trial" | "active" | "past_due" | "suspended" | "cancelled";
export type PlatformRole = "super_admin" | "support_admin" | "billing_admin";
export type SubscriptionStatus = "trialing" | "active" | "past_due" | "paused" | "cancelled";

export type OrganizationSummary = {
  id: string;
  name: string;
  slug: string;
  role: TenantRole;
  status: TenantStatus;
  plan: string;
};

export type CurrentUser = {
  id: string;
  email: string;
  displayName: string;
  initials: string;
};

export type AuthState = {
  message?: string;
  success?: string;
  errors?: Record<string, string[]>;
};
