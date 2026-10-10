import type { Metadata } from "next";
import { EmailVerificationForm } from "@/components/auth-action-forms";

export const metadata: Metadata = { title: "Konfirmasi email" };

export default async function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string; sent?: string }> }) {
  const params = await searchParams;
  return <EmailVerificationForm token={params.token} emailSent={params.sent === "1" ? true : params.sent === "0" ? false : undefined} />;
}
