"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AlertCircle, Check, CheckCircle2, ChevronDown, Clock3, FileText, Inbox, LoaderCircle, MessageSquareText, RefreshCw, RotateCcw, Search, Shapes, X } from "lucide-react";
import styles from "./admin-editor-feedback.module.css";

type FeedbackStatus = "OPEN" | "IN_REVIEW" | "RESOLVED";
type FeedbackCategory = "FORM" | "AUTOSAVE" | "PHOTO" | "TEMPLATE" | "PREVIEW" | "PUBLISH" | "OTHER";
export type FeedbackItem = {
  id: string;
  category: FeedbackCategory;
  message: string;
  status: FeedbackStatus;
  createdAt: string;
  updatedAt: string;
  user: { name: string | null; email: string | null };
  invitation: { title: string; slug: string } | null;
};
type View = "active" | "resolved";

const categoryLabels: Record<FeedbackCategory, string> = {
  FORM: "Isian formulir",
  AUTOSAVE: "Penyimpanan draft",
  PHOTO: "Unggah atau edit foto",
  TEMPLATE: "Template",
  PREVIEW: "Pratinjau",
  PUBLISH: "Pembayaran atau publikasi",
  OTHER: "Kendala lainnya",
};
const statusLabels: Record<FeedbackStatus, string> = { OPEN: "Baru", IN_REVIEW: "Ditinjau", RESOLVED: "Selesai" };
const statusStyles: Record<FeedbackStatus, string> = { OPEN: styles.statusNew, IN_REVIEW: styles.statusReview, RESOLVED: styles.statusResolved };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

function initials(name: string) {
  return name.trim().split(/\s+/).slice(0, 2).map((part) => Array.from(part)[0] ?? "").join("").toLocaleUpperCase("id-ID") || "P";
}

