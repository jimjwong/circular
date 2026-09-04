"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowRight, CheckCircle2, LoaderCircle } from "lucide-react";
import type { AuthState } from "@/lib/auth/types";
import { requestPasswordReset, signIn, signUp, updatePassword } from "@/app/actions/auth";

type Mode = "login" | "signup" | "forgot" | "update";

const actions = { login: signIn, signup: signUp, forgot: requestPasswordReset, update: updatePassword };
const demoAccounts = [
  ["owner", "Owner", "owner@circular.demo"],
  ["admin", "Admin", "admin@circular.demo"],
  ["moderator", "Moderator", "moderator@circular.demo"],
  ["member", "Member", "member@circular.demo"],
  ["student", "Student", "student@circular.demo"],
  ["superadmin", "Super admin", "superadmin@circular.demo"],
] as const;

export function AuthForm({ mode, next = "/", initialEmail = "", initialPassword = "" }: { mode: Mode; next?: string; initialEmail?: string; initialPassword?: string }) {
  const [state, action, pending] = useActionState<AuthState | undefined, FormData>(actions[mode], undefined);
  const isLogin = mode === "login";
  const isSignup = mode === "signup";
  const isForgot = mode === "forgot";

  return (
    <form action={action} className="mt-7 space-y-4">
      <input type="hidden" name="next" value={next} />
      {isLogin && <div className="rounded-2xl border border-[#dce5df] bg-[#f7faf8] p-3"><p className="text-[10px] font-bold uppercase tracking-[.12em] text-[#517061]">Local demo accounts</p><div className="mt-2 grid grid-cols-2 gap-2">{demoAccounts.map(([key, label, accountEmail])=><a href={`/login?demo=${key}${next !== "/" ? `&next=${encodeURIComponent(next)}` : ""}`} key={accountEmail} className={`rounded-lg border px-2 py-2 text-left text-[10px] font-semibold transition ${initialEmail===accountEmail?"border-[#4d8a6d] bg-[#e6f2eb] text-[#225f45]":"border-[#e0e7e2] bg-white text-[#607168] hover:border-[#a9c8b8]"}`}>{label}</a>)}</div><p className="mt-2 text-[9px] text-[#809087]">Select a role to fill its local credentials.</p></div>}
      {isSignup && <Field label="Full name" name="name" placeholder="Jamie Chen" error={state?.errors?.name?.[0]} />}
      {mode !== "update" && (
        <Field label="Work email" name="email" type="email" placeholder="you@company.com" error={state?.errors?.email?.[0]} defaultValue={isLogin ? initialEmail : undefined}/>
      )}
      {!isForgot && (
        <Field
          label={mode === "update" ? "New password" : "Password"}
          name="password"
          type="password"
          placeholder="At least 8 characters"
          error={state?.errors?.password?.[0]}
          defaultValue={isLogin ? initialPassword : undefined}
        />
      )}
      {isLogin && <div className="flex justify-end"><Link href="/forgot-password" className="text-xs font-semibold text-[#277153] hover:underline">Forgot password?</Link></div>}
      {state?.message && <p role="alert" className="rounded-xl bg-[#fff1ed] px-3 py-2.5 text-xs leading-5 text-[#a94f37]">{state.message}</p>}
      {state?.success && <p role="status" className="flex gap-2 rounded-xl bg-[#eaf5ef] px-3 py-2.5 text-xs leading-5 text-[#246b4e]"><CheckCircle2 className="mt-0.5 shrink-0" size={14}/>{state.success}</p>}
      <button disabled={pending} className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[#183f30] text-sm font-bold text-white shadow-[0_8px_20px_rgba(24,63,48,.18)] transition hover:bg-[#245841] disabled:cursor-not-allowed disabled:opacity-60">
        {pending ? <LoaderCircle className="animate-spin" size={16}/> : <>{isLogin ? "Sign in" : isSignup ? "Create account" : isForgot ? "Send recovery link" : "Update password"}<ArrowRight size={15}/></>}
      </button>
      {(isLogin || isSignup) && <p className="pt-1 text-center text-xs text-[#748279]">{isLogin ? "New to Circular?" : "Already have an account?"} <Link className="font-bold text-[#286f53] hover:underline" href={{ pathname: isLogin ? "/signup" : "/login", query: next !== "/" ? { next } : undefined }}>{isLogin ? "Create an account" : "Sign in"}</Link></p>}
    </form>
  );
}

function Field({ label, name, type = "text", placeholder, error, defaultValue }: { label: string; name: string; type?: string; placeholder: string; error?: string; defaultValue?: string }) {
  return <label className="block"><span className="mb-2 block text-xs font-semibold text-[#41564a]">{label}</span><input required name={name} type={type} placeholder={placeholder} defaultValue={defaultValue} aria-invalid={Boolean(error)} className="h-11 w-full rounded-xl border border-[#dbe3de] bg-white px-3 text-sm outline-none transition placeholder:text-[#a5aea9] focus:border-[#72a88f] focus:ring-2 focus:ring-[#dceee5] aria-[invalid=true]:border-[#d98b76]"/>{error&&<span className="mt-1.5 block text-[11px] text-[#af553f]">{error}</span>}</label>;
}
