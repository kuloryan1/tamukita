import Link from "next/link";
import { ArrowLeft, ArrowRight, ArrowUpRight, CalendarDays, Camera, CheckCircle2, Clock3, FileText, MessageCircle, PenLine, Plus, Search, SlidersHorizontal, Users, X } from "lucide-react";
import { TemplateArtwork } from "@/components/template-artwork";
import { HostingRenewButton } from "@/components/hosting-renew-button";
import type { Template } from "@/lib/templates";
import styles from "./dashboard-invitations.module.css";

export type InvitationFilter = "all" | "draft" | "published" | "expired" | "suspended" | "archived";

export type DashboardInvitationItem = {
  id: string;
  title: string;
  slug: string;
  status: string;
  template: Template;
  updatedAt: Date;
  eventDate: Date | null;
  expiresAt: Date | null;
  isExpired: boolean;
  isPublished: boolean;
  canRenew: boolean;
  renewalDeadline: Date | null;
  hasRsvp: boolean;
  rsvpCount: number;
};

const statusLabels: Record<string, string> = {
  DRAFT: "Draft",
  PUBLISHED: "Aktif",
  SUSPENDED: "Ditangguhkan",
  EXPIRED: "Hosting berakhir",
  ARCHIVED: "Diarsipkan",
};

function shortDate(value: Date) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(value);
}

export function dashboardInvitationsHref({ query = "", status = "all", page = 1 }: { query?: string; status?: InvitationFilter; page?: number }) {
  const params = new URLSearchParams();
  if (query) params.set("q", query);
  if (status !== "all") params.set("status", status);
  if (page > 1) params.set("page", String(page));
  return `/dashboard${params.size ? `?${params}` : ""}#invitations`;
}

function InvitationCard({ invitation }: { invitation: DashboardInvitationItem }) {
  const editHref = `/dashboard/invitations/${encodeURIComponent(invitation.id)}/edit`;
  const baseHref = `/dashboard/invitations/${encodeURIComponent(invitation.id)}`;
  const statusLabel = invitation.isExpired ? "Hosting berakhir" : statusLabels[invitation.status] ?? invitation.status;
  const primaryLabel = invitation.isPublished ? "Edit" : ["PUBLISHED", "EXPIRED", "SUSPENDED", "ARCHIVED"].includes(invitation.status) ? "Edit undangan" : "Lanjutkan";

  return (
    <article className={`${styles.card} invitation-row`} aria-labelledby={`invitation-${invitation.id}-title`}>
      <div className={styles.cardMain}>
        <div className={styles.artwork}><TemplateArtwork template={invitation.template} /></div>
        <div className={styles.cardIdentity}>
          <p className={styles.templateName}>{invitation.template.name}</p>
          <h3 id={`invitation-${invitation.id}-title`}><Link href={editHref}>{invitation.title}</Link></h3>
          <span className={`${styles.status} ${invitation.isPublished ? styles.statusLive : invitation.isExpired || invitation.status === "SUSPENDED" ? styles.statusAttention : styles.statusDraft} status-pill`}>
            <span aria-hidden="true" />{statusLabel}
          </span>
          {invitation.isPublished ? <a className={styles.publicLink} href={`/${encodeURIComponent(invitation.slug)}`} target="_blank" rel="noreferrer">tamukita.io/{invitation.slug}<ArrowUpRight size={13} aria-hidden="true" /></a> : <p className={styles.publicHint}>{invitation.isExpired ? "Periksa masa aktif hosting undangan." : invitation.status === "SUSPENDED" ? "Undangan sedang ditangguhkan." : invitation.status === "ARCHIVED" ? "Undangan tersimpan dalam arsip." : "Lengkapi detail, lalu terbitkan undanganmu."}</p>}
        </div>
      </div>

      <dl className={styles.meta}>
        <div><dt><CalendarDays size={14} aria-hidden="true" /> Tanggal acara</dt><dd>{invitation.eventDate ? shortDate(invitation.eventDate) : "Belum diatur"}</dd></div>
        <div><dt><Clock3 size={14} aria-hidden="true" /> Terakhir diubah</dt><dd>{shortDate(invitation.updatedAt)}</dd></div>
        {invitation.hasRsvp && <div><dt><Users size={14} aria-hidden="true" /> Konfirmasi tamu</dt><dd>{invitation.rsvpCount.toLocaleString("id-ID")} konfirmasi</dd></div>}
        {invitation.expiresAt && <div><dt><CheckCircle2 size={14} aria-hidden="true" /> Masa hosting</dt><dd>{shortDate(invitation.expiresAt)}</dd></div>}
      </dl>

      <div className={styles.cardFooter}>
        <div className={styles.primaryActions}>
          <Link href={editHref} className={`${styles.primaryAction} button button--dark button--small`}><PenLine size={14} aria-hidden="true" />{primaryLabel}<ArrowRight size={14} aria-hidden="true" /></Link>
          {invitation.isPublished && <Link href={`/${encodeURIComponent(invitation.slug)}`} className={`${styles.previewAction} button button--outline button--small`}>Lihat undangan<ArrowUpRight size={14} aria-hidden="true" /></Link>}
        </div>
        <nav className={styles.tools} aria-label={`Kelola ${invitation.title}`}>
          {invitation.isPublished && <>
            {invitation.hasRsvp && <Link href={`${baseHref}/guests`}><Users size={15} aria-hidden="true" />Tamu</Link>}
            <Link href={`${baseHref}/guestbook`}><MessageCircle size={15} aria-hidden="true" />Ucapan</Link>
          </>}
          <Link href={`${baseHref}/paparazi`}><Camera size={15} aria-hidden="true" />Paparazi</Link>
        </nav>
      </div>
      {invitation.expiresAt && ["PUBLISHED", "EXPIRED"].includes(invitation.status) && (invitation.canRenew || invitation.isExpired) && <div className={styles.hostingNotice}>
        <span><Clock3 size={15} aria-hidden="true" />{invitation.isExpired ? "Masa hosting telah berakhir." : "Jaga undanganmu tetap aktif."}</span>
        {invitation.canRenew ? <HostingRenewButton invitationId={invitation.id} /> : invitation.renewalDeadline && <small>Batas perpanjangan {shortDate(invitation.renewalDeadline)}</small>}
      </div>}
    </article>
  );
}

