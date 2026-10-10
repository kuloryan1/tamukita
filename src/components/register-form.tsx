"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Heart, LockKeyhole } from "lucide-react";

export function RegisterForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setPending(true);
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        name: String(form.get("name") ?? "").trim(),
        email: String(form.get("email") ?? "").trim().toLowerCase(),
        password: String(form.get("password") ?? ""),
      }),
    }).catch(() => null);
    if (!response) {
      setError("Pendaftaran belum dapat dihubungkan. Coba lagi setelah koneksi pulih.");
      setPending(false);
      return;
    }
    const result = await response.json().catch(() => ({})) as { error?: string; emailSent?: boolean };
    if (!response.ok) {
      setError(result.error ?? "Pendaftaran gagal. Silakan coba lagi.");
      setPending(false);
      return;
    }

    setPending(false);
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    window.sessionStorage.setItem("tamukita-pending-verification-email", email);
    router.replace(`/verify-email?sent=${result.emailSent ? "1" : "0"}`);
  }

  return (
    <main className="auth-page">
      <div className="auth-side-story"><Link href="/" className="brand auth-brand"><span className="brand-mark"><Heart size={16} /></span><span className="brand-word">tamu<span>kita</span></span></Link><div className="auth-story-copy"><span className="eyebrow eyebrow--light">CERITA INDAH DIMULAI DI SINI</span><h1>Satu hari istimewa,<br />banyak cerita <em>untuk dibagi.</em></h1><p>Undangan digital yang personal, hangat, dan mudah kamu buat sendiri.</p><div className="auth-story-quote"><span>“</span><p>Rasanya seperti membuat undangan bersama teman yang mengerti seleraku.</p><small>— Nara Aulia, pengguna TamuKita</small></div></div><span className="auth-story-footer">© 2026 TamuKita · Sebuah cerita dari Tigakaki</span><span className="auth-side-flower">✳</span></div>
      <div className="auth-form-side"><div className="auth-mobile-brand"><Link href="/" className="brand"><span className="brand-mark"><Heart size={16} /></span><span className="brand-word">tamu<span>kita</span></span></Link></div><div className="auth-form-wrap"><div className="auth-back-row"><Link href="/" className="back-link">← Beranda</Link><span>Sudah punya akun? <Link href="/login">Masuk</Link></span></div><span className="eyebrow">RUANG BAHAGIAMU MENUNGGU</span><h2>Buat akun<br /><em>TamuKita.</em></h2><p className="auth-lead">Simpan undanganmu dan lanjutkan kapan pun kamu siap.</p><form className="auth-form" onSubmit={handleSubmit}><label className="editor-field"><span className="field-label">Nama lengkap</span><input className="text-input" name="name" required minLength={2} maxLength={80} autoComplete="name" placeholder="Nama kamu" /></label><label className="editor-field"><span className="field-label">Alamat email</span><input className="text-input" name="email" type="email" required maxLength={254} autoComplete="email" placeholder="nama@email.com" /></label><label className="editor-field"><span className="field-label">Kata sandi</span><div className="input-with-icon"><LockKeyhole size={16} /><input className="text-input" name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" placeholder="Minimal 12 karakter" /></div></label><div className="auth-terms">Dokumen privasi dan ketentuan penggunaan sedang disiapkan sebelum layanan dibuka untuk umum.</div>{error && <div className="editor-error" role="alert">{error}</div>}<button className="button button--dark button--wide" type="submit" disabled={pending}>{pending ? "Membuat akun..." : "Buat akun"} <ArrowRight size={15} /></button><div className="auth-secure-note"><LockKeyhole size={13} /> Kata sandi disimpan sebagai hash kriptografis.</div></form></div></div>
    </main>
  );
}
