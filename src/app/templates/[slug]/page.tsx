import type { Metadata } from "next";
import Link from "next/link";
import { after } from "next/server";
import { notFound } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowRight, Check, Heart, ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { InvitationPreview } from "@/components/invitation-preview";
import { createDemoDraft } from "@/lib/invitations";
import { formatRupiah, getTemplate } from "@/lib/templates";
import { getPublishedTemplateCatalog } from "@/lib/template-catalog";
import { recordPlatformMetric } from "@/lib/platform-analytics";

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
  const createInvitationPath = `/dashboard/invitations/new/edit?new=1&template=${encodeURIComponent(template.slug)}`;
  const demoHref = `/templates/${encodeURIComponent(template.slug)}/demo?design=reference`;
  const useTemplateHref = (await auth())?.user?.id
    ? createInvitationPath
    : `/login?callbackUrl=${encodeURIComponent(createInvitationPath)}`;
  const demoDraft = {
    ...createDemoDraft(),
    templateId: template.slug,
    templateVersion: template.version,
    eventDate: "2026-11-21",
    eventTime: "18:00",
    venue: "Gedung Pariwisata Surabaya",
    address: "Surabaya, Jawa Timur",
    mapsUrl: "https://www.google.com/maps/search/?api=1&query=Gedung+Pariwisata+Surabaya",
    story: "Dengan penuh syukur, kami mengundang Anda untuk merayakan hari istimewa ini bersama.",
  };
  after(() => recordPlatformMetric("template_detail_views"));

  return (
    <>
      <SiteHeader />
      <main className="detail-page">
        <div className="container">
          <div className="breadcrumbs breadcrumbs--site">
            <Link href="/">Beranda</Link><span>/</span><Link href="/templates">Template</Link><span>/</span><span>{template.name}</span>
          </div>
          <div className="detail-grid">
            <div className="detail-artwork-wrap">
              <div className="detail-live-preview">
                <div className="detail-live-preview-heading"><span>CONTOH UNDANGAN</span><span>Pratinjau desain</span></div>
                <InvitationPreview draft={demoDraft} full mode="example" template={template} />
              </div>
              <Link href={demoHref} className="detail-preview-open">Lihat demo lengkap <ArrowRight size={14} /></Link>
            </div>
            <div className="detail-copy">
              <Link href="/templates" className="back-link"><ArrowLeft size={15} /> Kembali ke koleksi</Link>
              <div className="detail-label"><span>{template.category}</span><span>·</span><span>Siap dipersonalisasi</span></div>
              <h1>{template.name}</h1>
              <p className="detail-subtitle">{template.subtitle}</p>
              <p className="detail-description">{template.description} Tambahkan detail acaramu, pilih foto favorit, dan bagikan ke orang-orang yang kamu sayangi.</p>
              <div className="detail-price-block"><strong>{formatRupiah(template.price)}</strong><span>Lisensi satu kali per undangan · Pembayaran terverifikasi</span></div>
              <div className="detail-features">
                <span><Check size={15} /> Bisa diakses di ponsel</span>
                <span><Check size={15} /> RSVP aktif setelah publikasi</span>
                <span><Check size={15} /> Bisa diedit setelah terbit</span>
              </div>
              <Link href={useTemplateHref} className="button button--dark button--wide">Gunakan template ini <ArrowRight size={16} /></Link>
              <Link href={demoHref} className="button button--outline button--wide detail-demo-button">Buka demo undangan <ArrowRight size={15} /></Link>
              <Link href="#template-demo" className="detail-demo-link">Tentang demo ini <ArrowDown size={14} /></Link>
              <div className="detail-safe-note"><ShieldCheck size={16} /><span>Undangan terbit setelah pembayaran berhasil diverifikasi.</span></div>
              <div className="detail-tags">{template.tags.map((tag) => <span key={tag}><Heart size={11} /> {tag}</span>)}</div>
            </div>
          </div>
          <section className="detail-demo-section" id="template-demo" aria-labelledby="template-demo-title">
            <div className="detail-demo-heading">
              <span className="eyebrow">DEMO AMAN DICOBA</span>
              <h2 id="template-demo-title">Lihat seperti tamu melihat undangan</h2>
              <p>Demo memakai nama Ryan Pratam &amp; Dwi Wulan Maulida dan detail acara contoh. RSVP pada demo tidak mengirim atau menyimpan data.</p>
            </div>
            <div className="detail-demo-preview detail-demo-cta">
              <Link href={demoHref} className="button button--dark">Buka demo {template.name} <ArrowRight size={15} /></Link>
            </div>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
