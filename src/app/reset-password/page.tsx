import type { Metadata } from "next";
import { ResetPasswordForm } from "@/components/auth-action-forms";
import { getSafePostLoginPath } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "Kata sandi baru" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string; callbackUrl?: string }> }) {
  const params = await searchParams;
  return <ResetPasswordForm token={params.token} callbackUrl={getSafePostLoginPath(params.callbackUrl)} />;
}
