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
  defineTemplate({
    slug: "blush-serenade",
    version: "1.0.0",
    schemaVersion: 1,
    activationSku: "BASIC_ACTIVATION",
    name: "Blush Serenade",
    subtitle: "Romantis dengan sentuhan floral",
    description: "Warna blush yang lembut, garis emas tipis, dan detail bunga untuk suasana hangat yang terasa personal.",
    category: "Pernikahan",
    price: 129000,
    style: "blush",
    tags: ["Floral", "Romantis", "Blush"],
    features: ["cover", "gallery", "gift-info", "maps", "music", "rsvp", "whatsapp-share"],
    schema: invitationSchema,
  }),
  defineTemplate({
    slug: "ivory-heritage",
    version: "1.0.0",
    schemaVersion: 1,
    activationSku: "PREMIUM_ACTIVATION",
    name: "Ivory Heritage",
    subtitle: "Megah, lembut, dan berkelas",
    description: "Latar ivory, bingkai berornamen, dan aksen emas hangat untuk perayaan dengan nuansa klasik.",
    category: "Pernikahan",
    price: 149000,
    style: "heritage",
    tags: ["Heritage", "Ivory", "Premium"],
    features: ["cover", "gallery", "gift-info", "maps", "music", "rsvp", "whatsapp-share"],
    schema: invitationSchema,
  }),
  defineTemplate({
    slug: "wisteria-senja",
    version: "1.0.0",
    schemaVersion: 1,
    activationSku: "BASIC_ACTIVATION",
    name: "Wisteria Senja",
    subtitle: "Lembut dalam warna lilac",
    description: "Nuansa lilac dan pemandangan senja memberi kesan taman yang tenang untuk cerita kalian.",
    category: "Pernikahan",
    price: 129000,
    style: "wisteria",
    tags: ["Lilac", "Taman", "Romantis"],
    features: ["cover", "gallery", "gift-info", "maps", "music", "rsvp", "whatsapp-share"],
    schema: invitationSchema,
  }),
  defineTemplate({
    slug: "destinasi-cinta",
    version: "1.0.0",
    schemaVersion: 1,
    activationSku: "BASIC_ACTIVATION",
    name: "Destinasi Cinta",
    subtitle: "Save the date, bergaya perjalanan",
    description: "Undangan seperti boarding pass untuk pasangan yang merayakan hari istimewanya dengan nuansa perjalanan.",
    category: "Pernikahan",
    price: 99000,
    style: "boarding",
    tags: ["Save the Date", "Destinasi", "Unik"],
    features: ["cover", "gallery", "gift-info", "maps", "music", "rsvp", "whatsapp-share"],
    schema: invitationSchema,
  }),
  defineTemplate({
    slug: "taman-abadi",
    version: "1.1.0",
    schemaVersion: 1,
    activationSku: "PREMIUM_ACTIVATION",
    name: "Taman Abadi",
    subtitle: "Botani klasik yang puitis",
    description: "Kertas ivory, lengkung taman, ilustrasi dedaunan, dan aksen emas serta burgundy untuk undangan yang terasa istimewa.",
    category: "Pernikahan",
    price: 149000,
    style: "garden",
    featured: true,
    tags: ["Botani", "Klasik", "Premium"],
    features: ["cover", "gallery", "gift-info", "maps", "music", "rsvp", "whatsapp-share"],
    schema: {
      ...invitationSchema,
      sections: [
        ...invitationSchema.sections,
        {
          key: "celebration",
          label: "Rangkaian perayaan",
          fields: [
            { key: "guestArrivalTime", type: "time", label: "Kedatangan tamu" },
            { key: "ceremonyTime", type: "time", label: "Akad / acara utama" },
            { key: "mocktailTime", type: "time", label: "Jamuan pembuka" },
            { key: "dinnerTime", type: "time", label: "Makan malam" },
            { key: "danceTime", type: "time", label: "Tarian" },
            { key: "dressCode", type: "textarea", label: "Dress code", placeholder: "Warna atau busana yang disarankan" },
            { key: "giftPreference", type: "textarea", label: "Preferensi hadiah", placeholder: "Pesan singkat untuk tamu" },
          ],
        },
      ],
    },
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
