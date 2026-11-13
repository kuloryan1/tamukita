import Image from "next/image";
import { BotanicalWreath } from "@/components/stationery-ornaments";
import { normalizeSealMonogram } from "@/lib/seal-monogram";
import { WEDDING } from "@/lib/stationery-demo";

export function Monogram({ small = false, hostOne = WEDDING.groom, hostTwo = WEDDING.bride, customMonogram = "", crestSrc = "/images/monograms/wr-crest.png" }: { small?: boolean; hostOne?: string; hostTwo?: string; customMonogram?: string; crestSrc?: string }) {
  const firstInitial = (name: string) => Array.from(name.trim())[0]?.toLocaleUpperCase("id-ID") ?? "?";
  const initials = normalizeSealMonogram(customMonogram);
  if (initials === "WR") return <div className={`monogram monogram--custom-crest${small ? " monogram-small" : ""}`} role="img" aria-label={`Monogram W R untuk ${hostOne} dan ${hostTwo}`}><Image className="monogram-custom-artwork" src={crestSrc} alt="" aria-hidden="true" width={500} height={500} sizes="(max-width: 640px) 108px, 125px" /></div>;
  return <div className={`monogram${small ? " monogram-small" : ""}`} role="img" aria-label={initials ? `Monogram ${initials} untuk ${hostOne} dan ${hostTwo}` : `Monogram ${hostOne} dan ${hostTwo}`}><BotanicalWreath /><span>{initials || <>{firstInitial(hostOne)}<span className="monogram-amp">&</span>{firstInitial(hostTwo)}</>}</span></div>;
}
