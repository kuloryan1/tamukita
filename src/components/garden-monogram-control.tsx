"use client";

import Image from "next/image";
import { useId } from "react";
import { GardenEnvelopeMonogram } from "@/components/garden-envelope-monogram";
import { normalizeSealMonogram, resolveSealMonogram, SEAL_MONOGRAM_PATTERN } from "@/lib/seal-monogram";

export function GardenMonogramControl({ value, hostOne, hostTwo, onChange }: {
  value: string;
  hostOne: string;
  hostTwo: string;
  onChange: (value: string) => void;
}) {
  const hintId = useId();
  const monogram = resolveSealMonogram(value, [hostOne, hostTwo]);
  const automatic = resolveSealMonogram("", [hostOne, hostTwo]);

  return <span className="garden-monogram-control">
    <span className="garden-monogram-control-input">
      <input
        className="text-input"
        type="text"
        value={value}
        onChange={(event) => onChange(normalizeSealMonogram(event.target.value))}
        aria-label="Huruf pada segel amplop"
        aria-describedby={hintId}
        maxLength={3}
        pattern={SEAL_MONOGRAM_PATTERN.source}
        autoCapitalize="characters"
        autoComplete="off"
        spellCheck={false}
        placeholder={`Otomatis: ${automatic}`}
      />
      <span className="field-hint" id={hintId}>Gunakan 1–3 huruf A–Z, misalnya NR. Kosongkan untuk mengikuti inisial nama.</span>
      <span className="garden-monogram-control-result" aria-live="polite">Di amplop: <strong>{monogram}</strong>{!value && " · otomatis dari nama"}</span>
    </span>
    <span className="garden-monogram-control-preview" role="img" aria-label={`Pratinjau segel ${monogram}`}>
      <span className="garden-monogram-control-scene">
        <Image src="/templates/taman-abadi-envelope-cover.png" width={941} height={1672} alt="" sizes="270px" />
        <GardenEnvelopeMonogram monogram={monogram} />
      </span>
    </span>
  </span>;
}
