import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TemplateCard } from "@/components/template-card";
import { getPublishedTemplateCatalog } from "@/lib/template-catalog";
import { recordPlatformView } from "@/lib/platform-analytics";

export const metadata: Metadata = { title: "Koleksi Template" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage() {
  const catalog = await getPublishedTemplateCatalog();
  after(() => recordPlatformView("template_catalog_views"));
  return (
    <><SiteHeader /><main className="catalog-page"><div className="container"><div className="breadcrumbs breadcrumbs--site"><Link href="/">Beranda</Link><span>/</span><span>Template</span></div><div className="catalog-heading"><div><span className="eyebrow">DIRANCANG DENGAN HATI</span><h1>Temukan desain<br /><em>untuk ceritamu.</em></h1></div><p>Setiap momen punya warna dan rasanya sendiri.<br />Mulai dengan desain yang paling terasa dekat.</p></div><div className="catalog-toolbar"><div className="filter-pills"><span className="filter-pill is-selected">Semua <span>{catalog.length}</span></span><span className="filter-pill">Pernikahan</span></div><span className="sort-button"><SlidersHorizontal size={15} /> {catalog.length} template tersedia</span></div><div className="template-grid template-grid--catalog">{catalog.map((template) => <TemplateCard key={template.slug} template={template} />)}</div>{catalog.length === 0 && <div className="dashboard-empty-state"><h3>Template sedang disiapkan</h3><p>Silakan kembali lagi setelah katalog diperbarui.</p></div>}<div className="catalog-note"><span className="catalog-note-icon">✦</span><span><b>Baru mulai?</b> Kamu bisa melihat-lihat dulu, lalu pilih template kapan saja.</span><Link href="/dashboard/invitations/new/edit">Coba editor <ArrowLeft size={15} /></Link></div></div></main><SiteFooter /></>
  );
}
