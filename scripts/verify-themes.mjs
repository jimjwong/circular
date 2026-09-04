import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
if (!url || !key) throw new Error("Supabase environment variables are required.");

const connect = async (role) => {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email: `${role}@circular.demo`, password: "Demo123!" });
  if (error) throw error;
  return client;
};

const [owner, admin, moderator, member] = await Promise.all(["owner", "admin", "moderator", "member"].map(connect));
const { data: tenant, error: tenantError } = await owner.from("tenants").select("id, theme_preset, theme_config").eq("slug", "creator-collective-demo").single();
if (tenantError) throw tenantError;
const original = { theme_preset: tenant.theme_preset, theme_config: tenant.theme_config };

try {
  const ocean = { primary: "#164e63", primaryHover: "#0e7490", accent: "#38bdf8", background: "#f0f9ff", surface: "#ffffff", text: "#12303b", muted: "#607b86", border: "#cfe6ef", headingFont: "manrope", bodyFont: "inter" };
  const { error: ownerError } = await owner.from("tenants").update({ theme_preset: "ocean", theme_config: ocean }).eq("id", tenant.id);
  if (ownerError) throw new Error(`Owner theme update failed: ${ownerError.message}`);
  const { data: ownerSaved } = await member.from("tenants").select("theme_preset, theme_config").eq("id", tenant.id).single();
  if (ownerSaved.theme_preset !== "ocean" || ownerSaved.theme_config.primary !== ocean.primary) throw new Error("Members cannot read the saved workspace theme.");

  const custom = { ...ocean, primary: "#4f46e5", primaryHover: "#4338ca", headingFont: "editorial" };
  const { error: adminError } = await admin.from("tenants").update({ theme_preset: "custom", theme_config: custom }).eq("id", tenant.id);
  if (adminError) throw new Error(`Admin theme update failed: ${adminError.message}`);
  const { data: adminSaved } = await owner.from("tenants").select("theme_preset, theme_config").eq("id", tenant.id).single();
  if (adminSaved.theme_preset !== "custom" || adminSaved.theme_config.headingFont !== "editorial") throw new Error("Custom colors and fonts did not persist.");

  for (const [role, client] of [["moderator", moderator], ["member", member]]) {
    const { data, error } = await client.from("tenants").update({ theme_preset: "rose" }).eq("id", tenant.id).select("id");
    if (!error && data?.length) throw new Error(`${role} was able to change the workspace theme.`);
  }

  console.log(JSON.stringify({ ownerCanManageThemes: true, adminCanManageThemes: true, membersReadSavedTheme: true, customColorsPersist: true, customFontsPersist: true, moderatorUpdateRejected: true, memberUpdateRejected: true }, null, 2));
} finally {
  const { error } = await owner.from("tenants").update(original).eq("id", tenant.id);
  if (error) throw new Error(`Unable to restore the original demo theme: ${error.message}`);
}
