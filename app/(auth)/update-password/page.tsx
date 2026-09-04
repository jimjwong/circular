import { AuthForm } from "@/components/auth/auth-form";
import { AuthShell } from "@/components/auth/auth-shell";

export default function UpdatePasswordPage() {
  return <AuthShell eyebrow="Secure your account" title="Choose a new password" description="Use a strong password you have not used elsewhere."><AuthForm mode="update"/></AuthShell>;
}
