import Link from "next/link";
import { ArrowRight, ArrowUpRight, Check, Heart, MoveUpRight, Play, Sparkles, WandSparkles } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TemplateCard } from "@/components/template-card";
import { InvitationPreview } from "@/components/invitation-preview";
import { templates } from "@/lib/templates";
import { createInitialDraft } from "@/lib/invitations";

const steps = [
  { number: "01", title: "Pilih desain yang kamu suka", text: "Temukan template yang terasa paling kamu. Semuanya dibuat untuk mudah dibaca di layar ponsel." },
  { number: "02", title: "Isi cerita dan detail acaramu", text: "Nama, waktu, lokasi, dan foto. Preview berubah seketika saat kamu mulai mengisi." },
  { number: "03", title: "Bagikan ke orang tersayang", text: "Satu tautan untuk semua. Kirim undangan, kumpulkan RSVP, dan nantikan hari bahagiamu." },
];

export default function HomePage() {
  const draft = createInitialDraft();
  return (
    <>
      <SiteHeader />
      <main>
        <section className="hero-section">
          <div className="container hero-grid">
            <div className="hero-copy">
              <div className="eyebrow eyebrow--gold"><span className="eyebrow-flower">✳</span> HARI ISTIMEWA, CERITA YANG DEKAT</div>
              <h1>Undangan yang terasa <em>seperti kamu.</em></h1>
              <p className="hero-description">Bagikan kabar bahagiamu lewat undangan digital yang personal, indah, dan mudah diingat.</p>
              <div className="hero-actions">
                <Link href="/dashboard/invitations/new/edit" className="button button--dark">Buat undanganmu <ArrowRight size={16} /></Link>
                <Link href="/templates" className="button button--light"><span className="button-play"><Play size={11} fill="currentColor" /></span> Lihat koleksi</Link>
              </div>
              <div className="hero-social-proof">
                <span className="template-count-badge" aria-hidden="true">{templates.length}</span>
                <div><strong>{templates.length} desain siap dipilih</strong><small>Pilih yang paling terasa kamu</small></div>
              </div>
            </div>
            <div className="hero-visual">
              <div className="hero-blush" />
              <div className="hero-preview-wrap"><InvitationPreview draft={draft} /></div>
              <div className="floating-note floating-note--top"><span className="floating-icon"><Heart size={15} fill="currentColor" /></span><span><b>Dibuat dengan cinta</b><small>oleh Nara & Dimas</small></span></div>
              <div className="floating-note floating-note--bottom"><span className="floating-check"><Check size={14} /></span><span><b>Sudah siap dibagikan</b><small>Undangan digitalmu, selesai!</small></span><ArrowUpRight size={15} className="floating-arrow" /></div>
              <span className="hero-stamp">your<br />day, your<br /><i>story.</i></span>
              <span className="hero-sparkle hero-sparkle--a">✳</span><span className="hero-sparkle hero-sparkle--b">✧</span>
            </div>
          </div>
          <div className="container hero-bottomline"><span><span className="tiny-dot" /> Dibuat untuk momen yang berarti</span><span>BERBAGI BAHAGIA, SATU TAUTAN</span></div>
        </section>

        <section className="template-section section-pad" id="template">
          <div className="container">
            <div className="section-heading-row"><div><span className="eyebrow">KOLEKSI PILIHAN</span><h2>Mulai dari desain<br />yang <em>paling kamu.</em></h2></div><p>Setiap template punya cerita kecilnya sendiri.<br />Temukan yang terasa pas untuk harimu.</p></div>
            <div className="template-grid">{templates.map((template) => <TemplateCard key={template.slug} template={template} />)}</div>
            <div className="section-link-row"><span className="soft-note"><Sparkles size={15} /> {templates.length} gaya untuk ceritamu</span><Link href="/templates" className="text-link text-link--arrow">Lihat semua template <MoveUpRight size={15} /></Link></div>
          </div>
        </section>

        <section className="how-section section-pad" id="cara-kerja">
          <div className="container how-grid">
            <div className="how-intro"><span className="eyebrow">SIMPLE, DARI AWAL SAMPAI BAGI</span><h2>Hari istimewamu,<br /><em>dibuat mudah.</em></h2><p>Tak perlu bingung. Kamu tinggal pilih, isi, lalu bagikan. Semuanya nyaman dilakukan dari ponsel.</p><Link href="/dashboard/invitations/new/edit" className="button button--outline">Mulai sekarang <ArrowRight size={16} /></Link><div className="handwritten-note"><span>semudah itu!</span><span className="note-arrow">↗</span></div></div>
            <div className="steps-list">{steps.map((step, index) => <div className="step-item" key={step.number}><div className={`step-number${index === 1 ? " step-number--warm" : ""}`}>{step.number}</div><div><h3>{step.title}</h3><p>{step.text}</p></div><span className="step-arrow">↗</span></div>)}</div>
          </div>
        </section>

        <section className="editor-promo-section">
          <div className="container promo-card"><div className="promo-orbit promo-orbit--one" /><div className="promo-orbit promo-orbit--two" /><div className="promo-content"><span className="eyebrow eyebrow--light"><WandSparkles size={14} /> EDITOR YANG MUDAH</span><h2>Semua detail kecil,<br />jadi <em>bagian ceritamu.</em></h2><p>Ganti foto, atur detail acara, dan lihat hasilnya langsung. Tak perlu paham desain.</p><Link href="/dashboard/invitations/new/edit" className="button button--cream">Coba editor undangan <ArrowRight size={16} /></Link></div><div className="promo-preview"><div className="phone-frame"><div className="phone-notch" /><InvitationPreview draft={draft} /></div><div className="promo-mini-tag"><span className="mini-check"><Check size={13} /></span><span><b>Preview langsung</b><small>Perubahan terlihat seketika</small></span></div></div></div>
        </section>

        <section className="closing-section section-pad"><div className="container closing-inner"><div className="closing-flower">✳</div><span className="eyebrow">MOMENMU LAYAK DIRAYAKAN</span><h2>Mulai cerita indahmu<br /><em>bersama TamuKita.</em></h2><Link href="/dashboard/invitations/new/edit" className="button button--dark">Buat undangan sekarang <ArrowRight size={16} /></Link><span className="closing-micro">Tanpa perlu kartu kredit untuk mulai</span></div></section>
      </main>
      <SiteFooter />
    </>
  );
}
