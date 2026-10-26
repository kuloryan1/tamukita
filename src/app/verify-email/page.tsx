import type { Metadata } from "next";
import { EmailVerificationForm } from "@/components/auth-action-forms";
import { getSafePostLoginPath } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "Konfirmasi email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; sent?: string; callbackUrl?: string }> }) {
  const params = await searchParams;
  return <EmailVerificationForm token={params.token} emailSent={params.sent === "1" ? true : params.sent === "0" ? false : undefined} callbackUrl={getSafePostLoginPath(params.callbackUrl)} />;
}
