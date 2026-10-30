"use client";

import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, Ban, CheckCircle2, CircleHelp, Coins, ReceiptText, ShoppingBag, Sparkles, Users } from "lucide-react";

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function ResellerApplicationForm() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/reseller/application", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ businessName }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusy(false);
    if (!response?.ok) { setError(result?.error ?? "Pengajuan belum tersimpan."); return; }
    router.refresh();
  }

  return <section className="reseller-application-card"><span className="reseller-icon"><Sparkles size={20} /></span><span className="eyebrow">KEMITRAAN TAMUKITA</span><h1>Jual undangan dengan caramu.</h1><p>Ajukan workspace reseller untuk membeli kredit aktivasi dan mengelola penjualanmu. Tim TamuKita akan memeriksa pengajuan sebelum fitur keuangan dibuka.</p><form onSubmit={submit}><label className="editor-field"><span className="field-label">Nama usaha atau brand</span><input className="text-input" required minLength={2} maxLength={120} value={businessName} onChange={(event) => setBusinessName(event.target.value)} placeholder="Contoh: Cerita Kita Studio" /></label>{error && <div className="editor-error" role="alert">{error}</div>}<button type="submit" className="button button--dark" disabled={busy}>{busy ? "Mengirim..." : "Kirim pengajuan"} <ArrowRight size={15} /></button></form></section>;
}

type ResellerOrder = { id: string; status: string; totalAmount: number; createdAt: string; sku: string; units: number };
type CustomerInvitation = { id: string; title: string; slug: string; status: "DRAFT" | "PUBLISHED"; alreadyAssigned: boolean; activationSku: "BASIC_ACTIVATION" | "PREMIUM_ACTIVATION" | null };
type ResellerCustomer = { organizationId: string; name: string; email: string; invitations: CustomerInvitation[] };
type ResellerStaff = { id: string; name: string; email: string; createdAt: string };
type ResellerSale = { id: string; amountIdr: number; description: string; createdAt: string; voidedAt: string | null; voidReason: string | null; customerName: string | null; invitationTitle: string | null };
type ResellerSalesSummary = { activeTotalIdr: number; activeSaleCount: number; monthToDateIdr: number };

