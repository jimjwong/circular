import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next = "/" } = await searchParams;
  return <AuthShell eyebrow="Start building" title="Create your Circular account" description="Your first organization can be ready in under a minute."><AuthForm mode="signup" next={next}/></AuthShell>;
}
