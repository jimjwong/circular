"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { switchOrganization } from "@/app/actions/organizations";
import { CircularApp } from "@/components/circular-app";
import type { CurrentUser, OrganizationSummary } from "@/lib/auth/types";

export function AuthenticatedApp({ organizations, activeOrganizationId, currentUser, initialView }: { organizations: OrganizationSummary[]; activeOrganizationId: string; currentUser: CurrentUser; initialView?: string }) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function handleSwitch(tenantId: string) {
    await switchOrganization(tenantId);
    startTransition(() => router.refresh());
  }

  return <CircularApp key={initialView ?? "overview"} organizations={organizations} activeOrganizationId={activeOrganizationId} currentUser={currentUser} initialView={initialView} onSwitchOrganization={handleSwitch}/>;
}
