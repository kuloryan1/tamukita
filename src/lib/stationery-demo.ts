export type WeddingTemplate = {
  slug: string;
  name: string;
  tagline: string;
  accent: string;
  paper: string;
  background: string;
  ink: string;
  muted: string;
  line: string;
  ornament: "leaf" | "flower" | "wisteria" | "palm";
  style: "botanical" | "artdeco" | "classic" | "minimal" | "passport";
};

export const WEDDING = {
  groom: "Ryan Pratam",
  bride: "Dwi Wulan Maulida",
  eventDate: "2026-11-21",
  eventTime: "18:00",
  dateLabel: "Sabtu, 21 November 2026",
  timeLabel: "18:00 WIB",
  startAt: "2026-11-21T18:00:00+07:00",
  venue: "Gedung Pariwisata Surabaya",
  city: "Surabaya, Jawa Timur",
  intro:
    "Dengan penuh syukur, kami mengundang Anda untuk merayakan hari istimewa ini bersama.",
  eventSchedule: [
    { id: "wedding-arrival", time: "17:30", title: "Kedatangan tamu", description: "Silakan hadir lebih awal untuk menyapa keluarga." },
    { id: "wedding-ceremony", time: "18:00", title: "Prosesi pernikahan", description: "Prosesi utama dimulai tepat waktu." },
    { id: "wedding-reception", time: "19:30", title: "Ramah tamah", description: "Mari berbagi doa dan kebahagiaan bersama." },
  ],
} as const;

export const templates: WeddingTemplate[] = [
  {
    slug: "royal-gold",
    name: "Royal Gold",
    tagline: "Anggun & berkesan",
    accent: "#957746",
    paper: "#fbf7ed",
    background: "#e9e3d8",
    ink: "#4c4234",
    muted: "#7a6a53",
    line: "#b6a78e",
    ornament: "leaf",
    style: "classic",
  },
  {
    slug: "elegant-cream",
    name: "Elegant Cream",
    tagline: "Hangat & romantis",
    accent: "#a18b67",
    paper: "#faf5e9",
    background: "#e8deca",
    ink: "#5b4d3f",
    muted: "#7d6b56",
    line: "#bdad91",
    ornament: "flower",
    style: "classic",
  },
  {
    slug: "modern-sage",
    name: "Modern Sage",
    tagline: "Sederhana, tetap istimewa",
    accent: "#6c7d65",
    paper: "#f3f5ef",
    background: "#e0e6dd",
    ink: "#394735",
    muted: "#63715d",
    line: "#a6b2a0",
    ornament: "leaf",
    style: "minimal",
  },
  {
    slug: "blush-serenade",
    name: "Blush Serenade",
    tagline: "Romantis dengan sentuhan bunga",
    accent: "#ad7880",
    paper: "#fbf2ef",
    background: "#eadbda",
    ink: "#684c50",
    muted: "#8c6870",
    line: "#c9a9ad",
    ornament: "flower",
    style: "botanical",
  },
  {
    slug: "ivory-heritage",
    name: "Ivory Heritage",
    tagline: "Megah, lembut, dan berkelas",
    accent: "#7d8587",
    paper: "#f8f6ef",
    background: "#e4e5df",
    ink: "#4d5656",
    muted: "#707b79",
    line: "#b2b6ad",
    ornament: "leaf",
    style: "artdeco",
  },
  {
    slug: "wisteria-senja",
    name: "Wisteria Senja",
    tagline: "Lembut dalam warna ungu muda",
    accent: "#9381a3",
    paper: "#f7f3f9",
    background: "#e7dfed",
    ink: "#5c4a69",
    muted: "#82718e",
    line: "#c1b2cc",
    ornament: "wisteria",
    style: "botanical",
  },
  {
    slug: "destinasi-cinta",
    name: "Destinasi Cinta",
    tagline: "Catat tanggalnya, bernuansa perjalanan",
    accent: "#6d7b89",
    paper: "#faf4e8",
    background: "#e3ded1",
    ink: "#34495a",
    muted: "#657586",
    line: "#aab3b8",
    ornament: "palm",
    style: "passport",
  },
  {
    slug: "taman-abadi",
    name: "Taman Abadi",
    tagline: "Botani klasik yang puitis",
    accent: "#6c7352",
    paper: "#f5f3e6",
    background: "#e0e2d3",
    ink: "#3f4d34",
    muted: "#6f785d",
    line: "#aeb59a",
    ornament: "leaf",
    style: "botanical",
  },
];

export function getTemplate(slug: string): WeddingTemplate | undefined {
  return templates.find((template) => template.slug === slug);
}
