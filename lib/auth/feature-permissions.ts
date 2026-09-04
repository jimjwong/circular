export const DASHBOARD_VIEW_PERMISSIONS: Record<string, string[]> = {
  overview: ["dashboard.view"],
  spaces: ["spaces.manage"],
  posts: ["content.edit", "content.moderate"],
  members: ["members.manage", "roles.manage"],
  events: ["events.manage"],
  courses: ["courses.create", "courses.manage_all", "courses.manage_assigned"],
  live: ["events.manage"],
  audience: ["communications.manage"],
  email: ["communications.manage"],
  workflows: ["workflows.manage"],
  agents: ["agents.manage"],
  website: ["website.manage"],
  payments: ["billing.manage"],
  analytics: ["analytics.view"],
  settings: ["settings.manage"],
};

export function canAccessDashboardView(view: string, grantedPermissions: readonly string[]) {
  const required = DASHBOARD_VIEW_PERMISSIONS[view];
  return Boolean(required?.some((permission) => grantedPermissions.includes(permission)));
}
