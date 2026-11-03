export type ReferenceTemplatePreset = {
  slug: string;
  name: string;
  referenceName: string;
  referenceUrl: string;
  coverPoster: string;
  coverMessage?: string;
  showOpeningFrame?: boolean;
  openingVideo?: string;
  heroPoster: string;
  heroVideo?: string;
  backdropPoster?: string;
  backdropVideo?: string;
};

const presets: Record<string, ReferenceTemplatePreset> = {
  "blush-serenade": {
    slug: "blush-serenade",
    name: "Blush Serenade",
    referenceName: "Champagne & Blush",
    referenceUrl: "https://www.wooowinvites.com/invite/demo-cb2027",
    coverPoster: "/templates/reference-prototypes/blush-envelope-poster.jpg",
    openingVideo: "/templates/reference-prototypes/blush-envelope.mp4",
    heroPoster: "/templates/reference-prototypes/blush-poster.jpg",
    heroVideo: "/templates/reference-prototypes/blush-hero.mp4",
    backdropPoster: "/templates/reference-prototypes/sage-poster.jpg",
    backdropVideo: "/templates/reference-prototypes/sage-hero.mp4",
  },
  "ivory-heritage": {
    slug: "ivory-heritage",
    name: "Ivory Heritage",
    referenceName: "Sacred Ivory Heritage",
    referenceUrl: "https://www.wooowinvites.com/invite/demo-d329cb",
    coverPoster: "/templates/reference-prototypes/ivory-poster.jpg",
    coverMessage: "Anda diundang untuk merayakan hari istimewa kami",
    showOpeningFrame: true,
    openingVideo: "/templates/reference-prototypes/ivory-envelope.mp4",
    heroPoster: "/templates/reference-prototypes/ivory-poster.jpg",
    heroVideo: "/templates/reference-prototypes/ivory-hero.mp4",
  },
  "royal-gold": {
    slug: "royal-gold",
    name: "Royal Gold",
    referenceName: "Shining Light",
    referenceUrl: "https://www.wooowinvites.com/invite/demo-f69198",
    coverPoster: "/templates/reference-prototypes/royal-envelope-frame.png",
    coverMessage: "Anda diundang untuk merayakan hari istimewa kami",
    showOpeningFrame: true,
    openingVideo: "/templates/reference-prototypes/ivory-envelope.mp4",
    heroPoster: "/templates/reference-prototypes/royal-poster.jpg",
    heroVideo: "/templates/reference-prototypes/royal-hero.mp4",
  },
  "wisteria-senja": {
    slug: "wisteria-senja",
    name: "Wisteria Senja",
    referenceName: "Wisteria Balcony",
    referenceUrl: "https://www.wooowinvites.com/invite/demo-5f7e70",
    coverPoster: "/templates/reference-prototypes/wisteria-envelope-poster.jpg",
    openingVideo: "/templates/reference-prototypes/wisteria-envelope.mp4",
    heroPoster: "/templates/reference-prototypes/wisteria-poster.jpg",
    heroVideo: "/templates/reference-prototypes/wisteria-hero.mp4",
    backdropPoster: "/templates/reference-prototypes/wisteria-poster.jpg",
    backdropVideo: "/templates/reference-prototypes/wisteria-hero.mp4",
  },
  "elegant-cream": {
    slug: "elegant-cream",
    name: "Elegant Cream",
    referenceName: "Ivory Shell Relief",
    referenceUrl: "https://www.wooowinvites.com/invite/demo-8c71d5",
    coverPoster: "/templates/reference-prototypes/cream-envelope-poster.jpg",
    coverMessage: "",
    openingVideo: "/templates/reference-prototypes/cream-envelope.mp4",
    heroPoster: "/templates/reference-prototypes/cream-poster.jpg",
    heroVideo: "/templates/reference-prototypes/cream-hero.mp4",
    backdropPoster: "/templates/reference-prototypes/cream-poster.jpg",
    backdropVideo: "/templates/reference-prototypes/cream-hero.mp4",
  },
  "modern-sage": {
    slug: "modern-sage",
    name: "Modern Sage",
    referenceName: "White Blossom Vine",
    referenceUrl: "https://www.wooowinvites.com/invite/demo-305eb8",
    coverPoster: "/templates/reference-prototypes/cream-envelope-poster.jpg",
    coverMessage: "",
    openingVideo: "/templates/reference-prototypes/cream-envelope.mp4",
    heroPoster: "/templates/reference-prototypes/sage-poster.jpg",
    heroVideo: "/templates/reference-prototypes/sage-hero.mp4",
    backdropPoster: "/templates/reference-prototypes/sage-poster.jpg",
    backdropVideo: "/templates/reference-prototypes/sage-hero.mp4",
  },
  "destinasi-cinta": {
    slug: "destinasi-cinta",
    name: "Destinasi Cinta",
    referenceName: "Boarding Pass",
    referenceUrl: "https://www.wooowinvites.com/save-the-date/std-demo-3a3ec5",
    coverPoster: "/templates/reference-prototypes/boarding-passport-cover-id.png",
    coverMessage: "",
    openingVideo: "/templates/reference-prototypes/boarding-envelope.mp4",
    heroPoster: "/templates/reference-prototypes/boarding-passport-cover-id.png",
  },
};

export function getReferenceTemplatePreset(slug: string) {
  return presets[slug];
}

export function referenceTemplatePresets() {
  return Object.values(presets);
}
