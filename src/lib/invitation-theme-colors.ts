export const INVITATION_THEME_COLOR_VALUES = ["default", "rose", "ocean", "sage", "terracotta"] as const;

export type InvitationThemeColor = (typeof INVITATION_THEME_COLOR_VALUES)[number];

export const INVITATION_THEME_PALETTES = [
  { value: "default", label: "Bawaan", swatch: "", accent: "#b8935e", accentStrong: "#715a37", surface: "#f6efe2" },
  { value: "rose", label: "Mawar", swatch: "#c07a8e", accent: "#905064", accentStrong: "#663646", surface: "#f6e9ee" },
  { value: "ocean", label: "Biru laut", swatch: "#7197ad", accent: "#426d86", accentStrong: "#2c5065", surface: "#eaf2f6" },
  { value: "sage", label: "Hijau sage", swatch: "#849779", accent: "#63785b", accentStrong: "#43543d", surface: "#edf1e8" },
  { value: "terracotta", label: "Terakota", swatch: "#c7775f", accent: "#a4553c", accentStrong: "#723a2c", surface: "#f7ebe5" },
] as const satisfies readonly {
  value: InvitationThemeColor;
  label: string;
  swatch: string;
  accent: string;
  accentStrong: string;
  surface: string;
}[];

export function getInvitationThemePalette(color: InvitationThemeColor | undefined) {
  return INVITATION_THEME_PALETTES.find((palette) => palette.value === (color ?? "default")) ?? INVITATION_THEME_PALETTES[0];
}
