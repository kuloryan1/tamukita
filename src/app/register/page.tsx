import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/register-form";
import { getSafePostLoginPath } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "Buat akun" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const callbackUrl = getSafePostLoginPath((await searchParams).callbackUrl);
  if ((await auth())?.user?.id) redirect(callbackUrl);
  return <RegisterForm callbackUrl={callbackUrl} />;
}
