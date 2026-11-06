"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { signOut } from "next-auth/react";
import { BookOpen, CircleHelp, Coins, CreditCard, FileText, Globe, LayoutGrid, LogOut, Menu, ShieldCheck, X } from "lucide-react";
import { Brand } from "@/components/site-header";
import { EditorFeedbackDialog } from "@/components/editor-feedback-dialog";
import styles from "./dashboard-shell.module.css";

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
  const [navigationOpen, setNavigationOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState("");
  const navigationRef = useRef<HTMLElement>(null);
  const navigationToggleRef = useRef<HTMLButtonElement>(null);
  const firstNavigationLinkRef = useRef<HTMLAnchorElement>(null);

  const closeNavigation = useCallback((restoreFocus = false) => {
    setNavigationOpen(false);
    if (restoreFocus) navigationToggleRef.current?.focus();
  }, []);

  useEffect(() => {
    const syncHash = () => {
      setHash(pathname === "/dashboard" ? window.location.hash : "");
      setNavigationOpen(false);
    };
    syncHash();
    window.addEventListener("hashchange", syncHash);
    window.addEventListener("popstate", syncHash);
    return () => {
      window.removeEventListener("hashchange", syncHash);
      window.removeEventListener("popstate", syncHash);
    };
  }, [pathname]);

  useEffect(() => {
    if (!navigationOpen) return;
    const mobileViewport = window.matchMedia("(max-width: 960px)");
    if (!mobileViewport.matches) {
      closeNavigation();
      return;
    }

    firstNavigationLinkRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      // A feedback dialog has its own close control and must stay visible.
      if (event.key === "Escape" && !navigationRef.current?.querySelector('[role="dialog"][aria-modal="true"]')) {
        event.preventDefault();
        closeNavigation(true);
      }
    };
    const onOutsideInteraction = (event: Event) => {
      if (event.target instanceof Node
        && !navigationRef.current?.contains(event.target)
        && !navigationToggleRef.current?.contains(event.target)) closeNavigation();
    };
    const onViewportChange = (event: MediaQueryListEvent) => {
      if (!event.matches) closeNavigation();
    };
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onOutsideInteraction);
    document.addEventListener("focusin", onOutsideInteraction);
    mobileViewport.addEventListener("change", onViewportChange);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onOutsideInteraction);
      document.removeEventListener("focusin", onOutsideInteraction);
      mobileViewport.removeEventListener("change", onViewportChange);
    };
  }, [navigationOpen, closeNavigation]);

  const active = pathname === "/dashboard/privacy"
    ? "Data & privasi"
    : pathname.includes("/invitations") || (pathname === "/dashboard" && hash === "#invitations")
      ? "Undangan saya"
      : "Ringkasan";
  const displayName = user.name?.trim() || user.email || "Pengguna TamuKita";
  const initials = displayName.split(/[\s@._-]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "TK";
  const firstName = user.name?.trim().split(/\s+/)[0];
  const workspaceName = firstName ? `Ruang ${firstName}` : "Ruang pribadi";

  async function handleSignOut() {
    if (signingOut) return;
    setSigningOut(true);
    setSignOutError("");
    try {
      await signOut({ redirect: false });
      router.replace("/login");
      router.refresh();
    } catch {
      setSignOutError("Keluar belum berhasil. Silakan coba lagi.");
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <div className={`dashboard-layout ${styles.shell}`}>
      <a href="#dashboard-content" className={styles.skipLink}>Lewati ke konten dashboard</a>
      <aside
        id="dashboard-navigation"
        ref={navigationRef}
        className={`dashboard-sidebar ${styles.sidebar}${navigationOpen ? ` ${styles.navigationOpen}` : ""}`}
        aria-label="Navigasi ruang kerja"
      >
        <div className={`dashboard-sidebar-top ${styles.sidebarTop}`}>
          <Brand />
          <span className="workspace-label">WORKSPACE</span>
          <button type="button" className={styles.navigationClose} aria-label="Tutup navigasi" onClick={() => closeNavigation(true)}><X size={20} aria-hidden="true" /></button>
        </div>
        <div className={`workspace-switcher ${styles.workspace}`}>
          <span className="workspace-avatar" aria-hidden="true">{initials.slice(0, 1)}</span>
          <span><b>{workspaceName}</b><small>Ruang pribadi</small></span>
        </div>
        <nav className={`dashboard-menu ${styles.menu}`} aria-label="Menu dashboard">
          <span className="sidebar-caption">MENU UTAMA</span>
          {menu.map(({ label, href, icon: Icon }) => (
            <Link
              href={href}
              ref={label === "Ringkasan" ? firstNavigationLinkRef : undefined}
              className={`sidebar-link${active === label ? " is-active" : ""}`}
              key={label}
              aria-current={active === label ? "page" : undefined}
              onClick={() => { setHash(label === "Undangan saya" ? "#invitations" : ""); closeNavigation(); }}
            ><Icon size={18} aria-hidden="true" /><span>{label}</span></Link>
          ))}
          {(user.platformRole === "SUPPORT" || user.platformRole === "SUPER_ADMIN") && <Link href="/admin/editor-feedback" className="sidebar-link" onClick={() => closeNavigation()}><CircleHelp size={18} aria-hidden="true" /><span>Antrean bantuan</span></Link>}
          <span className="sidebar-caption sidebar-caption--spaced">PREFERENSI</span>
          <Link href="/templates" className="sidebar-link" onClick={() => closeNavigation()}><BookOpen size={18} aria-hidden="true" /><span>Jelajahi template</span></Link>
          <Link href="/reseller" className="sidebar-link" onClick={() => closeNavigation()}><Coins size={18} aria-hidden="true" /><span>Program reseller</span></Link>
          <div className="sidebar-link sidebar-link--disabled" aria-disabled="true" title="Integrasi DNS belum tersedia"><Globe size={18} aria-hidden="true" /><span>Custom Domain</span><span className="coming-soon-mini">Segera</span></div>
          <div className="sidebar-link sidebar-link--disabled" aria-disabled="true" title="Paket dan pembayaran segera tersedia"><CreditCard size={18} aria-hidden="true" /><span>Paket & pembayaran</span><span className="coming-soon-mini">Segera</span></div>
          <Link href="/dashboard/privacy" className={`sidebar-link${active === "Data & privasi" ? " is-active" : ""}`} aria-current={active === "Data & privasi" ? "page" : undefined} onClick={() => closeNavigation()}><ShieldCheck size={18} aria-hidden="true" /><span>Data & privasi</span></Link>
        </nav>
        <div className={`sidebar-help ${styles.help}`}><span className="help-icon"><CircleHelp size={17} aria-hidden="true" /></span><span><b>Butuh bantuan?</b><small>Kirim laporan kendala</small></span><EditorFeedbackDialog variant="sidebar" /></div>
        <div className={styles.account}>
          <div className={`sidebar-profile ${styles.profile}`}>
            <span className="profile-avatar" aria-hidden="true">{initials}</span>
            <span><b title={displayName}>{displayName}</b><small title={user.email ?? undefined}>{user.email || "Email belum tersedia"}</small></span>
            <button type="button" aria-label={signingOut ? "Sedang keluar dari akun" : "Keluar dari akun"} aria-busy={signingOut} disabled={signingOut} title="Keluar dari akun" onClick={() => void handleSignOut()}><LogOut size={18} aria-hidden="true" /></button>
          </div>
          {signOutError && <p className={styles.signOutError} role="alert">{signOutError}</p>}
        </div>
      </aside>
      <div className={`dashboard-main-wrap ${styles.mainWrap}`}>
        <header className={`dashboard-topbar ${styles.topbar}`}>
          <button
            type="button"
            ref={navigationToggleRef}
            className={styles.navigationToggle}
            aria-label={navigationOpen ? "Tutup menu dashboard" : "Buka menu dashboard"}
            aria-controls="dashboard-navigation"
            aria-expanded={navigationOpen}
            onClick={() => navigationOpen ? closeNavigation(true) : setNavigationOpen(true)}
          ><Menu size={21} aria-hidden="true" /></button>
          <div className={`mobile-brand ${styles.mobileBrand}`}><Brand /><span className={styles.mobileContext}>{active}</span></div>
          <nav className={`breadcrumbs ${styles.breadcrumbs}`} aria-label="Lokasi halaman"><Link href="/dashboard">Dashboard</Link><span aria-hidden="true">/</span><span aria-current="page">{active}</span></nav>
          <div className={`topbar-tools ${styles.tools}`}>
            <span className="saved-badge"><span />{pathname.includes("/dashboard/invitations/") && pathname.endsWith("/edit") ? "Autosave aktif" : "Akun aktif"}</span>
            <EditorFeedbackDialog variant="topbar" />
            <span className="profile-avatar profile-avatar--small" role="img" aria-label={`Akun ${displayName}`}>{initials}</span>
          </div>
        </header>
        <main id="dashboard-content" className={`dashboard-main ${styles.content}`} tabIndex={-1}>{children}</main>
      </div>
    </div>
  );
}
