"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, CircleHelp, Clock3, RotateCcw } from "lucide-react";

type PaymentState = { published?: boolean; slug?: string | null; orderStatus?: string; paymentStatus?: string; hostingExpiresAt?: string | null; error?: string };

export function CheckoutReturn({ invitationId, wasCancelled, isRenewal = false }: { invitationId: string; wasCancelled: boolean; isRenewal?: boolean }) {
  const router = useRouter();
  const [state, setState] = useState<PaymentState>({});
  const [timedOut, setTimedOut] = useState(false);

  useEffect(() => {
    let active = true;
    const startedAt = Date.now();
    async function refresh() {
      const response = await fetch(`/api/invitations/${encodeURIComponent(invitationId)}/payment-status`, { cache: "no-store" }).catch(() => null);
      const result = await response?.json().catch(() => null) as PaymentState | null;
      if (!active || !response?.ok || !result) return;
      setState(result);
      if (!wasCancelled && result.published && result.slug && (!isRenewal || (result.hostingExpiresAt && new Date(result.hostingExpiresAt).getTime() > Date.now()))) {
        router.replace(isRenewal ? "/dashboard" : `/${result.slug}`);
        return;
      }
      if (Date.now() - startedAt > 120_000) setTimedOut(true);
    }
    void refresh();
    const timer = window.setInterval(refresh, 3_000);
    return () => { active = false; window.clearInterval(timer); };
  }, [invitationId, isRenewal, router, wasCancelled]);

  const failed = state.orderStatus === "EXPIRED" || state.orderStatus === "CANCELED" || state.paymentStatus === "FAILED" || state.paymentStatus === "EXPIRED";
  return (
    <section className="dashboard-empty-state">
      <span className="review-check">{failed ? <RotateCcw size={20} /> : state.published ? <CheckCircle2 size={20} /> : <Clock3 size={20} />}</span>
      <h1>{failed || wasCancelled ? "Pembayaran belum selesai" : timedOut ? "Konfirmasi masih diproses" : "Memeriksa pembayaran..."}</h1>
      <p>{failed || wasCancelled ? "Undangan tetap tersimpan di dashboard. Kamu bisa mengulang proses pembayaran kapan saja." : timedOut ? "Xendit belum mengirim konfirmasi akhir. Halaman ini tetap aman untuk dimuat ulang setelah beberapa saat." : isRenewal ? "Masa hosting diperpanjang setelah konfirmasi pembayaran diterima dari Xendit." : "Undangan baru diterbitkan setelah konfirmasi pembayaran diterima dari Xendit."}</p>
      {state.error && <p role="alert">{state.error}</p>}
      <div className="step-navigation"><button type="button" className="button button--outline" onClick={() => router.refresh()}><CircleHelp size={15} /> Periksa lagi</button><button type="button" className="button button--dark" onClick={() => router.push("/dashboard")}>Kembali ke dashboard</button></div>
    </section>
  );
}