export function ResellerDashboard({ businessName, basicCredits, premiumCredits, activationCount, customerCount, canManageStaff, canViewSales, basicUnitPrice, premiumUnitPrice, orders }: {
  businessName: string;
  basicCredits: number;
  premiumCredits: number;
  activationCount: number;
  customerCount: number;
  canManageStaff: boolean;
  canViewSales: boolean;
  basicUnitPrice: number | null;
  premiumUnitPrice: number | null;
  orders: ResellerOrder[];
}) {
  const router = useRouter();
  const [sku, setSku] = useState<"BASIC_ACTIVATION" | "PREMIUM_ACTIVATION">("BASIC_ACTIVATION");
  const [quantity, setQuantity] = useState(10);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [customers, setCustomers] = useState<ResellerCustomer[]>([]);
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerBusy, setCustomerBusy] = useState(false);
  const [customerError, setCustomerError] = useState("");
  const [customerNotice, setCustomerNotice] = useState("");
  const [activatingId, setActivatingId] = useState("");
  const [staff, setStaff] = useState<ResellerStaff[]>([]);
  const [staffEmail, setStaffEmail] = useState("");
  const [staffBusy, setStaffBusy] = useState(false);
  const [staffError, setStaffError] = useState("");
  const [staffNotice, setStaffNotice] = useState("");
  const [removingStaffId, setRemovingStaffId] = useState("");
  const [sales, setSales] = useState<ResellerSale[]>([]);
  const [salesSummary, setSalesSummary] = useState<ResellerSalesSummary>({ activeTotalIdr: 0, activeSaleCount: 0, monthToDateIdr: 0 });
  const [saleAmount, setSaleAmount] = useState("");
  const [saleDescription, setSaleDescription] = useState("");
  const [saleCustomerOrgId, setSaleCustomerOrgId] = useState("");
  const [saleInvitationId, setSaleInvitationId] = useState("");
  const [saleBusy, setSaleBusy] = useState(false);
  const [saleError, setSaleError] = useState("");
  const [saleNotice, setSaleNotice] = useState("");
  const [voidingSaleId, setVoidingSaleId] = useState("");
  const [voidReason, setVoidReason] = useState("");
  const [voidBusy, setVoidBusy] = useState(false);
  const [voidError, setVoidError] = useState("");
  const unitPrice = sku === "BASIC_ACTIVATION" ? basicUnitPrice : premiumUnitPrice;

  const loadCustomers = useCallback(async () => {
    const response = await fetch("/api/reseller/customers", { cache: "no-store" }).catch(() => null);
    const result = await response?.json().catch(() => null) as { customers?: ResellerCustomer[] } | null;
    if (response?.ok && result?.customers) setCustomers(result.customers);
  }, []);

  const loadStaff = useCallback(async () => {
    const response = await fetch("/api/reseller/staff", { cache: "no-store" }).catch(() => null);
    const result = await response?.json().catch(() => null) as { staff?: ResellerStaff[] } | null;
    if (response?.ok && result?.staff) setStaff(result.staff);
  }, []);

  const loadSales = useCallback(async () => {
    const response = await fetch("/api/reseller/sales", { cache: "no-store" }).catch(() => null);
    const result = await response?.json().catch(() => null) as { sales?: ResellerSale[]; summary?: ResellerSalesSummary } | null;
    if (response?.ok && result?.sales && result.summary) {
      setSales(result.sales);
      setSalesSummary(result.summary);
    }
  }, []);

  useEffect(() => { void loadCustomers(); void loadStaff(); if (canViewSales) void loadSales(); }, [canViewSales, loadCustomers, loadSales, loadStaff]);

  async function checkout() {
    setBusy(true); setError("");
    const response = await fetch("/api/reseller/credits/checkout", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sku, quantity }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { checkoutUrl?: string; error?: string } | null;
    setBusy(false);
    if (!response?.ok || !result?.checkoutUrl) { setError(result?.error ?? "Checkout belum dapat dimulai."); return; }
    window.location.assign(result.checkoutUrl);
  }

  async function linkCustomer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setCustomerBusy(true); setCustomerError(""); setCustomerNotice("");
    const response = await fetch("/api/reseller/customers", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: customerEmail }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string; pendingApproval?: boolean; linked?: boolean } | null;
    setCustomerBusy(false);
    if (!response?.ok) { setCustomerError(result?.error ?? "Pelanggan belum dapat ditambahkan."); return; }
    setCustomerEmail("");
    setCustomerNotice(result?.linked ? "Akun pelanggan ini sudah tertaut." : result?.pendingApproval ? "Permintaan akses terkirim. Pelanggan perlu menyetujuinya dari dashboard mereka." : "Permintaan akses terkirim.");
    await loadCustomers();
    router.refresh();
  }

  async function activateInvitation(invitationId: string) {
    setActivatingId(invitationId); setCustomerError("");
    const response = await fetch("/api/reseller/activations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ invitationId }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setActivatingId("");
    if (!response?.ok) { setCustomerError(result?.error ?? "Aktivasi belum berhasil."); return; }
    await loadCustomers();
    router.refresh();
  }

  async function addStaff(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setStaffBusy(true); setStaffError(""); setStaffNotice("");
    const response = await fetch("/api/reseller/staff", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ email: staffEmail }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setStaffBusy(false);
    if (!response?.ok) { setStaffError(result?.error ?? "Staf belum dapat ditambahkan."); return; }
    setStaffEmail(""); setStaffNotice("Staf sudah diberi akses ke workspace reseller.");
    await loadStaff(); router.refresh();
  }

  async function removeStaff(id: string) {
    setRemovingStaffId(id); setStaffError(""); setStaffNotice("");
    const response = await fetch(`/api/reseller/staff/${id}`, { method: "DELETE" }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setRemovingStaffId("");
    if (!response?.ok) { setStaffError(result?.error ?? "Akses staf belum dapat dicabut."); return; }
    await loadStaff(); router.refresh();
  }

  async function recordSale(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setSaleBusy(true); setSaleError(""); setSaleNotice("");
    const response = await fetch("/api/reseller/sales", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        amountIdr: Number(saleAmount),
        description: saleDescription,
        ...(saleCustomerOrgId ? { customerOrgId: saleCustomerOrgId } : {}),
        ...(saleInvitationId ? { invitationId: saleInvitationId } : {}),
      }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setSaleBusy(false);
    if (!response?.ok) { setSaleError(result?.error ?? "Catatan penjualan belum tersimpan."); return; }
    setSaleAmount(""); setSaleDescription(""); setSaleInvitationId("");
    setSaleNotice("Catatan berhasil disimpan sebagai laporan reseller.");
    await loadSales();
  }

  async function voidSale(event: FormEvent<HTMLFormElement>, id: string) {
    event.preventDefault(); setVoidBusy(true); setVoidError("");
    const response = await fetch(`/api/reseller/sales/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ reason: voidReason }),
    }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setVoidBusy(false);
    if (!response?.ok) { setVoidError(result?.error ?? "Catatan belum dapat dikoreksi."); return; }
    setVoidingSaleId(""); setVoidReason("");
    await loadSales();
  }

  const selectedCustomer = customers.find((customer) => customer.organizationId === saleCustomerOrgId);

  return <div className="reseller-dashboard">
    <div className="dashboard-page-heading"><div><p className="dashboard-date">WORKSPACE MITRA</p><h1>{businessName} <span>✳</span></h1><p>Kelola kredit aktivasi dan pantau pembelianmu.</p></div><span className="status-pill status-pill--live"><i />Reseller disetujui</span></div>
    <div className="dashboard-stat-grid reseller-credit-grid"><div className="stat-card"><div className="stat-card-top"><span className="stat-icon stat-icon--sage"><Coins size={17} /></span><span className="stat-period">Basic</span></div><strong>{basicCredits.toLocaleString("id-ID")}</strong><span className="stat-label">Kredit aktivasi Basic</span></div><div className="stat-card"><div className="stat-card-top"><span className="stat-icon stat-icon--gold"><Sparkles size={17} /></span><span className="stat-period">Premium</span></div><strong>{premiumCredits.toLocaleString("id-ID")}</strong><span className="stat-label">Kredit aktivasi Premium</span></div><div className="stat-card"><div className="stat-card-top"><span className="stat-icon stat-icon--rose"><Users size={17} /></span><span className="stat-period">Pelanggan</span></div><strong>{customerCount.toLocaleString("id-ID")}</strong><span className="stat-label">Workspace pelanggan</span></div><div className="stat-card stat-card--soft"><div className="stat-card-top"><span className="stat-icon stat-icon--rose"><ShoppingBag size={17} /></span><span className="stat-period">Aktivasi</span></div><strong>{activationCount.toLocaleString("id-ID")}</strong><span className="stat-label">Kredit yang digunakan</span></div></div>
    <section className="dashboard-content-card reseller-customer-card">
      <div className="card-heading"><div><h2>Pelanggan dan aktivasi</h2><p>Tambahkan akun pelanggan, lalu terbitkan draft mereka dengan kredit reseller.</p></div></div>
      <form className="reseller-customer-form" onSubmit={linkCustomer}><label className="editor-field"><span className="field-label">Email akun pelanggan</span><input className="text-input" type="email" required maxLength={254} value={customerEmail} onChange={(event) => setCustomerEmail(event.target.value)} placeholder="nama@email.com" /></label><button type="submit" className="button button--dark" disabled={customerBusy}>{customerBusy ? "Menambahkan..." : "Tambahkan pelanggan"} <ArrowRight size={15} /></button></form>
      <p className="reseller-customer-hint">Pelanggan perlu memiliki akun TamuKita dan menyetujui permintaan akses dari dashboard mereka. Draft tetap dimiliki dan tersimpan di workspace pelanggan.</p>
      {customerNotice && <p className="reseller-customer-notice" role="status">{customerNotice}</p>}
      {customerError && <div className="editor-error" role="alert">{customerError}</div>}
      {customers.length === 0 ? <div className="dashboard-empty-state"><h3>Belum ada pelanggan tertaut</h3><p>Masukkan email akun pelanggan untuk mulai mengelola aktivasi.</p></div> : <div className="reseller-customer-list">{customers.map((customer) => <article className="reseller-customer-row" key={customer.organizationId}><div className="reseller-customer-heading"><div><h3>{customer.name}</h3><p>{customer.email}</p></div><span>{customer.invitations.length} undangan</span></div>{customer.invitations.length === 0 ? <p className="reseller-customer-hint">Minta pelanggan membuat dan melengkapi draft undangan dari dashboard mereka. Draft akan tampil di sini.</p> : <div className="reseller-customer-invitations">{customer.invitations.map((invitation) => <div className="reseller-customer-invitation" key={invitation.id}><div><b>{invitation.title}</b><small>{invitation.status === "PUBLISHED" ? `tamukita.io/${invitation.slug}` : "Draft belum diterbitkan"}</small></div>{invitation.status === "PUBLISHED" ? <span className="status-pill status-pill--live"><i />Aktif</span> : invitation.activationSku ? <button className="button button--outline button--small" type="button" disabled={Boolean(activatingId) || invitation.alreadyAssigned} onClick={() => void activateInvitation(invitation.id)}>{activatingId === invitation.id ? "Mengaktifkan..." : invitation.alreadyAssigned ? "Ditangani reseller lain" : `Aktifkan · ${invitation.activationSku === "BASIC_ACTIVATION" ? "Basic" : "Premium"}`}</button> : <span className="status-pill status-pill--draft"><i />Template belum didukung</span>}</div>)}</div>}</article>)}</div>}
    </section>
    <section className="reseller-topup-card"><div><span className="eyebrow">BELI KREDIT</span><h2>Isi saldo aktivasi.</h2><p>Kredit ditambahkan setelah pembayaran diverifikasi.</p><div className="reseller-credit-note"><CircleHelp size={15} /><span>Harga ditetapkan melalui konfigurasi server. Kredit tidak dapat ditarik atau dipindahkan.</span></div></div><div className="reseller-topup-form"><label className="editor-field"><span className="field-label">Jenis kredit</span><select className="text-input" value={sku} onChange={(event) => setSku(event.target.value as typeof sku)}><option value="BASIC_ACTIVATION">Basic · {basicUnitPrice ? currency.format(basicUnitPrice) : "harga belum diatur"} / unit</option><option value="PREMIUM_ACTIVATION">Premium · {premiumUnitPrice ? currency.format(premiumUnitPrice) : "harga belum diatur"} / unit</option></select></label><label className="editor-field"><span className="field-label">Jumlah unit</span><input className="text-input" type="number" min="1" max="100" value={quantity} onChange={(event) => setQuantity(Math.min(100, Math.max(1, Number(event.target.value))))} /></label><div className="reseller-total-row"><span>Total</span><b>{unitPrice ? currency.format(unitPrice * quantity) : "Belum tersedia"}</b></div>{error && <div className="editor-error" role="alert">{error}</div>}<button className="button button--dark" type="button" disabled={busy || !unitPrice} onClick={() => void checkout()}>{busy ? "Membuka checkout..." : "Lanjutkan pembayaran"} <ArrowRight size={15} /></button></div></section>
    {canManageStaff && <section className="dashboard-content-card reseller-staff-card"><div className="card-heading"><div><h2>Staf reseller</h2><p>Staf dapat mengelola pelanggan dan aktivasi. Top up tetap khusus pemilik atau admin.</p></div></div><form className="reseller-customer-form" onSubmit={addStaff}><label className="editor-field"><span className="field-label">Email akun staf</span><input className="text-input" type="email" required maxLength={254} value={staffEmail} onChange={(event) => setStaffEmail(event.target.value)} placeholder="staf@email.com" /></label><button className="button button--dark" type="submit" disabled={staffBusy}>{staffBusy ? "Menambahkan..." : "Tambah staf"} <ArrowRight size={15} /></button></form><p className="reseller-customer-hint">Staf harus sudah memiliki akun TamuKita. Pemilik dapat mencabut akses dari daftar ini.</p>{staffError && <div className="editor-error" role="alert">{staffError}</div>}{staffNotice && <p className="reseller-customer-notice" role="status">{staffNotice}</p>}{staff.length === 0 ? <div className="dashboard-empty-state"><h3>Belum ada staf</h3><p>Tambahkan anggota tim untuk membantu menangani pelanggan.</p></div> : staff.map((member) => <div className="reseller-staff-row" key={member.id}><div><b>{member.name}</b><small>{member.email}</small></div><button className="button button--outline button--small" type="button" disabled={Boolean(removingStaffId)} onClick={() => void removeStaff(member.id)}>{removingStaffId === member.id ? "Mencabut..." : "Cabut akses"}</button></div>)}</section>}
    {canViewSales && <section className="dashboard-content-card reseller-sales-card">
      <div className="card-heading"><div><h2>Laporan penjualan</h2><p>Catat nilai penjualan yang kamu laporkan kepada pelanggan.</p></div><span className="reseller-sales-label"><ReceiptText size={14} /> Laporan reseller</span></div>
      <p className="reseller-sales-disclaimer">Data ini diinput oleh reseller dan belum diverifikasi TamuKita. Pembayaran pelanggan tidak diproses melalui laporan ini. Ringkasan menghitung semua catatan aktif; daftar menampilkan 100 catatan terbaru.</p>
      <div className="reseller-sales-summary">
        <div><span>Total aktif tercatat</span><strong>{currency.format(salesSummary.activeTotalIdr)}</strong><small>{salesSummary.activeSaleCount.toLocaleString("id-ID")} catatan</small></div>
        <div><span>Dicatat bulan ini</span><strong>{currency.format(salesSummary.monthToDateIdr)}</strong><small>Berdasarkan tanggal input</small></div>
      </div>
      <form className="reseller-sales-form" onSubmit={recordSale}>
        <label className="editor-field"><span className="field-label">Deskripsi penjualan</span><input className="text-input" required minLength={2} maxLength={160} value={saleDescription} onChange={(event) => setSaleDescription(event.target.value)} placeholder="Contoh: Paket undangan pernikahan" /></label>
        <label className="editor-field"><span className="field-label">Nilai yang dilaporkan (IDR)</span><input className="text-input" type="number" required min="1" max="2147483647" step="1" value={saleAmount} onChange={(event) => setSaleAmount(event.target.value)} placeholder="Contoh: 1500000" /></label>
        <label className="editor-field"><span className="field-label">Pelanggan tertaut <small>opsional</small></span><select className="text-input" value={saleCustomerOrgId} onChange={(event) => { setSaleCustomerOrgId(event.target.value); setSaleInvitationId(""); }}><option value="">Tanpa pelanggan tertaut</option>{customers.map((customer) => <option key={customer.organizationId} value={customer.organizationId}>{customer.name}</option>)}</select></label>
        <label className="editor-field"><span className="field-label">Undangan <small>opsional</small></span><select className="text-input" value={saleInvitationId} disabled={!selectedCustomer || selectedCustomer.invitations.length === 0} onChange={(event) => setSaleInvitationId(event.target.value)}><option value="">Tanpa undangan tertaut</option>{selectedCustomer?.invitations.map((invitation) => <option key={invitation.id} value={invitation.id}>{invitation.title}</option>)}</select></label>
        <div className="reseller-sales-submit">{saleError && <div className="editor-error" role="alert">{saleError}</div>}{saleNotice && <p className="reseller-customer-notice" role="status">{saleNotice}</p>}<button className="button button--dark" type="submit" disabled={saleBusy}>{saleBusy ? "Menyimpan..." : "Catat penjualan"} <ArrowRight size={15} /></button></div>
      </form>
      {sales.length === 0 ? <div className="dashboard-empty-state"><h3>Belum ada laporan penjualan</h3><p>Catatan yang kamu buat akan tampil di sini.</p></div> : <div className="reseller-sales-list">{sales.map((sale) => <article className="reseller-sale-row" key={sale.id}>
        <div className="reseller-sale-details"><b>{sale.description}</b><small>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(sale.createdAt))}{sale.customerName ? ` · ${sale.customerName}` : ""}{sale.invitationTitle ? ` · ${sale.invitationTitle}` : ""}</small>{sale.voidedAt && <small className="reseller-sale-void-reason">Dibatalkan: {sale.voidReason}</small>}</div>
        <strong className={sale.voidedAt ? "is-voided" : ""}>{currency.format(sale.amountIdr)}</strong>
        {sale.voidedAt ? <span className="reseller-sale-voided"><Ban size={13} /> Dibatalkan</span> : <button className="button button--outline button--small" type="button" onClick={() => { setVoidingSaleId(sale.id); setVoidReason(""); setVoidError(""); }}>Koreksi</button>}
        {voidingSaleId === sale.id && <form className="reseller-sale-void-form" onSubmit={(event) => void voidSale(event, sale.id)}><label className="editor-field"><span className="field-label">Alasan koreksi</span><input className="text-input" required minLength={3} maxLength={240} value={voidReason} onChange={(event) => setVoidReason(event.target.value)} placeholder="Jelaskan mengapa catatan dibatalkan" /></label>{voidError && <div className="editor-error" role="alert">{voidError}</div>}<div><button className="button button--outline button--small" type="button" disabled={voidBusy} onClick={() => { setVoidingSaleId(""); setVoidError(""); }}>Kembali</button><button className="button button--dark button--small" type="submit" disabled={voidBusy}>{voidBusy ? "Menyimpan..." : "Batalkan catatan"}</button></div></form>}
      </article>)}</div>}
    </section>}
    <section className="dashboard-content-card reseller-order-card"><div className="card-heading"><div><h2>Riwayat kredit</h2><p>Order berubah menjadi lunas setelah pembayaran diverifikasi.</p></div></div>{orders.length === 0 ? <div className="dashboard-empty-state"><h3>Belum ada pembelian</h3><p>Top up kredit akan muncul di daftar ini.</p></div> : orders.map((order) => <div className="reseller-order-row" key={order.id}><div><b>{order.units} kredit {order.sku === "BASIC_ACTIVATION" ? "Basic" : "Premium"}</b><small>{new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeZone: "Asia/Jakarta" }).format(new Date(order.createdAt))}</small></div><strong>{currency.format(order.totalAmount)}</strong><span className={`status-pill ${order.status === "PAID" ? "status-pill--live" : "status-pill--draft"}`}><i />{order.status === "PAID" ? <><CheckCircle2 size={12} /> Lunas</> : order.status === "EXPIRED" || order.status === "CANCELED" ? "Kedaluwarsa" : "Menunggu"}</span></div>)}</section>
  </div>;
}

export function CustomerResellerRequests({ requests, activeResellers }: { requests: { id: string; resellerName: string }[]; activeResellers: { id: string; resellerName: string }[] }) {
  const router = useRouter();
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [hiddenIds, setHiddenIds] = useState<string[]>([]);

  async function decide(id: string, decision: "APPROVE" | "DECLINE" | "REVOKE") {
    setBusyId(id); setError("");
    const response = await fetch(`/api/reseller/customer-requests/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ decision }) }).catch(() => null);
    const result = await response?.json().catch(() => null) as { error?: string } | null;
    setBusyId("");
    if (!response?.ok) { setError(result?.error ?? "Permintaan belum dapat diproses."); return; }
    setHiddenIds((current) => [...current, id]);
    router.refresh();
  }

  const visibleRequests = requests.filter((request) => !hiddenIds.includes(request.id));
  const visibleActiveResellers = activeResellers.filter((reseller) => !hiddenIds.includes(reseller.id));
  if (visibleRequests.length === 0 && visibleActiveResellers.length === 0) return null;
  return <section className="dashboard-content-card customer-reseller-requests">{visibleRequests.length > 0 && <><div className="card-heading"><div><h2>Permintaan akses reseller</h2><p>Setujui jika kamu ingin mitra ini melihat draft dan mengelola aktivasi.</p></div></div>{visibleRequests.map((request) => <div className="customer-reseller-request" key={request.id}><div><b>{request.resellerName}</b><small>Reseller meminta akses ke workspace undanganmu.</small></div><div className="customer-reseller-actions"><button type="button" className="button button--outline button--small" disabled={Boolean(busyId)} onClick={() => void decide(request.id, "DECLINE")}>{busyId === request.id ? "Menyimpan..." : "Tolak"}</button><button type="button" className="button button--dark button--small" disabled={Boolean(busyId)} onClick={() => void decide(request.id, "APPROVE")}>{busyId === request.id ? "Menyimpan..." : "Setujui"}</button></div></div>)}</>}{visibleActiveResellers.length > 0 && <><div className="card-heading customer-reseller-active-heading"><div><h2>Reseller yang tertaut</h2><p>Kamu dapat mencabut akses kapan saja.</p></div></div>{visibleActiveResellers.map((reseller) => <div className="customer-reseller-request" key={reseller.id}><div><b>{reseller.resellerName}</b><small>Dapat melihat draft dan menerbitkan undangan dengan kredit.</small></div><button type="button" className="button button--outline button--small" disabled={Boolean(busyId)} onClick={() => void decide(reseller.id, "REVOKE")}>{busyId === reseller.id ? "Mencabut..." : "Cabut akses"}</button></div>)}</>}{error && <div className="editor-error" role="alert">{error}</div>}</section>;
}
