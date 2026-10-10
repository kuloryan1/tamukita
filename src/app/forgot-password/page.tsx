import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-action-forms";

export const metadata: Metadata = { title: "Atur ulang kata sandi" };

export default function ForgotPasswordPage() {
  return <ForgotPasswordForm />;
}
