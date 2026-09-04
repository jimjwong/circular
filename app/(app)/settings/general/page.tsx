import Link from "next/link";
import { ArrowLeft, Settings2 } from "lucide-react";
import { CommunitySettingsForm } from "@/components/organizations/community-settings-form";
import { getActiveOrganization, hasOrganizationPermission } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

export default async function GeneralSettingsPage() {
  const organization = await getActiveOrganization();
  if (!organization) return null;
  const supabase = await createClient();
  const [{ data: tenant, error }, canManage] = await Promise.all([
    supabase.from("tenants").select("name, slug, description, is_discoverable").eq("id", organization.id).single(),
    hasOrganizationPermission(organization.id, "workspace.full_access"),
  ]);
  if (error) throw new Error(error.message);

  return <><header className="theme-topbar border-b px-5"><div className="mx-auto flex h-16 max-w-5xl items-center gap-3"><Link href="/dashboard" aria-label="Back to dashboard" className="theme-icon-button grid size-9 place-items-center rounded-xl border"><ArrowLeft size={16}/></Link><span className="theme-primary grid size-9 place-items-center rounded-xl text-white"><Settings2 size={17}/></span><div><b className="block text-sm">General settings</b><span className="theme-muted text-[10px]">{tenant.name} · Community identity</span></div><Link href={`/${tenant.slug}`} className="theme-icon-button ml-auto rounded-xl border px-3 py-2 text-xs font-bold">View /{tenant.slug}</Link></div></header><main className="mx-auto max-w-5xl px-5 py-8"><div className="mb-5 flex flex-wrap gap-2"><Link href="/settings/general" aria-current="page" className="theme-primary rounded-xl px-4 py-2.5 text-xs font-bold text-white">General</Link><Link href="/settings/appearance" className="theme-icon-button rounded-xl border px-4 py-2.5 text-xs font-bold">Themes &amp; branding</Link><Link href="/team" className="theme-icon-button rounded-xl border px-4 py-2.5 text-xs font-bold">Roles &amp; permissions</Link></div><section className="theme-card max-w-3xl rounded-[24px] border p-6 sm:p-8"><span className="theme-brand-text text-[10px] font-bold uppercase tracking-[.16em]">Workspace identity</span><h1 className="font-display mt-2 text-3xl font-bold tracking-[-.04em]">Community name and URL</h1><p className="theme-muted mt-2 text-sm leading-6">These details appear throughout the member experience. Changing the URL immediately moves the community’s local address.</p><CommunitySettingsForm name={tenant.name} slug={tenant.slug} description={tenant.description??""} isDiscoverable={tenant.is_discoverable} canManage={canManage}/></section></main></>;
}
