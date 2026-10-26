"use client";

import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, Heart, LockKeyhole } from "lucide-react";
import { withPostLoginCallback } from "@/lib/auth-redirect";

function AuthFrame({ eyebrow, title, lead, children, loginHref = "/login" }: { eyebrow: string; title: ReactNode; lead: string; children: ReactNode; loginHref?: string }) {
  return <main className="auth-page"><div className="auth-side-story"><Link href="/" className="brand auth-brand"><span className="brand-mark"><Heart size={16} /></span><span className="brand-word">tamu<span>kita</span></span></Link><div className="auth-story-copy"><span className="eyebrow eyebrow--light">CERITA INDAH DIMULAI DI SINI</span><h1>Satu hari istimewa,<br />banyak cerita <em>untuk dibagi.</em></h1><p>Undangan digital yang personal, hangat, dan mudah kamu buat sendiri.</p><div className="auth-story-quote"><span>“</span><p>Ruang bahagiamu tetap aman dengan akun yang terlindungi.</p><small>TamuKita · Sebuah cerita dari Tigakaki</small></div></div><span className="auth-story-footer">© 2026 TamuKita · Sebuah cerita dari Tigakaki</span><span className="auth-side-flower">✳</span></div><div className="auth-form-side"><div className="auth-mobile-brand"><Link href="/" className="brand"><span className="brand-mark"><Heart size={16} /></span><span className="brand-word">tamu<span>kita</span></span></Link></div><div className="auth-form-wrap"><div className="auth-back-row"><Link href="/" className="back-link">← Beranda</Link><span>Kembali ke <Link href={loginHref}>Masuk</Link></span></div><span className="eyebrow">{eyebrow}</span><h2>{title}</h2><p className="auth-lead">{lead}</p>{children}</div></div></main>;
}

export function EmailVerificationForm({ token: initialToken, emailSent, callbackUrl = "/dashboard" }: { token?: string; emailSent?: boolean; callbackUrl?: string }) {
  const [token] = useState(initialToken ?? "");
  const [email, setEmail] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState(emailSent === undefined ? "" : emailSent ? "Tautan verifikasi sudah dikirim. Periksa kotak masuk atau folder spam." : "Akun sudah dibuat, tetapi email belum dapat dikirim. Periksa konfigurasi pengiriman email atau kirim ulang tautannya.");
  const [verified, setVerified] = useState(false);
  const [showResend, setShowResend] = useState(!initialToken);

  useEffect(() => {
    setEmail(window.sessionStorage.getItem("tamukita-pending-verification-email") ?? "");
  }, []);

  async function confirmEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const response = await fetch("/api/auth/verify-email/confirm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; verified?: boolean } | null;
    setPending(false);
    if (!response?.ok || !result?.verified) { setError(result?.error ?? "Verifikasi belum dapat diselesaikan. Coba lagi."); setShowResend(true); return; }
    window.sessionStorage.removeItem("tamukita-pending-verification-email");
    setVerified(true);
  }

  async function resendEmail(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError(""); setNotice("");
    const response = await fetch("/api/auth/verify-email/resend", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase(), callbackUrl }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setPending(false);
    if (!response?.ok) { setError(result?.error ?? "Permintaan belum dapat diproses. Periksa koneksi dan coba lagi."); return; }
    setNotice("Jika akun tersebut belum diverifikasi, tautan konfirmasi akan dikirim ke email itu.");
  }

  return <AuthFrame eyebrow="KONFIRMASI AKUN" title={verified ? <>Email sudah<br /><em>terkonfirmasi.</em></> : <>Satu langkah<br /><em>lagi.</em></>} lead={verified ? "Sekarang kamu bisa masuk dan melanjutkan undanganmu." : "Konfirmasi alamat email untuk mengaktifkan akses ke akun TamuKita."} loginHref={withPostLoginCallback("/login", callbackUrl)}>
    {verified ? <div className="auth-action-result"><div className="auth-success" role="status">Alamat email berhasil dikonfirmasi.</div><Link className="button button--dark button--wide" href={withPostLoginCallback("/login", callbackUrl)}>Masuk ke akun <ArrowRight size={15} /></Link></div> : <div className="auth-form">{token && !showResend && <form className="auth-form" onSubmit={confirmEmail}><button className="button button--dark button--wide" type="submit" disabled={pending}>{pending ? "Memverifikasi..." : "Konfirmasi email"} <ArrowRight size={15} /></button></form>}{showResend && <form className="auth-form" onSubmit={resendEmail}><label className="editor-field"><span className="field-label">Alamat email akun</span><input className="text-input" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" /></label>{error && <div className="editor-error" role="alert">{error}</div>}{notice && <div className="auth-success" role="status">{notice}</div>}<button className="button button--dark button--wide" type="submit" disabled={pending}>{pending ? "Mengirim..." : "Kirim ulang tautan"} <ArrowRight size={15} /></button></form>}{error && !showResend && <div className="editor-error" role="alert">{error}</div>}{!showResend && <button className="auth-text-button" type="button" onClick={() => setShowResend(true)}>Tautan tidak bekerja? Kirim ulang</button>}<div className="auth-secure-note"><LockKeyhole size={13} /> Tautan verifikasi berlaku selama 24 jam dan hanya dapat dipakai sekali.</div></div>}
  </AuthFrame>;
}

export function ForgotPasswordForm({ callbackUrl = "/dashboard" }: { callbackUrl?: string }) {
  const [pending, setPending] = useState(false);
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const response = await fetch("/api/auth/password/forgot", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: email.trim().toLowerCase(), callbackUrl }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setPending(false);
    if (!response?.ok) { setError(result?.error ?? "Permintaan belum dapat diproses. Coba lagi."); return; }
    setSent(true);
  }

  return <AuthFrame eyebrow="PEMULIHAN AKUN" title={<>Atur ulang<br /><em>kata sandi.</em></>} lead="Kami akan mengirim tautan pemulihan jika email tersebut terdaftar di TamuKita." loginHref={withPostLoginCallback("/login", callbackUrl)}>
    <form className="auth-form" onSubmit={submit}><label className="editor-field"><span className="field-label">Alamat email</span><input className="text-input" type="email" required maxLength={254} autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} placeholder="nama@email.com" /></label>{error && <div className="editor-error" role="alert">{error}</div>}{sent && <div className="auth-success" role="status">Jika email itu terdaftar, tautan pemulihan akan dikirim. Periksa juga folder spam.</div>}<button className="button button--dark button--wide" type="submit" disabled={pending}>{pending ? "Memproses..." : "Kirim tautan pemulihan"} <ArrowRight size={15} /></button><div className="auth-secure-note"><LockKeyhole size={13} /> Tautan berlaku selama 24 jam dan hanya dapat digunakan sekali.</div></form>
  </AuthFrame>;
}

