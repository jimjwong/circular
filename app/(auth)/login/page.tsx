import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

const demoEmails = {
  owner: "owner@circular.demo",
  admin: "admin@circular.demo",
  moderator: "moderator@circular.demo",
  member: "member@circular.demo",
  student: "student@circular.demo",
  superadmin: "superadmin@circular.demo",
} as const;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; demo?: string }> }) {
  const { next = "/", demo } = await searchParams;
  const initialEmail = demo && demo in demoEmails ? demoEmails[demo as keyof typeof demoEmails] : "";

  return <AuthShell eyebrow="Welcome back" title="Sign in to your workspace" description="Access every organization you belong to with one secure identity."><AuthForm mode="login" next={next} initialEmail={initialEmail} initialPassword={initialEmail ? "Demo123!" : ""}/></AuthShell>;
}
