"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, LoaderCircle, PlayCircle } from "lucide-react";
import { enrollInCourse } from "@/app/actions/courses";

export function EnrollmentButton({ courseId, firstItemHref, paid, label }: { courseId: string; firstItemHref: string | null; paid: boolean; label: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState("");
  return <div className="mt-7"><button type="button" disabled={pending} onClick={() => startTransition(async () => { try { setError(""); const result = await enrollInCourse(courseId, paid); if (!result.ok) return setError(result.error); if (firstItemHref) router.push(firstItemHref as never); else router.refresh(); } catch { setError("Unable to enroll right now. Please try again."); } })} className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-5 text-xs font-bold text-[#183f30] disabled:opacity-60">{pending ? <LoaderCircle size={15} className="animate-spin"/> : paid ? <CreditCard size={15}/> : <PlayCircle size={15}/>} {pending ? "Enrolling…" : label}</button>{error && <p role="alert" className="mt-2 text-xs text-[#ffd5ca]">{error}</p>}</div>;
}
