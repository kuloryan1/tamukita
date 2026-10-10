type Metric = { label: string; value: string; detail: string };
type Channel = { label: string; count: number; amount: string; note: string };
type Template = { name: string; slug: string; version: string; publishedCount: number };

export function AdminAnalytics({
  metrics,
  channels,
  templates,
  periodLabel,
}: {
  metrics: Metric[];
  channels: Channel[];
  templates: Template[];
  periodLabel: string;
}) {
  return <>
    <p className="admin-analytics-period">Periode data: <strong>{periodLabel}</strong>. Konversi checkout memakai order final; order yang masih menunggu tidak masuk penyebut. Asal kanal akuisisi belum dikumpulkan.</p>
    <section className="admin-metric-grid admin-analytics-metrics" aria-label="Metrik bisnis 30 hari">
      {metrics.map((metric) => <article className="admin-metric-card" key={metric.label}><span className="admin-metric-label">{metric.label}</span><strong>{metric.value}</strong><small>{metric.detail}</small></article>)}
    </section>
    <section className="dashboard-content-card admin-analytics-card">
      <div className="card-heading"><div><h2>Nilai per saluran</h2><p>Pembayaran platform dipisahkan dari penjualan reseller yang mereka catat sendiri.</p></div></div>
      <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Saluran</th><th>Order / catatan</th><th>Nilai IDR</th><th>Keterangan</th></tr></thead><tbody>
        {channels.map((channel) => <tr key={channel.label}><td><b>{channel.label}</b></td><td>{channel.count.toLocaleString("id-ID")}</td><td>{channel.amount}</td><td>{channel.note}</td></tr>)}
      </tbody></table></div>
    </section>
    <section className="dashboard-content-card admin-analytics-card">
      <div className="card-heading"><div><h2>Template paling banyak dipublikasikan</h2><p>Publikasi undangan per versi template dalam periode ini.</p></div></div>
      {templates.length === 0 ? <div className="dashboard-empty-state"><h3>Belum ada publikasi baru</h3><p>Template akan muncul setelah undangan dipublikasikan.</p></div> : <div className="admin-table-wrap"><table className="admin-table"><thead><tr><th>Template</th><th>Slug</th><th>Versi</th><th>Publikasi</th></tr></thead><tbody>
        {templates.map((template) => <tr key={`${template.slug}-${template.version}`}><td><b>{template.name}</b></td><td>{template.slug}</td><td>{template.version}</td><td>{template.publishedCount.toLocaleString("id-ID")}</td></tr>)}
      </tbody></table></div>}
    </section>
  </>;
}
