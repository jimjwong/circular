"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { requireOrganizationPermission, verifyUser } from "@/lib/auth/dal";
import { resolveEmailAudience } from "@/lib/email/audience";
import { createCampaign, createList, startCampaign, upsertSubscriber } from "@/lib/email/listmonk";
import { createClient } from "@/lib/supabase/server";

export type EmailActionState = { ok: boolean; message: string };

const broadcastSchema = z.object({
  subject: z.string().trim().min(3, "Add a subject of at least 3 characters.").max(200),
  previewText: z.string().trim().max(240).optional(),
  body: z.string().trim().min(10, "Write at least 10 characters for the email.").max(100000),
  senderName: z.string().trim().min(2).max(100),
  senderEmail: z.email("Enter a valid sender email."),
  replyTo: z.union([z.email(), z.literal("")]).optional(),
  audiences: z.array(z.string().max(100)).min(1, "Choose at least one audience."),
  intent: z.enum(["draft", "send"]),
});

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

function textToEmailHtml(text: string, previewText?: string) {
  const content = text.split(/\n{2,}/).map((paragraph) => `<p style="margin:0 0 16px;line-height:1.65">${escapeHtml(paragraph).replaceAll("\n", "<br>")}</p>`).join("");
  const preview = previewText ? `<span style="display:none!important;max-height:0;opacity:0;overflow:hidden">${escapeHtml(previewText)}</span>` : "";
  return `${preview}<div style="font-family:Arial,sans-serif;font-size:16px;color:#18251f">${content}</div>`;
}

async function deliverBroadcast(broadcastId: string, tenantId: string) {
  const supabase = await createClient();
  const [{ data: broadcast, error: broadcastError }, { data: recipients, error: recipientError }] = await Promise.all([
    supabase.from("email_broadcasts").select("id, subject, preview_text, body, sender_name, sender_email, reply_to, listmonk_list_id, listmonk_campaign_id").eq("id", broadcastId).eq("tenant_id", tenantId).single(),
    supabase.from("email_recipient_snapshots").select("email, display_name, membership_tier, role_slugs").eq("broadcast_id", broadcastId).eq("tenant_id", tenantId),
  ]);
  if (broadcastError || !broadcast) throw new Error("The saved broadcast could not be loaded.");
  if (recipientError || !recipients?.length) throw new Error("This broadcast has no recipients.");

  const body = broadcast.body as { text?: string; html?: string };
  const list = broadcast.listmonk_list_id
    ? { id: broadcast.listmonk_list_id }
    : await createList(`Commune · ${broadcast.subject} · ${broadcast.id.slice(0, 8)}`, tenantId);
  if (!broadcast.listmonk_list_id) await supabase.from("email_broadcasts").update({ listmonk_list_id: list.id, listmonk_status: "syncing", updated_at: new Date().toISOString() }).eq("id", broadcastId);

  for (const recipient of recipients) {
    await upsertSubscriber({
      email: recipient.email,
      name: recipient.display_name,
      listId: list.id,
      attributes: { commune_tenant_id: tenantId, membership_tier: recipient.membership_tier, role_slugs: recipient.role_slugs },
    });
  }

  const fromEmail = `"${(broadcast.sender_name || "Commune").replaceAll('"', "")}" <${broadcast.sender_email}>`;
  const campaign = broadcast.listmonk_campaign_id
    ? { id: broadcast.listmonk_campaign_id }
    : await createCampaign({
      name: `Commune · ${broadcast.subject}`,
      subject: broadcast.subject,
      listId: list.id,
      fromEmail,
      body: body.html || textToEmailHtml(body.text || "", broadcast.preview_text || undefined),
      altBody: body.text || "",
      replyTo: broadcast.reply_to,
    });
  if (!broadcast.listmonk_campaign_id) await supabase.from("email_broadcasts").update({ listmonk_campaign_id: campaign.id, listmonk_status: "created", updated_at: new Date().toISOString() }).eq("id", broadcastId);
  await startCampaign(campaign.id);
  const { error: updateError } = await supabase.from("email_broadcasts").update({ status: "published", listmonk_status: "running", sent_at: new Date().toISOString(), error_message: null, updated_at: new Date().toISOString() }).eq("id", broadcastId).eq("tenant_id", tenantId);
  if (updateError) throw new Error(updateError.message);
}

export async function createEmailBroadcast(_state: EmailActionState, formData: FormData): Promise<EmailActionState> {
  const parsed = broadcastSchema.safeParse({
    subject: formData.get("subject"),
    previewText: formData.get("previewText") || undefined,
    body: formData.get("body"),
    senderName: formData.get("senderName"),
    senderEmail: formData.get("senderEmail"),
    replyTo: formData.get("replyTo") || "",
    audiences: formData.getAll("audiences"),
    intent: formData.get("intent"),
  });
  if (!parsed.success) return { ok: false, message: parsed.error.issues[0]?.message || "Check the campaign details." };

  const [user, organization] = await Promise.all([verifyUser(), requireOrganizationPermission("communications.manage")]);
  try {
    const recipients = await resolveEmailAudience(organization.id, parsed.data.audiences);
    if (!recipients.length) return { ok: false, message: "No active members match this audience." };
    const supabase = await createClient();
    const html = textToEmailHtml(parsed.data.body, parsed.data.previewText);
    const { data: broadcast, error } = await supabase.from("email_broadcasts").insert({
      tenant_id: organization.id,
      created_by: user.id,
      subject: parsed.data.subject,
      preview_text: parsed.data.previewText || null,
      body: { text: parsed.data.body, html },
      audience_filter: { selections: parsed.data.audiences },
      status: "draft",
      sender_name: parsed.data.senderName,
      sender_email: parsed.data.senderEmail,
      reply_to: parsed.data.replyTo || null,
      recipient_count: recipients.length,
    }).select("id").single();
    if (error || !broadcast) throw new Error(error?.message || "Unable to save the broadcast.");
    const { error: snapshotError } = await supabase.from("email_recipient_snapshots").insert(recipients.map((recipient) => ({
      broadcast_id: broadcast.id,
      tenant_id: organization.id,
      user_id: recipient.userId,
      email: recipient.email,
      display_name: recipient.displayName,
      membership_tier: recipient.membershipTier,
      role_slugs: recipient.roleSlugs,
    })));
    if (snapshotError) throw new Error(snapshotError.message);
    if (parsed.data.intent === "send") await deliverBroadcast(broadcast.id, organization.id);
    revalidatePath("/email");
    return { ok: true, message: parsed.data.intent === "send" ? `Campaign queued for ${recipients.length} recipients.` : `Draft saved with ${recipients.length} recipients.` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "The campaign could not be saved." };
  }
}

export async function sendSavedBroadcast(formData: FormData) {
  const organization = await requireOrganizationPermission("communications.manage");
  const broadcastId = z.string().uuid().parse(formData.get("broadcastId"));
  try {
    await deliverBroadcast(broadcastId, organization.id);
  } catch (error) {
    const supabase = await createClient();
    await supabase.from("email_broadcasts").update({ listmonk_status: "error", error_message: error instanceof Error ? error.message : "Delivery failed.", updated_at: new Date().toISOString() }).eq("id", broadcastId).eq("tenant_id", organization.id);
    revalidatePath("/email");
    return;
  }
  revalidatePath("/email");
}
