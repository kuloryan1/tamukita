import { Activity, Bell, CalendarDays, CreditCard, ImageOff, LayoutTemplate, Store, Users } from "lucide-react";

type Metric = { label: string; value: number | string; detail: string; icon: "users" | "store" | "invite" | "payment" | "template" | "media" | "notification" };
type AdminOrder = { id: string; status: string; totalAmount: number; currency: string; createdAt: string; buyer: string; email: string; organization: string; item: string; paymentStatus: string };
type AdminAudit = { id: string; action: string; targetType: string; targetId: string | null; createdAt: string; actor: string; organization: string };

function metricIcon(icon: Metric["icon"]) {
  if (icon === "users") return <Users size={17} />;
  if (icon === "store") return <Store size={17} />;
  if (icon === "invite") return <CalendarDays size={17} />;
  if (icon === "payment") return <CreditCard size={17} />;
  if (icon === "template") return <LayoutTemplate size={17} />;
  if (icon === "notification") return <Bell size={17} />;
  return <ImageOff size={17} />;
}

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("id-ID", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jakarta" }).format(new Date(value));
}

const currency = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 });

export function AdminOverview({ metrics, orders, audit }: { metrics: Metric[]; orders: AdminOrder[]; audit: AdminAudit[] }) {
  return <>
    <section className="admin-metric-grid" aria-label="Ringkasan platform">
      {metrics.map((metric) => <article className="admin-metric-card" key={metric.label}><span className="admin-metric-icon">{metricIcon(metric.icon)}</span><span className="admin-metric-label">{metric.label}</span><strong>{typeof metric.value === "number" ? metric.value.toLocaleString("id-ID") : metric.value}</strong><small>{metric.detail}</small></article>)}
    </section>
    <div className="admin-overview-grid">
      <section className="dashboard-content-card admin-overview-card"><div className="card-heading"><div><h2>Order terbaru</h2><p>Order kredit, lisensi template, dan aktivasi reseller.</p></div></div>{orders.length === 0 ? <div className="dashboard-empty-state"><h3>Belum ada order</h3><p>Order baru akan tercatat di sini.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Pemesan</th><th>Item</th><th>Nominal</th><th>Status</th><th>Dibuat</th></tr></thead><tbody>{orders.map((order) => <tr key={order.id}><td><b>{order.buyer}</b><small>{order.email || order.organization}</small></td><td><span>{order.item}</span><small>{order.organization}</small></td><td>{currency.format(order.totalAmount)}</td><td><span className={`status-pill ${order.status === "PAID" ? "status-pill--live" : "status-pill--draft"}`}><i />{order.status === "PAID" ? "Lunas" : order.status === "PENDING" ? `Menunggu · ${order.paymentStatus}` : order.status}</span></td><td>{dateLabel(order.createdAt)}</td></tr>)}</tbody></table></div>}</section>
      <section className="dashboard-content-card admin-overview-card"><div className="card-heading"><div><h2>Audit terbaru</h2><p>Perubahan penting yang tercatat di seluruh workspace.</p></div><Activity size={16} /></div>{audit.length === 0 ? <div className="dashboard-empty-state"><h3>Belum ada aktivitas</h3><p>Aktivitas admin dan pelanggan akan dicatat di sini.</p></div> : <div className="admin-audit-list">{audit.map((entry) => <article className="admin-audit-row" key={entry.id}><span className="admin-audit-dot" /><div><b>{entry.action.replaceAll(".", " · ")}</b><small>{entry.targetType}{entry.targetId ? ` · ${entry.targetId.slice(0, 8)}` : ""} · {entry.organization}</small><small>{entry.actor} · {dateLabel(entry.createdAt)}</small></div></article>)}</div>}</section>
    </div>
  </>;
}
