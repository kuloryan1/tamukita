import Link from "next/link";
import { ArrowUpRight, Heart } from "lucide-react";
import { formatRupiah, type Template } from "@/lib/templates";
import { TemplateArtwork } from "@/components/template-artwork";

export function TemplateCard({ template, compact = false }: { template: Template; compact?: boolean }) {
  return (
    <article className={`template-card${compact ? " template-card--compact" : ""}`}>
      <Link href={`/templates/${template.slug}`} className="template-card-art" aria-label={`Lihat ${template.name}`}>
        <TemplateArtwork template={template} />
        {template.featured && <span className="featured-pill"><Heart size={11} fill="currentColor" /> Favorit</span>}
        <span className="art-hover"><ArrowUpRight size={15} /><span>Lihat pratinjau</span></span>
      </Link>
      <div className="template-card-info">
        <div>
          <p className="template-category">{template.category}</p>
          <Link href={`/templates/${template.slug}`} className="template-name">{template.name}</Link>
          <p className="template-subtitle">{template.subtitle}</p>
        </div>
        <span className="template-price">{formatRupiah(template.price)}</span>
      </div>
    </article>
  );
}
