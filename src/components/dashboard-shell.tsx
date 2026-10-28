"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { BookOpen, ChevronDown, CircleHelp, Coins, CreditCard, FileText, Globe, LayoutGrid, LogOut, ShieldCheck } from "lucide-react";
import { Brand } from "@/components/site-header";
import { EditorFeedbackDialog } from "@/components/editor-feedback-dialog";

const menu = [
  { label: "Ringkasan", href: "/dashboard", icon: LayoutGrid },
  { label: "Undangan saya", href: "/dashboard#invitations", icon: FileText },
];

export function DashboardShell({ children, user }: {
  children: React.ReactNode;
  user: { name: string | null; email: string | null; platformRole: string };
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [hash, setHash] = useState("");
  useEffect(() => {
    const syncHash = () => setHash(window.location.hash);
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, []);
  const active = pathname === "/dashboard/privacy"
    ? "Data & privasi"
    : pathname.includes("/invitations") || (pathname === "/dashboard" && hash === "#invitations")
      ? "Undangan saya"
      : "Ringkasan";
  const displayName = user.name?.trim() || user.email || "Pengguna TamuKita";
  const initials = displayName.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TK";
  const workspaceName = user.name ? `Ruang ${user.name.split(" ")[0]}` : "Ruang pribadi";

  async function handleSignOut() {
    await signOut({ redirect: false });
    router.replace("/login");
    router.refresh();
  }

  return (
    <div className="dashboard-layout">
      <aside className="dashboard-sidebar">
        <div className="dashboard-sidebar-top"><Brand /><span className="workspace-label">WORKSPACE</span></div>
        <div className="workspace-switcher"><span className="workspace-avatar">{initials.slice(0, 1)}</span><span><b>{workspaceName}</b><small>Ruang pribadi</small></span><ChevronDown size={15} /></div>
        <nav className="dashboard-menu" aria-label="Menu dashboard">
          <span className="sidebar-caption">MENU UTAMA</span>
          {menu.map(({ label, href, icon: Icon }) => (
            <Link href={href} className={`sidebar-link${active === label ? " is-active" : ""}`} key={label} aria-current={active === label ? "page" : undefined} onClick={() => setHash(label === "Undangan saya" ? "#invitations" : "")}><Icon size={17} /><span>{label}</span></Link>
          ))}
          {(user.platformRole === "SUPPORT" || user.platformRole === "SUPER_ADMIN") && <Link href="/admin/editor-feedback" className="sidebar-link"><CircleHelp size={17} /><span>Antrean bantuan</span></Link>}
          <span className="sidebar-caption sidebar-caption--spaced">PREFERENSI</span>
          <Link href="/templates" className="sidebar-link"><BookOpen size={17} /><span>Jelajahi template</span></Link>
          <Link href="/reseller" className="sidebar-link"><Coins size={17} /><span>Program reseller</span></Link>
          <div className="sidebar-link sidebar-link--disabled" aria-disabled="true" title="Integrasi DNS belum tersedia"><Globe size={17} /><span>Custom Domain</span><span className="coming-soon-mini">Segera</span></div>
          <div className="sidebar-link sidebar-link--disabled" aria-disabled="true" title="Paket dan pembayaran segera tersedia"><CreditCard size={17} /><span>Paket & pembayaran</span><span className="coming-soon-mini">Segera</span></div>
          <Link href="/dashboard/privacy" className={`sidebar-link${active === "Data & privasi" ? " is-active" : ""}`} aria-current={active === "Data & privasi" ? "page" : undefined}><ShieldCheck size={17} /><span>Data & privasi</span></Link>
        </nav>
        <div className="sidebar-help"><span className="help-icon"><CircleHelp size={16} /></span><span><b>Butuh bantuan?</b><small>Kirim laporan kendala</small></span><EditorFeedbackDialog variant="sidebar" /></div>
        <div className="sidebar-profile"><span className="profile-avatar">{initials}</span><span><b>{displayName}</b><small>{user.email || "Email belum tersedia"}</small></span><button type="button" aria-label="Keluar dari akun" onClick={handleSignOut}><LogOut size={17} /></button></div>
      </aside>
      <div className="dashboard-main-wrap">
        <header className="dashboard-topbar"><div className="mobile-brand"><Brand /></div><div className="breadcrumbs"><Link href="/dashboard">Dashboard</Link><span>/</span><span>{active}</span></div><div className="topbar-tools"><span className="saved-badge"><span />{pathname.includes("/dashboard/invitations") ? "Autosave aktif" : "Akun aktif"}</span><EditorFeedbackDialog variant="topbar" /><span className="profile-avatar profile-avatar--small">{initials}</span></div></header>
        <main className="dashboard-main">{children}</main>
      </div>
    </div>
  );
}
