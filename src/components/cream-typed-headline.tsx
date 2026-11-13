import type { CSSProperties } from "react";

export function CreamTypedHeadline({ text }: { text: string }) {
  const letters = typeof Intl.Segmenter === "function"
    ? Array.from(new Intl.Segmenter("id", { granularity: "grapheme" }).segment(text), ({ segment, index }) => ({ letter: segment, offset: index }))
    : Array.from(text, (letter, offset) => ({ letter, offset }));
  const step = Math.min(58, 2_600 / Math.max(letters.length, 1));
  return (
    <span aria-hidden="true" style={{ "--cream-letter-step": `${step}ms` } as CSSProperties}>
      {letters.map(({ letter, offset }, index) => (
        <span className="cream-type-letter" key={offset} style={{ "--cream-letter-index": index } as CSSProperties}>{letter}</span>
      ))}
    </span>
  );
}
