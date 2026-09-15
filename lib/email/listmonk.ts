import "server-only";

type ListmonkEnvelope<T> = { data: T };

export type ListmonkList = { id: number; name: string };
export type ListmonkCampaign = { id: number; name: string; status: string };
export type ListmonkSubscriber = { id: number; email: string; name: string; lists?: { id: number }[] };

function config() {
  const url = process.env.LISTMONK_URL?.replace(/\/$/, "");
  const user = process.env.LISTMONK_API_USER;
  const token = process.env.LISTMONK_API_TOKEN;
  if (!url || !user || !token) throw new Error("The local email service is not configured.");
  return { url, authorization: `Basic ${Buffer.from(`${user}:${token}`).toString("base64")}` };
}

async function request<T>(path: string, init?: RequestInit) {
  const { url, authorization } = config();
  const response = await fetch(`${url}${path}`, {
    ...init,
    cache: "no-store",
    headers: { Authorization: authorization, "Content-Type": "application/json", ...init?.headers },
  });
  const payload = await response.json().catch(() => null) as { message?: string } | ListmonkEnvelope<T> | null;
  if (!response.ok) throw new Error(payload && "message" in payload && payload.message ? payload.message : `Email service request failed (${response.status}).`);
  return (payload as ListmonkEnvelope<T>).data;
}

export async function checkListmonk() {
  await request<{ results: ListmonkList[] }>("/api/lists?per_page=1");
  return true;
}

export function createList(name: string, tenantId: string) {
  return request<ListmonkList>("/api/lists", {
    method: "POST",
    body: JSON.stringify({ name, type: "private", optin: "single", tags: ["commune", `tenant:${tenantId}`], description: "Commune campaign audience snapshot" }),
  });
}

async function findSubscriber(email: string) {
  const query = encodeURIComponent(`email = '${email.replaceAll("'", "''")}'`);
  const data = await request<{ results: ListmonkSubscriber[] }>(`/api/subscribers?query=${query}&per_page=1`);
  return data.results.find((subscriber) => subscriber.email.toLowerCase() === email.toLowerCase()) ?? null;
}

export async function upsertSubscriber(input: { email: string; name: string; listId: number; attributes: Record<string, unknown> }) {
  const existing = await findSubscriber(input.email);
  const listIds = existing ? [...new Set([...(existing.lists ?? []).map((list) => list.id), input.listId])] : [input.listId];
  const body = JSON.stringify({
    email: input.email,
    name: input.name,
    status: "enabled",
    lists: listIds,
    attribs: input.attributes,
    preconfirm_subscriptions: true,
  });
  if (!existing) return request<ListmonkSubscriber>("/api/subscribers", { method: "POST", body });
  return request<ListmonkSubscriber>(`/api/subscribers/${existing.id}`, { method: "PUT", body });
}

export function createCampaign(input: {
  name: string;
  subject: string;
  listId: number;
  fromEmail: string;
  body: string;
  altBody: string;
  replyTo?: string | null;
}) {
  return request<ListmonkCampaign>("/api/campaigns", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      subject: input.subject,
      lists: [input.listId],
      from_email: input.fromEmail,
      type: "regular",
      content_type: "html",
      body: input.body,
      altbody: input.altBody,
      messenger: "email",
      template_id: 1,
      headers: input.replyTo ? [{ "Reply-To": input.replyTo }] : [],
    }),
  });
}

export function startCampaign(campaignId: number) {
  return request<ListmonkCampaign>(`/api/campaigns/${campaignId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status: "running" }),
  });
}
