import type { Metadata } from "next";
import { ForgotPasswordForm } from "@/components/auth-action-forms";
import { getSafePostLoginPath } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "Atur ulang kata sandi" };

export default async function ForgotPasswordPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const callbackUrl = getSafePostLoginPath((await searchParams).callbackUrl);
  return <ForgotPasswordForm callbackUrl={callbackUrl} />;
}
