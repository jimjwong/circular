import { getActiveOrganization } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";
import { ThemeShell } from "@/components/themes/theme-shell";

export default async function AppLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const organization = await getActiveOrganization();
  let preset: unknown = "forest";
  let config: unknown = {};

  if (organization) {
    const supabase = await createClient();
    const { data } = await supabase.from("tenants").select("theme_preset, theme_config").eq("id", organization.id).maybeSingle();
    preset = data?.theme_preset ?? preset;
    config = data?.theme_config ?? config;
  }

  return <ThemeShell preset={preset} config={config}>{children}</ThemeShell>;
}
