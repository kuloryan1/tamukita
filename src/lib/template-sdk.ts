import { z } from "zod";
import type { ComponentType } from "react";
import type { InvitationDraft } from "@/lib/invitations";

export const TEMPLATE_SDK_VERSION = "1.1.0";

const reservedDraftFieldKeys = new Set([
  "id", "slug", "eventKind", "templateId", "templateVersion", "themeColor", "themeFont", "sectionOrder", "sealMonogram",
  "familyDetails", "coverPosition", "coverPositionX", "galleryPhotos", "giftMessage", "giftBankName",
  "giftAccountName", "giftAccountNumber", "musicUrl", "musicTitle", "customFields", "updatedAt", "publishedAt", "isPublished",
  "constructor", "prototype", "__proto__", "toString", "toLocaleString", "valueOf", "hasOwnProperty",
  "isPrototypeOf", "propertyIsEnumerable", "__defineGetter__", "__lookupGetter__", "__defineSetter__", "__lookupSetter__",
]);

export function isSafeTemplateFieldKey(value: string) {
  return /^[A-Za-z][A-Za-z0-9_]{0,63}$/.test(value) && !reservedDraftFieldKeys.has(value);
}

const templateFieldSchema = z.object({
  key: z.string().refine(isSafeTemplateFieldKey, "Kunci field tidak boleh memakai properti draft atau objek."),
  type: z.enum(["text", "textarea", "datetime", "time", "image", "url"]),
  label: z.string().trim().min(1).max(80),
  required: z.boolean().optional(),
  aspectRatio: z.string().regex(/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/).refine((value) => {
    const [width, height] = value.split(":").map(Number);
    const ratio = width / height;
    return Number.isFinite(ratio) && ratio >= 0.2 && ratio <= 5;
  }).optional(),
  placeholder: z.string().trim().max(160).optional(),
  helpText: z.string().trim().max(240).optional(),
  maxLength: z.number().int().min(1).max(1_000).optional(),
  defaultValue: z.string().max(1_000).optional(),
  editable: z.boolean().optional(),
});

const templateSchemaSchema = z.object({
  schemaVersion: z.number().int().positive(),
  sections: z.array(z.object({
    key: z.string().regex(/^[a-z][a-z0-9-]*$/),
    label: z.string().trim().min(1).max(80),
    fields: z.array(templateFieldSchema).min(1).max(24),
  })).min(1).max(8),
}).superRefine((schema, context) => {
  const sectionKeys = new Set<string>();
  const fieldKeys = new Set<string>();
  let fieldCount = 0;
  schema.sections.forEach((section, sectionIndex) => {
    if (sectionKeys.has(section.key)) context.addIssue({ code: "custom", path: ["sections", sectionIndex, "key"], message: "Kunci section harus unik." });
    sectionKeys.add(section.key);
    section.fields.forEach((field, fieldIndex) => {
      fieldCount += 1;
      if (fieldKeys.has(field.key)) context.addIssue({ code: "custom", path: ["sections", sectionIndex, "fields", fieldIndex, "key"], message: "Kunci field harus unik di seluruh template." });
      fieldKeys.add(field.key);
    });
  });
  if (fieldCount > 64) context.addIssue({ code: "custom", path: ["sections"], message: "Schema template maksimal memuat 64 field." });
});

const templateManifestSchema = z.object({
  slug: z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(80),
  version: z.string().regex(/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/),
  schemaVersion: z.number().int().positive(),
  activationSku: z.enum(["BASIC_ACTIVATION", "PREMIUM_ACTIVATION"]),
  name: z.string().trim().min(2).max(80),
  subtitle: z.string().trim().min(2).max(100),
  description: z.string().trim().min(20).max(500),
  category: z.string().trim().min(2).max(60),
  price: z.number().int().min(0).max(100_000_000),
  style: z.enum(["royal", "cream", "sage", "blush", "heritage", "wisteria", "boarding", "garden"]),
  featured: z.boolean().optional(),
  tags: z.array(z.string().trim().min(1).max(32)).max(12),
  features: z.array(z.enum(["cover", "gallery", "gift-info", "maps", "music", "rsvp", "whatsapp-share"])).min(1),
  schema: templateSchemaSchema,
}).superRefine((manifest, context) => {
  if (manifest.schemaVersion !== manifest.schema.schemaVersion) {
    context.addIssue({ code: "custom", path: ["schema", "schemaVersion"], message: "Versi schema harus sama dengan manifest." });
  }
  if (new Set(manifest.tags).size !== manifest.tags.length) {
    context.addIssue({ code: "custom", path: ["tags"], message: "Tag template tidak boleh berulang." });
  }
  if (new Set(manifest.features).size !== manifest.features.length) {
    context.addIssue({ code: "custom", path: ["features"], message: "Fitur template tidak boleh berulang." });
  }
});