export function DashboardInvitations({ invitations, query, status, page, pageSize, totalCount, filteredCount }: {
  invitations: DashboardInvitationItem[];
  query: string;
  status: InvitationFilter;
  page: number;
  pageSize: number;
  totalCount: number;
  filteredCount: number;
}) {
  const hasFilters = Boolean(query) || status !== "all";
  const pageCount = Math.max(1, Math.ceil(filteredCount / pageSize));
  const firstResult = filteredCount === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastResult = Math.min(page * pageSize, filteredCount);

  return (
    <section id="invitations" className={styles.section} tabIndex={-1} aria-labelledby="my-invitations-heading">
      <header className={styles.sectionHeader}>
        <div><span className={styles.eyebrow}>RUANG CERITAMU</span><div className={styles.titleLine}><h2 id="my-invitations-heading">Undangan saya</h2><span className={styles.totalCount}>{totalCount.toLocaleString("id-ID")}</span></div><p>Kelola detail acara, publikasi, dan kabar dari tamu di satu tempat.</p></div>
        <Link href="/dashboard/invitations/new/edit?new=1" className={`${styles.createLink} button button--outline`}><Plus size={16} aria-hidden="true" />Buat undangan</Link>
      </header>

      {totalCount > 0 && <search aria-label="Cari dan filter undangan"><form key={`${status}:${query}`} className={styles.toolbar} action="/dashboard#invitations" method="get">
        <label className={styles.searchField}><span className="sr-only">Cari undangan</span><Search size={17} aria-hidden="true" /><input type="search" name="q" defaultValue={query} maxLength={100} placeholder="Cari nama, tautan, atau template…" /></label>
        <label className={styles.statusField}><span className="sr-only">Status undangan</span><SlidersHorizontal size={15} aria-hidden="true" /><select name="status" aria-label="Status undangan" defaultValue={status}><option value="all">Semua status</option><option value="draft">Draft</option><option value="published">Aktif</option><option value="expired">Hosting berakhir</option><option value="suspended">Ditangguhkan</option><option value="archived">Diarsipkan</option></select></label>
        <button type="submit" className={styles.filterButton}>Terapkan filter<ArrowRight size={14} aria-hidden="true" /></button>
        {hasFilters && <Link className={styles.resetLink} href="/dashboard#invitations"><X size={14} aria-hidden="true" />Reset filter</Link>}
      </form></search>}

      {totalCount > 0 && <div className={styles.resultsLine}><p aria-live="polite">{filteredCount === 0 ? "Tidak ada undangan yang cocok" : `Menampilkan ${firstResult}–${lastResult} dari ${filteredCount.toLocaleString("id-ID")} undangan`}</p><span>Terbaru diperbarui</span></div>}

      {invitations.length > 0 ? <div className={styles.grid}>{invitations.map((invitation) => <InvitationCard key={invitation.id} invitation={invitation} />)}</div> : <div className={styles.emptyState}>
        <span className={styles.emptyIcon}>{hasFilters ? <Search size={24} aria-hidden="true" /> : <FileText size={24} aria-hidden="true" />}</span>
        <h3>{hasFilters ? "Belum menemukan undanganmu?" : "Ruang ceritamu masih kosong"}</h3>
        <p>{hasFilters ? "Coba kata kunci lain atau reset filter untuk melihat semua undangan." : "Mulai dari sebuah draft. Pilih desain, lengkapi cerita dan detail acara, lalu siapkan undangan untuk tamumu."}</p>
        {hasFilters ? <Link href="/dashboard#invitations" className="button button--outline">Reset filter</Link> : <Link href="/dashboard/invitations/new/edit?new=1" className="button button--dark"><Plus size={16} aria-hidden="true" />Mulai buat undangan</Link>}
      </div>}

      {pageCount > 1 && <nav className={styles.pagination} aria-label="Halaman daftar undangan">
        {page > 1 ? <Link href={dashboardInvitationsHref({ query, status, page: page - 1 })} aria-label="Halaman sebelumnya"><ArrowLeft size={16} aria-hidden="true" /><span>Sebelumnya</span></Link> : <span className={styles.disabledPage} aria-disabled="true"><ArrowLeft size={16} aria-hidden="true" /><span>Sebelumnya</span></span>}
        <span className={styles.pageIndicator}>Halaman <b>{page}</b> dari {pageCount}</span>
        {page < pageCount ? <Link href={dashboardInvitationsHref({ query, status, page: page + 1 })} aria-label="Halaman berikutnya"><span>Berikutnya</span><ArrowRight size={16} aria-hidden="true" /></Link> : <span className={styles.disabledPage} aria-disabled="true"><span>Berikutnya</span><ArrowRight size={16} aria-hidden="true" /></span>}
      </nav>}
    </section>
  );
}
