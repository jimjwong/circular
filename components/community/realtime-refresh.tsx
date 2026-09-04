"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export function RealtimeRefresh({ tenantId }: { tenantId: string }) {
  const router = useRouter();
  useEffect(() => {
    const supabase = createClient();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = () => { clearTimeout(timer); timer = setTimeout(() => router.refresh(), 250); };
    const channel = supabase.channel(`community:${tenantId}`);
    for (const table of ["posts", "comments", "reactions", "post_attachments", "notifications"]) {
      channel.on("postgres_changes", { event: "*", schema: "public", table, filter: `tenant_id=eq.${tenantId}` }, refresh);
    }
    channel.subscribe();
    return () => { clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [router, tenantId]);
  return null;
}
