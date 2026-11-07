import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { RegisterForm } from "@/components/register-form";
import { getSafePostLoginPath } from "@/lib/auth-redirect";
import { isCustomerRegistrationOpen } from "@/lib/registration-policy";

export const metadata: Metadata = { title: "Buat akun" };

export default async function RegisterPage({ searchParams }: { searchParams: Promise<{ callbackUrl?: string }> }) {
  const callbackUrl = getSafePostLoginPath((await searchParams).callbackUrl);
  if ((await auth())?.user?.id) redirect(callbackUrl);
  if (!isCustomerRegistrationOpen(process.env.NEXT_PUBLIC_APP_URL)) {
    return <main className="auth-page"><div className="auth-form-side"><div className="auth-form-wrap">
      <span className="eyebrow">PENDAFTARAN BELUM DIBUKA</span>
      <h1>Buat akun<br /><em>TamuKita.</em></h1>
      <p className="auth-lead">Pendaftaran akun baru sedang ditutup. Jika sudah memiliki akun, silakan masuk untuk melanjutkan.</p>
      <a className="button button--dark button--wide" href={`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`}>Masuk ke akun</a>
      <a className="auth-text-button" href="/">Kembali ke beranda</a>
    </div></div></main>;
  }
  return <RegisterForm callbackUrl={callbackUrl} />;
}
