"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";

type Entry = { id: string; displayName: string; message: string; status: "PENDING" | "APPROVED" | "REJECTED" | "HIDDEN"; createdAt: string };

export function GuestbookModeration({ invitationId, entries }: { invitationId: string; entries: Entry[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  async function review(entryId: string, status: "APPROVED" | "REJECTED") {
    setBusyId(entryId);
    setError("");
    const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/guestbook/${encodeURIComponent(entryId)}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ status }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusyId("");
    if (!response?.ok) {
      setError(result?.error ?? "Perubahan belum tersimpan. Coba lagi.");
      return;
    }
    router.refresh();
  }

  return <div className="guestbook-admin-list">
    {error && <div className="editor-error" role="alert">{error}</div>}
    {entries.length === 0 ? <div className="dashboard-empty-state"><h3>Belum ada ucapan</h3><p>Ucapan yang dikirim tamu akan tampil di sini untuk diperiksa.</p></div> : entries.map((entry) => <article className="guestbook-admin-entry" data-entry-id={entry.id} key={entry.id}>
      <div className="guestbook-admin-entry-heading"><div><h3>{entry.displayName}</h3><time dateTime={entry.createdAt}>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(entry.createdAt))}</time></div><span className={`status-pill ${entry.status === "APPROVED" ? "status-pill--live" : "status-pill--draft"}`}><i />{entry.status === "APPROVED" ? "Tampil" : entry.status === "REJECTED" ? "Ditolak" : entry.status === "HIDDEN" ? "Disembunyikan admin" : "Menunggu"}</span></div>
      <p>{entry.message}</p>
      {entry.status === "HIDDEN" ? <small className="guestbook-hidden-note">Ucapan ini disembunyikan moderator platform dan tidak dapat diubah dari workspace.</small> : <>
        {entry.status !== "REJECTED" && <button type="button" className="button button--outline button--small guestbook-review-button" disabled={busyId === entry.id} onClick={() => void review(entry.id, "REJECTED")}><X size={14} /> Tolak</button>}
        {entry.status !== "APPROVED" && <button type="button" className="button button--dark button--small guestbook-review-button" disabled={busyId === entry.id} onClick={() => void review(entry.id, "APPROVED")}><Check size={14} /> Setujui</button>}
      </>}
    </article>)}
  </div>;
}
