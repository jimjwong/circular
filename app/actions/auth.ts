"use server";

import { redirect } from "next/navigation";
import type { Route } from "next";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import type { AuthState } from "@/lib/auth/types";

const emailSchema = z.string().trim().toLowerCase().email("Enter a valid email address.");
const passwordSchema = z
  .string()
  .min(8, "Use at least 8 characters.")
  .regex(/[A-Z]/, "Include an uppercase letter.")
  .regex(/[a-z]/, "Include a lowercase letter.")
  .regex(/[0-9]/, "Include a number.");

const credentialsSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
});

const signupSchema = z.object({
  name: z.string().trim().min(2, "Enter your name."),
  email: emailSchema,
  password: passwordSchema,
});

function safeNext(value: FormDataEntryValue | null, fallback = "/") {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//")
    ? value
    : fallback;
}

function fieldErrors(error: z.ZodError): AuthState {
  return { errors: error.flatten().fieldErrors as Record<string, string[]> };
}

export async function signIn(_: AuthState | undefined, formData: FormData): Promise<AuthState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { message: "The email or password is incorrect." };
  redirect(safeNext(formData.get("next")) as Route);
}

export async function signUp(_: AuthState | undefined, formData: FormData): Promise<AuthState> {
  const parsed = signupSchema.safeParse({
    name: formData.get("name"),
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return fieldErrors(parsed.error);

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const next = safeNext(formData.get("next"), "/onboarding");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { full_name: parsed.data.name },
      emailRedirectTo: `${siteUrl}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });

  if (error) return { message: error.message };
  if (data.session) redirect(next as Route);

  return { success: "Check your email to confirm your account." };
}

export async function requestPasswordReset(
  _: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { errors: { email: parsed.error.issues.map((issue) => issue.message) } };

  const supabase = await createClient();
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
    redirectTo: `${siteUrl}/auth/callback?next=/update-password`,
  });

  if (error) return { message: error.message };
  return { success: "If an account exists, a recovery link is on its way." };
}

export async function updatePassword(
  _: AuthState | undefined,
  formData: FormData,
): Promise<AuthState> {
  const parsed = passwordSchema.safeParse(formData.get("password"));
  if (!parsed.success) {
    return { errors: { password: parsed.error.issues.map((issue) => issue.message) } };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: parsed.data });
  if (error) return { message: error.message };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
