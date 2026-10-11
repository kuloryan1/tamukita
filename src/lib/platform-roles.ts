export const PLATFORM_ROLE_OPTIONS = [
  { value: "CUSTOMER", label: "Pelanggan", description: "Akun pengguna produk." },
  { value: "SUPER_ADMIN", label: "Super Admin", description: "Akses penuh ke konsol platform." },
  { value: "FINANCE", label: "Finance", description: "Analitik bisnis, order, dan refund." },
  { value: "SUPPORT", label: "Support", description: "Antrean bantuan dan akses dukungan yang diizinkan." },
  { value: "CONTENT_REVIEWER", label: "Content Reviewer", description: "Moderasi konten publik." },
  { value: "TEMPLATE_DEVELOPER", label: "Template Developer", description: "Pengiriman dan pemeliharaan template." },
] as const;

export const PLATFORM_ROLE_VALUES = PLATFORM_ROLE_OPTIONS.map((role) => role.value) as [
  (typeof PLATFORM_ROLE_OPTIONS)[number]["value"],
  ...(typeof PLATFORM_ROLE_OPTIONS)[number]["value"][],
];

export type PlatformRoleValue = (typeof PLATFORM_ROLE_OPTIONS)[number]["value"];

export function getPlatformRoleLabel(role: string) {
  return PLATFORM_ROLE_OPTIONS.find((item) => item.value === role)?.label ?? role;
}
