import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

const demoEmails = {
  owner: "owner@commune.demo",
  admin: "admin@commune.demo",
  moderator: "moderator@commune.demo",
  member: "member@commune.demo",
  student: "student@commune.demo",
  corporate: "corporate@commune.demo",
  guest: "guest@commune.demo",
  superadmin: "superadmin@commune.demo",
} as const;

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string; demo?: string }> }) {
  const { next = "/", demo } = await searchParams;
  const initialEmail = demo && demo in demoEmails ? demoEmails[demo as keyof typeof demoEmails] : "";

  return <AuthShell eyebrow="Welcome back" title="Sign in to your workspace" description="Access every organization you belong to with one secure identity."><AuthForm mode="login" next={next} initialEmail={initialEmail} initialPassword={initialEmail ? "Demo123!" : ""}/></AuthShell>;
}
