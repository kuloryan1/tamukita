import { CalendarDays } from "lucide-react";
import { DEMO_COUPLE_NAMES } from "@/lib/invitations";
import type { Template } from "@/lib/templates";

export function TemplateArtwork({ template, large = false }: { template: Template; large?: boolean }) {
  const isBoardingPass = template.style === "boarding";
  const isGarden = template.style === "garden";
  return (
    <div className={`artwork artwork--${template.style}${large ? " artwork--large" : ""}`} role="img" aria-label={`Pratinjau template ${template.name}`} style={isGarden ? { backgroundImage: "linear-gradient(180deg, rgba(255,251,241,.08), rgba(42,54,41,.1)), url('/templates/taman-abadi-garden.webp')", backgroundPosition: "center", backgroundSize: "cover" } : undefined}>
      <div className="artwork-grain" />
      {!isGarden && <div className="artwork-arch" />}
      {!isGarden && <><div className="artwork-spark artwork-spark--one">✳</div><div className="artwork-spark artwork-spark--two">✧</div></>}
      <div className="artwork-paper">
        <span className="artwork-kicker">{isBoardingPass ? "CATAT TANGGAL" : isGarden ? "HARI PERNIKAHAN" : "UNDANGAN PERNIKAHAN"}</span>
        <span className="artwork-names"><span>{DEMO_COUPLE_NAMES.hostOne}</span><i>&</i><span>{DEMO_COUPLE_NAMES.hostTwo}</span></span>
        <span className="artwork-line" />
        <span className="artwork-date"><CalendarDays size={12} /> {isBoardingPass ? "TUJUAN · 22 . 05 . 27" : "22 . 05 . 27"}</span>
      </div>
      <span className="artwork-caption">{template.name}</span>
    </div>
  );
}