export function ResetPasswordForm({ token, callbackUrl = "/dashboard" }: { token?: string; callbackUrl?: string }) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [reset, setReset] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setPending(true); setError("");
    const form = new FormData(event.currentTarget);
    const password = String(form.get("password") ?? "");
    const confirmation = String(form.get("confirmation") ?? "");
    if (password !== confirmation) { setPending(false); setError("Kata sandi dan konfirmasi harus sama."); return; }
    const response = await fetch("/api/auth/password/reset", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ token, password, adultAttested: form.get("adultAttested") === "on" }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; reset?: boolean } | null;
    setPending(false);
    if (!response?.ok || !result?.reset) { setError(result?.error ?? "Kata sandi belum dapat diubah. Periksa tautan dan coba lagi."); return; }
    setReset(true);
  }

  return <AuthFrame eyebrow="KATA SANDI BARU" title={reset ? <>Akunmu kembali<br /><em>terlindungi.</em></> : <>Buat kata sandi<br /><em>baru.</em></>} lead={reset ? "Kata sandi berhasil diperbarui. Masuk kembali dengan kata sandi barumu." : "Pilih kata sandi minimal 12 karakter untuk akunmu."} loginHref={withPostLoginCallback("/login", callbackUrl)}>
    {reset ? <div className="auth-action-result"><div className="auth-success" role="status">Kata sandi berhasil diubah. Sesi lama sudah dicabut.</div><Link className="button button--dark button--wide" href={withPostLoginCallback("/login", callbackUrl)}>Masuk ke akun <ArrowRight size={15} /></Link></div> : token ? <form className="auth-form" onSubmit={submit}><label className="editor-field"><span className="field-label">Kata sandi baru</span><div className="input-with-icon"><LockKeyhole size={16} /><input className="text-input" name="password" type="password" required minLength={12} maxLength={128} autoComplete="new-password" placeholder="Minimal 12 karakter" /></div></label><label className="editor-field"><span className="field-label">Ulangi kata sandi</span><div className="input-with-icon"><LockKeyhole size={16} /><input className="text-input" name="confirmation" type="password" required minLength={12} maxLength={128} autoComplete="new-password" placeholder="Ketik ulang kata sandi" /></div></label><label className="auth-check-row"><input type="checkbox" name="adultAttested" required /><span>Saya menyatakan berusia 18 tahun ke atas dan membuat akun ini untuk digunakan sendiri.</span></label>{error && <div className="editor-error" role="alert">{error}</div>}<button className="button button--dark button--wide" type="submit" disabled={pending}>{pending ? "Memperbarui..." : "Simpan kata sandi"} <ArrowRight size={15} /></button></form> : <div className="auth-action-result"><div className="editor-error" role="alert">Tautan pemulihan tidak tersedia. Minta tautan baru untuk melanjutkan.</div><Link className="button button--dark button--wide" href={withPostLoginCallback("/forgot-password", callbackUrl)}>Minta tautan baru <ArrowRight size={15} /></Link></div>}
  </AuthFrame>;
}
