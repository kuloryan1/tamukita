import { defineTemplate } from "@/lib/template-sdk";
import type { Template, TemplateSchema } from "@/lib/template-sdk";

export type { Template, TemplateSchema, TemplateSchemaField } from "@/lib/template-sdk";

const invitationSchema: TemplateSchema = {
  schemaVersion: 1,
  sections: [
    {
      key: "identity",
      label: "Informasi acara",
      fields: [
        { key: "eventTitle", type: "text", label: "Judul acara", required: true },
        { key: "hostOne", type: "text", label: "Nama pertama" },
        { key: "hostTwo", type: "text", label: "Nama kedua" },
        { key: "story", type: "textarea", label: "Cerita singkat" },
      ],
    },
    {
      key: "schedule",
      label: "Tanggal dan tempat",
      fields: [
        { key: "eventDate", type: "datetime", label: "Tanggal acara", required: true },
        { key: "eventTime", type: "time", label: "Waktu acara", required: true },
        { key: "venue", type: "text", label: "Nama tempat", required: true },
        { key: "address", type: "textarea", label: "Alamat", required: true },
        { key: "mapsUrl", type: "url", label: "Tautan Google Maps" },
      ],
    },
    {
      key: "media",
      label: "Foto undangan",
      fields: [{ key: "coverPhoto", type: "image", label: "Foto sampul", aspectRatio: "3:4", editable: true }],
    },
  ],
};

export const templates: Template[] = [
  defineTemplate({
    slug: "royal-gold",
    version: "1.0.0",
    schemaVersion: 1,
    activationSku: "PREMIUM_ACTIVATION",
    name: "Royal Gold",
    subtitle: "Anggun & berkesan",
    description:
      "Sentuhan klasik dengan aksen emas lembut untuk momen yang ingin dikenang selamanya.",
    category: "Pernikahan",
    price: 149000,
    style: "royal",
    featured: true,
    tags: ["Klasik", "Elegan", "Populer"],
    features: ["cover", "gallery", "gift-info", "maps", "music", "rsvp", "whatsapp-share"],
    schema: invitationSchema,
  }),
  defineTemplate({
    slug: "elegant-cream",
    version: "1.0.0",
    schemaVersion: 1,
    activationSku: "BASIC_ACTIVATION",
    name: "Elegant Cream",
    subtitle: "Hangat & romantis",
    description:
      "Warna natural dan detail botani untuk perayaan yang terasa intim dan personal.",
    category: "Pernikahan",
    price: 129000,
    style: "cream",
    tags: ["Botani", "Lembut", "Minimal"],
    features: ["cover", "gallery", "gift-info", "maps", "music", "rsvp", "whatsapp-share"],
    schema: invitationSchema,
  }),
  defineTemplate({
    slug: "modern-sage",
    version: "1.0.0",
    schemaVersion: 1,
    activationSku: "BASIC_ACTIVATION",
    name: "Modern Sage",
    subtitle: "Sederhana, tetap istimewa",
    description:
      "Desain modern yang bersih dengan warna sage yang tenang untuk setiap cerita.",
    category: "Pernikahan",
    price: 99000,
    style: "sage",
    tags: ["Modern", "Minimal", "Sage"],
    features: ["cover", "gallery", "gift-info", "maps", "music", "rsvp", "whatsapp-share"],
    schema: invitationSchema,
  }),
];

export function getTemplate(slug: string) {
  return templates.find((template) => template.slug === slug);
}

export function formatRupiah(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value);
}
