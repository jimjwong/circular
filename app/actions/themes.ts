"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganizationRole } from "@/lib/auth/dal";
import { createClient } from "@/lib/supabase/server";

const presetIds = ["forest", "ocean", "sunset", "violet", "rose", "slate", "apss", "custom"] as const;
const fontIds = ["inter", "manrope", "system", "editorial"] as const;
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i, "Choose a valid six-digit color.");
const themeSchema = z.object({
  preset: z.enum(presetIds),
  primary: hexColor,
  primaryHover: hexColor,
  accent: hexColor,
  background: hexColor,
  surface: hexColor,
  text: hexColor,
  muted: hexColor,
  border: hexColor,
  headingFont: z.enum(fontIds),
  bodyFont: z.enum(fontIds),
});

export type ThemeActionState = { message?: string; success?: string; errors?: Record<string, string[]> };

export async function updateWorkspaceTheme(_: ThemeActionState | undefined, formData: FormData): Promise<ThemeActionState> {
  const organization = await requireOrganizationRole(["owner", "admin"]);
  const parsed = themeSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { errors: parsed.error.flatten().fieldErrors as Record<string, string[]> };

  const { preset, ...themeConfig } = parsed.data;
  const supabase = await createClient();
  const { error } = await supabase
    .from("tenants")
    .update({ theme_preset: preset, theme_config: themeConfig })
    .eq("id", organization.id);

  if (error) return { message: error.message };
  revalidatePath("/", "layout");
  return { success: "Workspace theme saved. Every member will see it on their next page load." };
}
