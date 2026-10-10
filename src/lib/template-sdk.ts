import { z } from "zod";
import type { ComponentType } from "react";
import type { InvitationDraft } from "@/lib/invitations";

export const TEMPLATE_SDK_VERSION = "1.0.0";

const templateFieldSchema = z.object({
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9_]*$/),
  type: z.enum(["text", "textarea", "datetime", "time", "image", "url"]),
  label: z.string().trim().min(1).max(80),
  required: z.boolean().optional(),
  aspectRatio: z.string().regex(/^\d+(?:\.\d+)?:\d+(?:\.\d+)?$/).optional(),
  editable: z.boolean().optional(),
});

const templateSchemaSchema = z.object({
  schemaVersion: z.number().int().positive(),
  sections: z.array(z.object({
    key: z.string().regex(/^[a-z][a-z0-9-]*$/),
    label: z.string().trim().min(1).max(80),
    fields: z.array(templateFieldSchema).min(1),
  })).min(1),
}).superRefine((schema, context) => {
  const sectionKeys = new Set<string>();
  const fieldKeys = new Set<string>();
  schema.sections.forEach((section, sectionIndex) => {
    if (sectionKeys.has(section.key)) context.addIssue({ code: "custom", path: ["sections", sectionIndex, "key"], message: "Kunci section harus unik." });
    sectionKeys.add(section.key);
    section.fields.forEach((field, fieldIndex) => {
      if (fieldKeys.has(field.key)) context.addIssue({ code: "custom", path: ["sections", sectionIndex, "fields", fieldIndex, "key"], message: "Kunci field harus unik di seluruh template." });
      fieldKeys.add(field.key);
    });
  });
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
  style: z.enum(["royal", "cream", "sage"]),
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
  if (template.schema.sections.length !== Object.keys(required).length) return false;
  const sectionKeys = new Set(template.schema.sections.map((section) => section.key));
  if (Object.keys(required).some((key) => !sectionKeys.has(key))) return false;
  return template.schema.sections.every((section) => {
    const sectionFields = required[section.key];
    if (!sectionFields) return false;
    const fields = new Map(section.fields.map((field) => [field.key, field.type]));
    return fields.size === Object.keys(sectionFields).length
      && Object.entries(sectionFields).every(([key, type]) => fields.get(key) === type);
  });
}
