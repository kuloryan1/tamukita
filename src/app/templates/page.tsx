import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { ArrowLeft } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TemplateCard } from "@/components/template-card";
import { MarketplaceVisitTracker } from "@/components/marketplace-visit-tracker";
import { getPublishedTemplateCatalog } from "@/lib/template-catalog";
import { recordPlatformMetric } from "@/lib/platform-analytics";

export const metadata: Metadata = { title: "Koleksi Template" };
export const dynamic = "force-dynamic";

export default async function TemplatesPage({ searchParams }: { searchParams: Promise<{ category?: string }> }) {
  const catalog = await getPublishedTemplateCatalog();
  const categories = [...new Set(catalog.map((template) => template.category))];
  const { category: requestedCategory } = await searchParams;
  const selectedCategory = categories.find((category) => category === requestedCategory);
  const visibleCatalog = selectedCategory ? catalog.filter((template) => template.category === selectedCategory) : catalog;
  const categoryCounts = new Map(categories.map((category) => [category, catalog.filter((template) => template.category === category).length]));
  after(() => recordPlatformMetric("template_catalog_views"));
  return (
    <><SiteHeader /><MarketplaceVisitTracker /><main className="catalog-page"><div className="container"><div className="breadcrumbs breadcrumbs--site"><Link href="/">Beranda</Link><span>/</span><span>Template</span></div><div className="catalog-heading"><div><span className="eyebrow">KOLEKSI TEMA TAMUKITA</span><h1>Pilih tema<br /><em>untuk ceritamu.</em></h1></div><p>Setiap momen punya warna dan rasanya sendiri.<br />Temukan desain yang terasa pas untuk hari istimewamu.</p></div><div className="catalog-toolbar"><nav className="filter-pills" aria-label="Kategori template"><Link href="/templates" className={`filter-pill${selectedCategory ? "" : " is-selected"}`} aria-current={selectedCategory ? undefined : "page"}>Semua <span>{catalog.length}</span></Link>{categories.map((category) => <Link key={category} href={`/templates?category=${encodeURIComponent(category)}`} className={`filter-pill${selectedCategory === category ? " is-selected" : ""}`} aria-current={selectedCategory === category ? "page" : undefined}>{category} <span>{categoryCounts.get(category)}</span></Link>)}</nav><span className="catalog-result-count" aria-live="polite">{visibleCatalog.length} desain untuk dipilih</span></div>{visibleCatalog.length > 0 ? <div className="template-grid template-grid--catalog">{visibleCatalog.map((template) => <TemplateCard key={template.slug} template={template} />)}</div> : <div className="dashboard-empty-state"><h3>Template sedang disiapkan</h3><p>Silakan kembali lagi setelah katalog diperbarui.</p></div>}<div className="catalog-note"><span className="catalog-note-icon">✦</span><span><b>Baru mulai?</b> Kamu bisa melihat-lihat dulu, lalu pilih template kapan saja.</span><Link href="/dashboard/invitations/new/edit">Coba editor <ArrowLeft size={15} /></Link></div></div></main><SiteFooter /></>
  );
}
