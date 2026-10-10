import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, Heart, ShieldCheck, Smartphone } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TemplateArtwork } from "@/components/template-artwork";
import { formatRupiah, getTemplate } from "@/lib/templates";
import { getPublishedTemplateCatalog } from "@/lib/template-catalog";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const template = getTemplate(slug);
  return { title: template ? `${template.name} — Template Undangan` : "Template tidak ditemukan" };
}

export default async function TemplateDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const catalog = await getPublishedTemplateCatalog();
  const template = catalog.find((candidate) => candidate.slug === slug);
  if (!template) notFound();
  return (
    <><SiteHeader /><main className="detail-page"><div className="container"><div className="breadcrumbs breadcrumbs--site"><Link href="/">Beranda</Link><span>/</span><Link href="/templates">Template</Link><span>/</span><span>{template.name}</span></div><div className="detail-grid"><div className="detail-artwork-wrap"><TemplateArtwork template={template} large /><div className="detail-thumbnail-row"><div className="detail-thumb detail-thumb--active"><TemplateArtwork template={template} /></div><div className="detail-thumb detail-thumb--second"><TemplateArtwork template={{ ...template, style: template.style === "royal" ? "cream" : template.style === "cream" ? "sage" : "royal" }} /></div><div className="detail-thumb detail-thumb--third"><span className="detail-device"><Smartphone size={25} /></span><span>Tampilan<br />mobile-friendly</span></div></div></div><div className="detail-copy"><Link href="/templates" className="back-link"><ArrowLeft size={15} /> Kembali ke koleksi</Link><div className="detail-label"><span>{template.category}</span><span>·</span><span>Siap dipersonalisasi</span></div><h1>{template.name}</h1><p className="detail-subtitle">{template.subtitle}</p><p className="detail-description">{template.description} Tambahkan detail acaramu, pilih foto favorit, dan bagikan ke orang-orang yang kamu sayangi.</p><div className="detail-price-block"><strong>{formatRupiah(template.price)}</strong><span>Lisensi satu kali per undangan · Checkout Xendit</span></div><div className="detail-features"><span><Check size={15} /> Bisa diakses di ponsel</span><span><Check size={15} /> RSVP aktif setelah publikasi</span><span><Check size={15} /> Bisa diedit setelah terbit</span></div><Link href={`/dashboard/invitations/new/edit?new=1&template=${template.slug}`} className="button button--dark button--wide">Gunakan template ini <ArrowRight size={16} /></Link><div className="detail-safe-note"><ShieldCheck size={16} /><span>Undangan terbit setelah pembayaran berhasil dikonfirmasi oleh webhook Xendit.</span></div><div className="detail-tags">{template.tags.map((tag) => <span key={tag}><Heart size={11} /> {tag}</span>)}</div></div></div></div></main><SiteFooter /></>
  );
}
