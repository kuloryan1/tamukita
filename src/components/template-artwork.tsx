import { CalendarDays } from "lucide-react";
import type { Template } from "@/lib/templates";

export function TemplateArtwork({ template, large = false }: { template: Template; large?: boolean }) {
  return (
    <div className={`artwork artwork--${template.style}${large ? " artwork--large" : ""}`} role="img" aria-label={`Pratinjau template ${template.name}`}>
      <div className="artwork-grain" />
      <div className="artwork-arch" />
      <div className="artwork-spark artwork-spark--one">✳</div>
      <div className="artwork-spark artwork-spark--two">✧</div>
      <div className="artwork-paper">
        <span className="artwork-kicker">THE WEDDING OF</span>
        <span className="artwork-names">Nara <i>&</i><br />Dimas</span>
        <span className="artwork-line" />
        <span className="artwork-date"><CalendarDays size={12} /> 22 . 05 . 27</span>
      </div>
      <span className="artwork-caption">{template.name}</span>
    </div>
  );
}
