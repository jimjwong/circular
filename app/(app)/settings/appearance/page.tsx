import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Palette } from "lucide-react";
import { getActiveOrganization } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { resolveTheme } from "@/lib/themes";
import { ThemeEditor } from "@/components/themes/theme-editor";

export default async function AppearanceSettingsPage() {
  const organization = await getActiveOrganization();
  if (!organization) redirect("/onboarding");
  const canManage = ["owner", "admin"].includes(organization.role);
  const supabase = await createClient();
  const { data } = await supabase.from("tenants").select("theme_preset, theme_config").eq("id", organization.id).single();
  const preset = data?.theme_preset ?? "forest";
  const theme = resolveTheme(preset, data?.theme_config);

  return <>
    <header className="theme-topbar border-b px-5"><div className="mx-auto flex h-16 max-w-6xl items-center gap-3"><Link href="/dashboard?view=settings" aria-label="Back to settings" className="theme-icon-button grid size-9 place-items-center rounded-xl border"><ArrowLeft size={16}/></Link><span className="theme-primary grid size-9 place-items-center rounded-xl text-white"><Palette size={17}/></span><div><b className="block text-sm">Appearance</b><span className="theme-muted text-[10px]">{organization.name} · Workspace branding</span></div></div></header>
    <main className="mx-auto max-w-6xl px-5 py-8"><div className="mb-7 max-w-2xl"><span className="theme-brand-text text-[10px] font-bold uppercase tracking-[.16em]">Design system</span><h1 className="font-display mt-2 text-3xl font-bold tracking-[-.04em]">Choose how your community feels</h1><p className="theme-muted mt-2 text-sm leading-6">Start with a curated palette or create a custom combination. Saved themes apply to every member in this workspace.</p></div><ThemeEditor initialPreset={preset} initialTheme={theme} canManage={canManage}/></main>
  </>;
}
