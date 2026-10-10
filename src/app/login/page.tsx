import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { LoginForm } from "@/components/login-form";

export const metadata: Metadata = { title: "Masuk" };

export default async function LoginPage() {
  if ((await auth())?.user?.id) redirect("/dashboard");
  return <LoginForm />;
}
