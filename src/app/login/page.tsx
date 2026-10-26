import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";
import { getSafePostLoginPath } from "@/lib/auth-redirect";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const callbackUrl = getSafePostLoginPath((await searchParams).callbackUrl);
  if ((await auth())?.user?.id) redirect(callbackUrl);
  return <LoginForm callbackUrl={callbackUrl} />;
}
