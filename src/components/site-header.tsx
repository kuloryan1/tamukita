import Link from "next/link";
import { ArrowRight, Heart, Menu } from "lucide-react";

export function Brand({ inverse = false }: { inverse?: boolean }) {
  return (
    <Link href="/" className={`brand${inverse ? " brand--inverse" : ""}`} aria-label="TamuKita beranda">
      <span className="brand-mark"><Heart size={16} strokeWidth={2.2} /></span>
      <span className="brand-word">tamu<span>kita</span></span>
    </Link>
  );
}

export function SiteHeader() {
  return (
    <header className="site-header">
      <div className="container header-inner">
        <Brand />
        <nav className="main-nav" aria-label="Navigasi utama">
          <Link href="/templates">Template</Link>
          <a href="/#cara-kerja">Cara kerja</a>
          <a href="/#tentang">Tentang kami</a>
        </nav>
        <div className="header-actions">
          <Link className="text-link login-link" href="/login">Masuk</Link>
          <Link className="button button--dark button--small" href="/dashboard/invitations/new/edit">
            Buat undangan <ArrowRight size={15} />
          </Link>
        </div>
        <Link className="mobile-menu" href="/templates" aria-label="Lihat template"><Menu size={23} /></Link>
      </div>
    </header>
  );
}
