import { createClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;

if (!url || !secret) throw new Error("Run with: node --env-file=.env.local scripts/seed-local.mjs");

const supabase = createClient(url, secret, {
  auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
});

const email = "owner@circular.local";
const password = "Circular123!";
const { data: listed, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });
if (listError) throw listError;

let user = listed.users.find((candidate) => candidate.email === email);
if (!user) {
  const { data, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: "Circular Platform Owner" },
  });
  if (error) throw error;
  user = data.user;
}

const { error: staffError } = await supabase.from("platform_staff").upsert({
  user_id: user.id,
  role: "super_admin",
  is_active: true,
});
if (staffError) throw staffError;

console.log(`Local platform owner ready: ${email}`);
