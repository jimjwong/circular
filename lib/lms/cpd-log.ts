import type { SupabaseClient } from "@supabase/supabase-js";

export async function getCpdLog(supabase: SupabaseClient, tenantId: string, userId: string, from?: string, to?: string) {
  let query = supabase.from("learning_hours_ledger").select("module_item_id, seconds_logged, logged_at").eq("tenant_id", tenantId).eq("user_id", userId).order("logged_at", { ascending: false });
  if (from) query = query.gte("logged_at", `${from}T00:00:00.000Z`);
  if (to) query = query.lt("logged_at", `${to}T23:59:59.999Z`);
  const { data: ledger, error } = await query;
  if (error) throw error;
  const itemIds = [...new Set((ledger ?? []).map((row) => row.module_item_id))];
  const { data: items } = itemIds.length ? await supabase.from("module_items").select("id, course_id, title").in("id", itemIds) : { data: [] };
  const courseIds = [...new Set((items ?? []).map((row) => row.course_id))];
  const { data: courses } = courseIds.length ? await supabase.from("courses").select("id, title").in("id", courseIds) : { data: [] };
  const itemMap = new Map((items ?? []).map((item) => [item.id, item]));
  const courseMap = new Map((courses ?? []).map((course) => [course.id, course.title]));
  return (ledger ?? []).map((row) => { const item = itemMap.get(row.module_item_id); return { date: row.logged_at.slice(0, 10), course: item ? courseMap.get(item.course_id) ?? "Course" : "Course", item: item?.title ?? "Learning activity", minutes: row.seconds_logged / 60 }; });
}
