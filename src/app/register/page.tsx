import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/register-form";

export const metadata: Metadata = { title: "Buat akun" };

export default async function RegisterPage() {
  if ((await auth())?.user?.id) redirect("/dashboard");
  return <RegisterForm />;
}
