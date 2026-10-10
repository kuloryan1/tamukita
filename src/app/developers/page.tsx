import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, BadgeCheck, Code2, GitPullRequest, ShieldCheck } from "lucide-react";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { TemplateSubmissionForm } from "@/components/template-submission-form";
import { TEMPLATE_SDK_VERSION } from "@/lib/template-sdk";

export const metadata: Metadata = { title: "Dokumentasi Developer Template" };

const componentExample = `import type { TemplateRenderProps } from "@/lib/template-sdk";

export function GardenStory({ draft }: TemplateRenderProps) {
  return (
    <article className="garden-story">
      <p>{draft.eventKind}</p>
      <h1>{draft.hostOne} & {draft.hostTwo}</h1>
      <time>{draft.eventDate}</time>
    </article>
  );
}`;

export default function DevelopersPage() {
  return (
    <>
      <SiteHeader />
      <main className="developer-docs-page">
        <div className="container">
          <div className="breadcrumbs breadcrumbs--site"><Link href="/">Beranda</Link><span>/</span><span>Developer</span></div>
          <header className="developer-docs-hero">
            <span className="eyebrow">TAMUKITA TEMPLATE SDK · v{TEMPLATE_SDK_VERSION}</span>
            <h1>Bangun desain yang<br /><em>mudah dipakai.</em></h1>
            <p>Template dengan desain React khusus masuk melalui pull request ke repository. CI memeriksa kontrak schema, renderer, tipe, dan build sebelum review konten oleh admin.</p>
            <Link className="button button--dark" href="#developer-contribution">Panduan kontribusi <ArrowRight size={15} /></Link>
          </header>

          <div className="developer-docs-grid">
            <section className="developer-docs-card developer-docs-card--code">
              <div className="developer-docs-card-heading"><Code2 size={17} /><div><b>Komponen React</b><small>Typed props dari Template SDK v{TEMPLATE_SDK_VERSION}</small></div></div>
              <pre><code>{componentExample}</code></pre>
            </section>
            <section className="developer-docs-card">
              <div className="developer-docs-card-heading"><BadgeCheck size={17} /><div><b>Kontrak editor</b><small>Schema tetap divalidasi di server.</small></div></div>
              <ul><li>Manifest mendefinisikan versi, harga, fitur, kategori, dan schema.</li><li>Field schema harus cocok dengan data undangan yang divalidasi server.</li><li>Renderer harus mengakomodasi preview editor, contoh, serta undangan publik.</li><li>Setiap perubahan visual menaikkan semver dan tidak mengubah versi lama.</li></ul>
            </section>
            <section className="developer-docs-card" id="developer-contribution">
              <div className="developer-docs-card-heading"><GitPullRequest size={17} /><div><b>Kontribusi dan review</b><small>Template baru menjadi kandidat, bukan langsung aktif.</small></div></div>
              <ol><li>Tambahkan manifest bertipe ke `src/lib/templates.ts` dan komponen TSX di `src/templates/&lt;slug&gt;/index.tsx`.</li><li>Daftarkan slug/semver di `src/templates/registry.ts` dengan `requiresAdminReview: true`.</li><li>Buka pull request; CI menjalankan validasi Prisma, typecheck, QA renderer, dan production build.</li><li>Setelah deployment, kandidat masuk ke antrean admin untuk ditinjau dan diterbitkan.</li><li>Versi aktif tetap melayani katalog selama versi kandidat ditinjau; undangan lama memakai renderer versi yang dipin.</li></ol>
            </section>
            <section className="developer-docs-card developer-docs-card--notice">
              <ShieldCheck size={18} />
              <div><b>Kode template dijalankan sebagai bagian aplikasi</b><p>Renderer yang masuk repository ditinjau dan dikompilasi bersama aplikasi. Upload ZIP atau eksekusi kode mentah dari dashboard tidak tersedia.</p></div>
            </section>
          </div>

          <TemplateSubmissionForm />
          <div className="developer-docs-next"><span>Ingin melihat template yang sudah aktif?</span><Link href="/templates">Jelajahi katalog template <ArrowRight size={14} /></Link></div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
