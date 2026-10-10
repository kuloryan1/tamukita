import Link from "next/link";
import { Brand } from "@/components/site-header";

export function SiteFooter() {
  return (
    <footer className="site-footer" id="tentang">
      <div className="container footer-main">
        <div className="footer-brand-block">
          <Brand />
          <p>Momen istimewa, jadi lebih dekat.<br />Undangan digital yang dibuat dari hati.</p>
          <span className="footer-brand-note">Platform digital dari Tigakaki</span>
        </div>
        <div className="footer-column">
          <p className="footer-heading">Jelajahi</p>
          <Link href="/templates">Semua template</Link>
          <Link href="/developers">Dokumentasi developer</Link>
          <Link href="/dashboard/invitations/new/edit">Buat undangan</Link>
          <a href="/#cara-kerja">Cara kerja</a>
        </div>
        <div className="footer-column">
          <p className="footer-heading">Bantuan</p>
          <span>Bantuan · segera hadir</span>
          <span>Kontak · segera hadir</span>
          <Link href="/login">Masuk ke akun</Link>
        </div>
        <div className="footer-note">
          <span className="eyebrow">Dari Tigakaki, dengan cinta</span>
          <p>Setiap cerita punya cara indahnya sendiri untuk dibagikan.</p>
        </div>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 TamuKita, bagian dari Tigakaki</span>
        <div><span>Kebijakan privasi · segera</span><span>Syarat penggunaan · segera</span></div>
      </div>
    </footer>
  );
}
