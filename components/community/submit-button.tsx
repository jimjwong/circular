"use client";

import { useFormStatus } from "react-dom";

export function SubmitButton({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className={`disabled:cursor-wait disabled:opacity-60 ${className}`}>{pending ? "Working…" : children}</button>;
}