export type TemplateSchemaField = z.infer<typeof templateFieldSchema>;
export type TemplateSchema = z.infer<typeof templateSchemaSchema>;
export type Template = z.infer<typeof templateManifestSchema>;
export type TemplateRenderProps = {
  draft: InvitationDraft;
  recipientName?: string;
  mode: "editor" | "public" | "example";
  full?: boolean;
  template?: Template;
};
export type TemplateRenderer = ComponentType<TemplateRenderProps>;

export function defineTemplate(manifest: Template) {
  return templateManifestSchema.parse(manifest);
}

export function validateTemplateManifest(manifest: unknown) {
  return templateManifestSchema.safeParse(manifest);
}

export function isTemplateSelectable(status: string) {
  return status === "PUBLISHED" || status === "UPDATE_DRAFT" || status === "UPDATE_IN_REVIEW";
}

export function isEditorCompatibleTemplate(template: Template) {
  const required: Record<string, Record<string, TemplateSchemaField["type"]>> = {
    identity: { eventTitle: "text", hostOne: "text", hostTwo: "text", story: "textarea" },
    schedule: { eventDate: "datetime", eventTime: "time", venue: "text", address: "textarea", mapsUrl: "url" },
    media: { coverPhoto: "image" },
  };
  const sections = new Map(template.schema.sections.map((section) => [section.key, section]));
  if (Object.keys(required).some((key) => !sections.has(key))) return false;

  for (const [sectionKey, requiredFields] of Object.entries(required)) {
    const section = sections.get(sectionKey);
    if (!section) return false;
    const fields = new Map(section.fields.map((field) => [field.key, field.type]));
    if (Object.entries(requiredFields).some(([key, type]) => fields.get(key) !== type)) return false;
  }

  const allFields = template.schema.sections.flatMap((section) => section.fields.map((field) => ({ ...field, sectionKey: section.key })));
  const extraFields = allFields.filter((field) => !standardFieldKeysForSchema.has(field.key));
  if (extraFields.length > 32) return false;
  return allFields.every((field) => {
    if (field.type === "image" && (field.sectionKey !== "media" || field.key !== "coverPhoto")) return false;
    if (field.key === "coverPhoto" && (field.sectionKey !== "media" || field.type !== "image")) return false;
    if (field.defaultValue === undefined) return true;
    if (standardFieldKeysForSchema.has(field.key) || field.defaultValue.length > (field.maxLength ?? 500)) return false;
    if (!field.defaultValue) return true;
    if (field.type === "datetime") {
      const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(field.defaultValue);
      if (!match) return false;
      const date = new Date(`${field.defaultValue}T00:00:00.000Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== field.defaultValue) return false;
    }
    if (field.type === "time" && !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(field.defaultValue)) return false;
    if (field.type === "url") {
      try {
        if (new URL(field.defaultValue).protocol !== "https:") return false;
      } catch {
        return false;
      }
    }
    if (field.type === "image") return false;
    return true;
  });
}

const standardFieldKeysForSchema = new Set(["eventTitle", "hostOne", "hostTwo", "story", "eventDate", "eventTime", "venue", "address", "mapsUrl", "coverPhoto"]);

const standardFieldMaxLengths: Record<string, number> = {
  eventTitle: 120,
  hostOne: 80,
  hostTwo: 80,
  story: 3_000,
  eventDate: 10,
  eventTime: 5,
  venue: 160,
  address: 1_000,
  mapsUrl: 2_000,
};

const standardFieldKeys = new Set([...Object.keys(standardFieldMaxLengths), "coverPhoto"]);

export function templateFieldMaximumLength(field: TemplateSchemaField) {
  if (field.type === "image" && field.key === "coverPhoto") return 1_800_000;
  const standardMaximum = standardFieldMaxLengths[field.key];
  return Math.min(field.maxLength ?? standardMaximum ?? 500, standardMaximum ?? 1_000);
}

export function templateImageAspectRatio(value?: string) {
  if (!value) return 3 / 4;
  const [width, height] = value.split(":").map(Number);
  const ratio = width / height;
  return Number.isFinite(ratio) && ratio >= 0.2 && ratio <= 5 ? ratio : 3 / 4;
}

export function applyTemplateFieldDefaults(template: Template, current: Record<string, string> = {}) {
  const fields = { ...current };
  for (const section of template.schema.sections) {
    for (const field of section.fields) {
      if (!standardFieldKeys.has(field.key) && field.defaultValue !== undefined && !Object.hasOwn(fields, field.key)) {
        fields[field.key] = field.defaultValue;
      }
    }
  }
  return fields;
}
