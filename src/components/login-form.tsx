"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { ArrowRight, Heart, LockKeyhole } from "lucide-react";
import { withPostLoginCallback } from "@/lib/auth-redirect";

export function LoginForm({ callbackUrl }: { callbackUrl: string }) {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const result = await signIn("credentials", {
      email: String(form.get("email") ?? "").trim().toLowerCase(),
      password: String(form.get("password") ?? ""),
      redirect: false,
    }).catch(() => null);
    setPending(false);
    if (!result || result.error) {
      setError("Email atau kata sandi tidak cocok, akun sedang dikunci, atau akun belum menyetujui batas usia 18+. Jika akun lama belum mencatat persetujuan ini, gunakan Lupa kata sandi untuk menyetujuinya saat memperbarui kata sandi.");
      return;
    }
    router.replace(callbackUrl);
    router.refresh();
  }

  return (
    <main className="auth-page">
      <div className="auth-side-story"><Link href="/" className="brand auth-brand"><span className="brand-mark"><Heart size={16} /></span><span className="brand-word">tamu<span>kita</span></span></Link><div className="auth-story-copy"><span className="eyebrow eyebrow--light">CERITA INDAH DIMULAI DI SINI</span><h1>Semua momenmu,<br />tersimpan <em>dekat.</em></h1><p>Lanjutkan persiapan hari bahagiamu bersama TamuKita.</p><div className="auth-story-quote"><span>“</span><p>Undangan digital yang terasa personal dan mudah dibagikan kepada semua orang tersayang.</p><small>Ruang bahagiamu · TamuKita</small></div></div><span className="auth-story-footer">© 2026 TamuKita · Sebuah cerita dari Tigakaki</span><span className="auth-side-flower">✳</span></div>
      <div className="auth-form-side"><div className="auth-mobile-brand"><Link href="/" className="brand"><span className="brand-mark"><Heart size={16} /></span><span className="brand-word">tamu<span>kita</span></span></Link></div><div className="auth-form-wrap"><div className="auth-back-row"><Link href="/" className="back-link">← Beranda</Link><span>Belum punya akun? <Link href={withPostLoginCallback("/register", callbackUrl)}>Daftar</Link></span></div><span className="eyebrow">SENANG MELIHATMU KEMBALI</span><h2>Masuk ke<br /><em>TamuKita.</em></h2><p className="auth-lead">Lanjutkan cerita yang sedang kamu siapkan.</p><form className="auth-form" onSubmit={handleSubmit}><label className="editor-field"><span className="field-label">Alamat email</span><input className="text-input" name="email" type="email" required autoComplete="email" placeholder="nama@email.com" /></label><label className="editor-field"><span className="field-label">Kata sandi</span><div className="input-with-icon"><LockKeyhole size={16} /><input className="text-input" name="password" type="password" required autoComplete="current-password" placeholder="Kata sandi akunmu" /></div></label>{error && <div className="editor-error" role="alert">{error}</div>}<div className="login-forgot-row"><span>5 kali gagal masuk akan mengunci akun selama 15 menit.</span><Link href={withPostLoginCallback("/forgot-password", callbackUrl)}>Lupa kata sandi?</Link></div><button className="button button--dark button--wide" type="submit" disabled={pending}>{pending ? "Memeriksa akun..." : "Masuk"} <ArrowRight size={15} /></button><Link className="auth-text-button" href={withPostLoginCallback("/verify-email", callbackUrl)}>Belum menerima email verifikasi?</Link><div className="auth-secure-note"><LockKeyhole size={13} /> Email harus dikonfirmasi sebelum bisa masuk.</div></form></div></div>
    </main>
  );
}
