"use client";

import { Paperclip, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { registerCommunityAttachment } from "@/app/actions/community";
import { createClient } from "@/lib/supabase/client";

const allowed = ["image/jpeg", "image/png", "image/webp", "image/gif", "video/mp4", "application/pdf"];

export function MediaUploader({ tenantId, userId, postId }: { tenantId: string; userId: string; postId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [status, setStatus] = useState("");
  const [pending, setPending] = useState(false);

  async function upload(file: File) {
    if (!allowed.includes(file.type) || file.size > 10 * 1024 * 1024) {
      setStatus("Use an image, MP4, or PDF up to 10 MB.");
      return;
    }
    setPending(true); setStatus("Uploading…");
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]+/g, "-").slice(-120);
    const path = `${tenantId}/${userId}/${crypto.randomUUID()}-${safeName}`;
    const supabase = createClient();
    const { error } = await supabase.storage.from("community-media").upload(path, file, { contentType: file.type, upsert: false });
    if (error) { setStatus(error.message); setPending(false); return; }
    const formData = new FormData();
    formData.set("postId", postId); formData.set("storagePath", path); formData.set("fileName", file.name);
    formData.set("contentType", file.type); formData.set("sizeBytes", String(file.size));
    try { await registerCommunityAttachment(formData); setStatus("Attachment added."); }
    catch (uploadError) { await supabase.storage.from("community-media").remove([path]); setStatus(uploadError instanceof Error ? uploadError.message : "Attachment could not be saved."); }
    finally { setPending(false); if (inputRef.current) inputRef.current.value = ""; }
  }

  return <div className="flex flex-wrap items-center gap-2"><input ref={inputRef} type="file" className="hidden" accept={allowed.join(",")} onChange={(event) => { const file = event.target.files?.[0]; if (file) void upload(file); }}/><button type="button" disabled={pending} onClick={() => inputRef.current?.click()} className="inline-flex h-8 items-center gap-1.5 rounded-lg bg-[#f0f4f1] px-3 text-[10px] font-semibold text-[#557064] disabled:opacity-50">{pending ? <Upload size={12}/> : <Paperclip size={12}/>} Attach media</button>{status && <span className="text-[10px] text-[#74827a]">{status}</span>}</div>;
}
