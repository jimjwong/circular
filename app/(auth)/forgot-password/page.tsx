import Link from "next/link";
import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function ForgotPasswordPage() {
  return <AuthShell eyebrow="Account recovery" title="Reset your password" description="We’ll send a secure recovery link to your email address."><AuthForm mode="forgot"/><Link href="/login" className="mt-5 block text-center text-xs font-semibold text-[#277153] hover:underline">Back to sign in</Link></AuthShell>;
}
