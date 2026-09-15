import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const secret = process.env.SUPABASE_SECRET_KEY;
const listmonkUrl = process.env.LISTMONK_URL;
const apiUser = process.env.LISTMONK_API_USER;
const apiToken = process.env.LISTMONK_API_TOKEN;
if (!supabaseUrl || !secret || !listmonkUrl || !apiUser || !apiToken) throw new Error("Email verification environment is incomplete.");

const auth = Buffer.from(`${apiUser}:${apiToken}`).toString("base64");
const response = await fetch(`${listmonkUrl}/api/lists?per_page=1`, { headers: { Authorization: `Basic ${auth}` } });
if (!response.ok) throw new Error(`listmonk API verification failed (${response.status}).`);

const supabase = createClient(supabaseUrl, secret, { auth: { persistSession: false, autoRefreshToken: false } });
const [{ error: broadcastError }, { error: snapshotError }, { data: permissions, error: permissionError }] = await Promise.all([
  supabase.from("email_broadcasts").select("id, listmonk_campaign_id, recipient_count").limit(1),
  supabase.from("email_recipient_snapshots").select("broadcast_id, email").limit(1),
  supabase.from("access_permissions").select("key").eq("key", "communications.manage"),
]);
if (broadcastError) throw broadcastError;
if (snapshotError) throw snapshotError;
if (permissionError || !permissions?.length) throw permissionError || new Error("Email permission is missing.");

console.log(JSON.stringify({ listmonk: "online", database: "ready", permission: "communications.manage" }, null, 2));

