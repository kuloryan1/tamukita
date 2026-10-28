import motion from "./garden-envelope-motion.json";
import glyphData from "./garden-monogram-glyphs.json";
import { normalizeSealMonogram } from "./seal-monogram";

export type EnvelopePose = { m: number[]; tone: number[]; gold: number[] };
type Glyph = { d: string; advance: number; bounds: number[] };
const glyphs: Record<string, Glyph> = glyphData.glyphs;

export const envelopeFace = motion.face;
export const envelopePatch = motion.patch;
export const posterEnvelopePose: EnvelopePose = { m: [1, 0, 0, 1, 0, 0], ...motion.poster };

function interpolate(a: number[], b: number[], amount: number) {
  return a.map((value, index) => value + (b[index] - value) * amount);
}

export function envelopePoseAt(time: number): EnvelopePose {
  const frames = motion.frames;
  if (time <= frames[0].t) return frames[0];
  if (time >= frames[frames.length - 1].t) return frames[frames.length - 1];
  let low = 0;
  let high = frames.length - 1;
  while (high - low > 1) {
    const middle = Math.floor((low + high) / 2);
    if (frames[middle].t <= time) low = middle;
    else high = middle;
  }
  const a = frames[low];
  const b = frames[high];
  const amount = (time - a.t) / (b.t - a.t);
  return {
    m: interpolate(a.m, b.m, amount),
    tone: interpolate(a.tone, b.tone, amount),
    gold: interpolate(a.gold, b.gold, amount),
  };
}

export function envelopeToneMatrix(tone: number[]) {
  const [r, g, b, redBias, greenBias, blueBias] = tone;
  return `${r} 0 0 0 ${redBias} 0 ${g} 0 0 ${greenBias} 0 0 ${b} 0 ${blueBias} 0 0 0 1 0`;
}

export function envelopeGoldColors(color: number[]) {
  const warmGold = [229, 197, 140];
  const base = color.map((value, index) => value * .7 + warmGold[index] * .3);
  const rgb = (values: number[]) => `rgb(${values.map((value) => Math.round(Math.max(0, Math.min(255, value)))).join(" ")})`;
  return {
    light: rgb(base.map((value) => value * .55 + 114)),
    middle: rgb(base),
    dark: rgb(base.map((value) => value * .55)),
  };
}

export function layoutEnvelopeMonogram(value: string) {
  const letters = normalizeSealMonogram(value) || "TK";
  let advance = 0;
  const paths = [...letters].map((letter, index) => {
    const glyph = glyphs[letter];
    const result = { key: `${letter}-${index}`, x: advance, ...glyph };
    advance += glyph.advance;
    return result;
  });
  const left = Math.min(...paths.map((glyph) => glyph.x + glyph.bounds[0]));
  const bottom = Math.min(...paths.map((glyph) => glyph.bounds[1]));
  const right = Math.max(...paths.map((glyph) => glyph.x + glyph.bounds[2]));
  const top = Math.max(...paths.map((glyph) => glyph.bounds[3]));
  const scale = Math.min(132 / (right - left), 106 / (top - bottom));
  const x = envelopeFace.cx - (left + right) * .5 * scale;
  const y = envelopeFace.cy + (bottom + top) * .5 * scale;
  return { letters, paths, transform: `translate(${x} ${y}) scale(${scale} ${-scale})` };
}