export function AdminEditorFeedback({ initialFeedback }: { initialFeedback: FeedbackItem[] }) {
  const [feedback, setFeedback] = useState(initialFeedback);
  const [view, setView] = useState<View>("active");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<FeedbackCategory | "all">("all");
  const [pendingChange, setPendingChange] = useState<{ id: string; status: FeedbackStatus } | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [actionError, setActionError] = useState("");
  const [notice, setNotice] = useState("");
  const loadController = useRef<AbortController | null>(null);
  const loadSequence = useRef(0);
  const mutationBusy = useRef(false);
  const mounted = useRef(true);
  const searchRef = useRef<HTMLInputElement>(null);
  const queueHeadingRef = useRef<HTMLHeadingElement>(null);
  const id = useId();
  const searchId = `${id}-search`;
  const categoryId = `${id}-category`;
  const headingId = `${id}-queue`;
  const busy = pendingChange !== null;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      loadController.current?.abort();
      loadSequence.current += 1;
    };
  }, []);

  async function load(nextView: View) {
    if (mutationBusy.current) return;
    loadController.current?.abort();
    const controller = new AbortController();
    loadController.current = controller;
    const sequence = ++loadSequence.current;
    setView(nextView);
    setLoading(true);
    setLoadError("");
    setActionError("");
    setNotice("");
    // A different queue must never display cards from the previous response.
    setFeedback([]);

    const response = await fetch(`/api/admin/editor-feedback?view=${nextView}`, { cache: "no-store", signal: controller.signal }).catch(() => null);
    const result = await response?.json().catch(() => null) as { feedback?: FeedbackItem[]; error?: string } | null;
    if (!mounted.current || controller.signal.aborted || sequence !== loadSequence.current) return;
    setLoading(false);
    if (!response?.ok || !Array.isArray(result?.feedback)) {
      setLoadError(result?.error ?? "Antrean belum dapat dimuat.");
      return;
    }
    setFeedback(result.feedback);
  }

  async function changeStatus(item: FeedbackItem, status: FeedbackStatus) {
    if (mutationBusy.current || loading || loadError) return;
    mutationBusy.current = true;
    setPendingChange({ id: item.id, status });
    setActionError("");
    setNotice("");
    const response = await fetch(`/api/admin/editor-feedback/${encodeURIComponent(item.id)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    mutationBusy.current = false;
    if (!mounted.current) return;
    setPendingChange(null);
    if (!response?.ok) {
      setActionError(result?.error ?? "Status laporan belum berubah.");
      return;
    }
    const belongsInView = view === "resolved" ? status === "RESOLVED" : status !== "RESOLVED";
    setFeedback((current) => belongsInView
      ? current.map((entry) => entry.id === item.id ? { ...entry, status, updatedAt: new Date().toISOString() } : entry)
      : current.filter((entry) => entry.id !== item.id));
    setNotice(status === "RESOLVED"
      ? "Laporan ditandai selesai dan dipindahkan ke riwayat."
      : status === "IN_REVIEW"
        ? "Laporan ditandai sebagai ditinjau."
        : "Laporan dibuka kembali dan masuk ke antrean.");
    queueHeadingRef.current?.focus({ preventScroll: true });
  }

  function resetFilters() {
    setQuery("");
    setCategory("all");
    searchRef.current?.focus();
  }

  const search = query.trim().toLocaleLowerCase("id-ID");
  const hasFilters = Boolean(search) || category !== "all";
  const visibleFeedback = feedback.filter((item) => {
    if (category !== "all" && item.category !== category) return false;
    if (!search) return true;
    return [item.user.name, item.user.email, item.message, item.invitation?.title, item.invitation?.slug, categoryLabels[item.category]]
      .filter(Boolean).join(" ").toLocaleLowerCase("id-ID").includes(search);
  });
  const newCount = feedback.filter((item) => item.status === "OPEN").length;
  const reviewCount = feedback.filter((item) => item.status === "IN_REVIEW").length;
  const categoryCount = new Set(feedback.map((item) => item.category)).size;
  const summaryAvailable = !loading && !loadError;
  const metrics = view === "active"
    ? [
      { label: "Dalam antrean", value: feedback.length, Icon: Inbox, tone: styles.metricNeutral },
      { label: "Laporan baru", value: newCount, Icon: MessageSquareText, tone: styles.metricWarm },
      { label: "Sedang ditinjau", value: reviewCount, Icon: Clock3, tone: styles.metricSage },
    ]
    : [
      { label: "Riwayat selesai", value: feedback.length, Icon: CheckCircle2, tone: styles.metricSage },
      { label: "Kategori laporan", value: categoryCount, Icon: Shapes, tone: styles.metricNeutral },
      { label: "Periode riwayat", value: 30, Icon: Clock3, tone: styles.metricWarm },
    ];

  return <div className={styles.workspace}>
    <section className={styles.summary} aria-label="Ringkasan laporan yang dimuat" aria-busy={loading}>
      <dl className={styles.metrics}>
        {metrics.map(({ label, value, Icon, tone }) => <div className={`${styles.metric} ${tone}`} key={label}>
          <dt><span className={styles.metricIcon}><Icon size={17} aria-hidden="true" /></span><span>{label}</span></dt>
          <dd>{summaryAvailable ? value.toLocaleString("id-ID") : "—"}{view === "resolved" && label === "Periode riwayat" && <span>hari</span>}</dd>
        </div>)}
      </dl>
      <p className={styles.summaryNote}>Ringkasan mengikuti laporan yang dimuat pada antrean ini.</p>
    </section>

    <section className={styles.queuePanel} aria-labelledby={headingId}>
      <div className={`admin-feedback-toolbar ${styles.toolbar}`}>
        <fieldset className={styles.queueTabs} disabled={busy}>
          <legend className={styles.visuallyHidden}>Filter laporan editor</legend>
          <button type="button" aria-pressed={view === "active"} onClick={() => void load("active")}><Inbox size={16} aria-hidden="true" />Belum selesai</button>
          <button type="button" aria-pressed={view === "resolved"} onClick={() => void load("resolved")}><CheckCircle2 size={16} aria-hidden="true" />Selesai</button>
        </fieldset>
        <button type="button" className={styles.refreshButton} aria-label="Muat ulang laporan" disabled={loading || busy} onClick={() => void load(view)}>
          <RefreshCw size={16} aria-hidden="true" className={loading ? styles.spinning : undefined} /><span className={styles.refreshLabel}>Muat ulang</span>
        </button>
      </div>

      <div className={styles.filters}>
        <div className={styles.field}>
          <label htmlFor={searchId}>Cari laporan</label>
          <div className={styles.searchInput}>
            <Search size={17} aria-hidden="true" />
            <input id={searchId} ref={searchRef} type="search" placeholder="Nama, email, atau isi laporan…" value={query} maxLength={200} disabled={busy} onChange={(event) => setQuery(event.target.value)} />
            {query && <button type="button" aria-label="Hapus pencarian" disabled={busy} onClick={() => { setQuery(""); searchRef.current?.focus(); }}><X size={15} aria-hidden="true" /></button>}
          </div>
        </div>
        <div className={styles.field}>
          <label htmlFor={categoryId}>Kategori laporan</label>
          <div className={styles.selectInput}>
            <select id={categoryId} value={category} disabled={busy} onChange={(event) => setCategory(event.target.value as FeedbackCategory | "all")}>
              <option value="all">Semua kategori</option>
              {(Object.entries(categoryLabels) as [FeedbackCategory, string][]).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
            <ChevronDown size={16} aria-hidden="true" />
          </div>
        </div>
      </div>

      <div className={styles.resultsBar}>
        <div>
          <h2 id={headingId} ref={queueHeadingRef} tabIndex={-1}>{view === "active" ? "Laporan aktif" : "Riwayat selesai"}</h2>
          <p aria-live="polite">{loading ? "Menyiapkan daftar laporan…" : loadError ? "Daftar belum tersedia" : `Menampilkan ${visibleFeedback.length} dari ${feedback.length} laporan`}</p>
        </div>
        {hasFilters && <button type="button" className={styles.resetButton} disabled={busy} onClick={resetFilters}><RotateCcw size={13} aria-hidden="true" />Reset filter</button>}
      </div>

      {actionError && <div className={`${styles.alert} ${styles.alertError}`} role="alert"><AlertCircle size={18} aria-hidden="true" /><p>{actionError}</p></div>}
      {notice && <div className={`${styles.alert} ${styles.alertSuccess}`} role="status"><CheckCircle2 size={18} aria-hidden="true" /><p>{notice}</p></div>}

      <div className={styles.queueBody} aria-busy={loading}>
        {loading ? <div className={styles.loadingState}>
          <p role="status"><LoaderCircle size={19} className={styles.spinning} aria-hidden="true" />Memuat antrean laporan…</p>
          <div className={styles.skeletonCard} aria-hidden="true"><span /><span /><span /></div>
          <div className={styles.skeletonCard} aria-hidden="true"><span /><span /><span /></div>
        </div> : loadError ? <div className={styles.emptyState}>
          <span className={`${styles.emptyIcon} ${styles.emptyIconError}`}><AlertCircle size={24} aria-hidden="true" /></span>
          <h3>Antrean belum tersedia</h3>
          <p role="alert">{loadError}</p>
          <button type="button" className={styles.buttonOutline} onClick={() => void load(view)}><RefreshCw size={15} aria-hidden="true" />Coba muat lagi</button>
        </div> : visibleFeedback.length === 0 ? <div className={styles.emptyState}>
          <span className={styles.emptyIcon}>{hasFilters ? <Search size={24} aria-hidden="true" /> : view === "active" ? <Inbox size={24} aria-hidden="true" /> : <CheckCircle2 size={24} aria-hidden="true" />}</span>
          <h3>{hasFilters ? "Tidak ada laporan yang cocok" : view === "active" ? "Belum ada laporan aktif" : "Belum ada laporan selesai"}</h3>
          <p>{hasFilters ? "Coba kata kunci lain atau reset filter untuk melihat seluruh daftar." : view === "active" ? "Laporan kendala editor akan muncul di sini. Antreanmu sudah tertangani." : "Laporan yang selesai ditinjau dalam 30 hari terakhir akan tampil di sini."}</p>
        </div> : <div className={`admin-feedback-list ${styles.feedbackList}`}>
          {visibleFeedback.map((item) => {
            const displayName = item.user.name || item.user.email || "Akun pelanggan";
            const savingReview = pendingChange?.id === item.id && pendingChange.status === "IN_REVIEW";
            const savingFinal = pendingChange?.id === item.id && pendingChange.status !== "IN_REVIEW";
            return <article className={`admin-feedback-card ${styles.feedbackCard}`} key={item.id} aria-busy={pendingChange?.id === item.id}>
              <header className={styles.cardHeader}>
                <div className={styles.identity}>
                  <span className={styles.avatar} aria-hidden="true">{initials(displayName)}</span>
                  <div><h3>{displayName}</h3><p>{item.user.email || "Email akun tidak tersedia"}</p></div>
                </div>
                <span className={`status-pill ${styles.status} ${statusStyles[item.status]}`}><i aria-hidden="true" />{statusLabels[item.status]}</span>
              </header>

              <div className={styles.cardBody}>
                <div className={styles.messageColumn}>
                  <span className={styles.categoryTag}><MessageSquareText size={13} aria-hidden="true" />{categoryLabels[item.category]}</span>
                  <p className={`admin-feedback-message ${styles.message}`}>{item.message}</p>
                </div>
                <dl className={styles.details}>
                  <div><dt><Clock3 size={14} aria-hidden="true" />Dikirim</dt><dd><time dateTime={item.createdAt}>{formatDate(item.createdAt)}</time><span className={styles.timezone}>WIB</span></dd></div>
                  {item.invitation && <div><dt><FileText size={14} aria-hidden="true" />Undangan terkait</dt><dd>{item.invitation.title}<span className={styles.invitationSlug}>tamukita.io/{item.invitation.slug}</span></dd></div>}
                </dl>
              </div>

              <footer className={styles.cardFooter}>
                <p className={styles.updatedAt}>Diperbarui <time dateTime={item.updatedAt}>{formatDate(item.updatedAt)}</time> WIB</p>
                <div className={`admin-feedback-actions ${styles.actions}`}>
                  {item.status === "OPEN" && <button type="button" className={styles.buttonOutline} disabled={busy} onClick={() => void changeStatus(item, "IN_REVIEW")}>
                    {savingReview ? <LoaderCircle size={15} className={styles.spinning} aria-hidden="true" /> : <Clock3 size={15} aria-hidden="true" />}{savingReview ? "Menyimpan…" : "Tandai ditinjau"}
                  </button>}
                  {item.status !== "RESOLVED" ? <button type="button" className={styles.buttonPrimary} disabled={busy} onClick={() => void changeStatus(item, "RESOLVED")}>
                    {savingFinal ? <LoaderCircle size={15} className={styles.spinning} aria-hidden="true" /> : <Check size={15} aria-hidden="true" />}{savingFinal ? "Menyimpan…" : "Tandai selesai"}
                  </button> : <button type="button" className={styles.buttonOutline} disabled={busy} onClick={() => void changeStatus(item, "OPEN")}>
                    {savingFinal ? <LoaderCircle size={15} className={styles.spinning} aria-hidden="true" /> : <RotateCcw size={15} aria-hidden="true" />}{savingFinal ? "Menyimpan…" : "Buka kembali"}
                  </button>}
                </div>
              </footer>
            </article>;
          })}
        </div>}
      </div>
      <p className={styles.queueNote}>{view === "active" ? "Maksimal 100 laporan aktif ditampilkan, dari yang paling lama." : "Maksimal 100 laporan selesai dalam 30 hari terakhir, dari pembaruan terbaru."}</p>
    </section>
  </div>;
}
