import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, Download, ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "Data & privasi" };

export default function PrivacyPage() {
  return (
    <div className="admin-page">
      <div className="dashboard-page-heading">
        <div><p className="dashboard-date">PREFERENSI AKUN</p><h1>Data & privasi <span>✳</span></h1><p>Kelola salinan data yang terhubung dengan akun TamuKita.</p></div>
        <Link href="/dashboard" className="button button--outline"><ArrowLeft size={15} /> Kembali ke dashboard</Link>
      </div>
      <section className="dashboard-content-card">
        <div className="card-heading"><div><h2>Unduh salinan data akun</h2><p>File JSON dibuat saat diminta dan tidak disimpan di server.</p></div><ShieldCheck size={20} /></div>
        <p>Salinan ini mencakup profil, akun masuk yang tertaut, keanggotaan workspace, undangan yang kamu miliki atau buat, pesanan, permintaan refund, dan laporan bantuan.</p>
        <p>Kata sandi, token autentikasi/provider, sesi, respons tamu, payload pembayaran, dan catatan internal admin tidak disertakan.</p>
        <a href="/api/account/export" className="button button--dark"><Download size={16} /> Unduh data akun (JSON)</a>
      </section>
    </div>
  );
}
