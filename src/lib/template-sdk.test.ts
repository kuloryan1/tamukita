import { expect, test } from "vitest";
import { templates } from "@/lib/templates";
import { createInitialDraft } from "@/lib/invitations";
import { validateTemplateFields } from "@/lib/validation";
import {
  applyTemplateFieldDefaults,
  defineTemplate,
  isEditorCompatibleTemplate,
  isSafeTemplateFieldKey,
  templateFieldMaximumLength,
  validateTemplateManifest,
} from "@/lib/template-sdk";

function createExtendedTemplate() {
  const base = templates[0];
  return defineTemplate({
    ...base,
    schema: {
      ...base.schema,
      sections: [
        ...base.schema.sections.map((section) => section.key === "identity"
          ? {
              ...section,
              fields: [...section.fields, {
                key: "welcomeNote",
                type: "textarea" as const,
                label: "Pesan pembuka",
                defaultValue: "Kami menantikan kehadiranmu.",
                maxLength: 80,
              }],
            }
          : section),
        {
          key: "details",
          label: "Detail tambahan",
          fields: [
            { key: "dressCode", type: "text" as const, label: "Tema busana", required: true, maxLength: 10 },
            { key: "extraDate", type: "datetime" as const, label: "Tanggal tambahan" },
            { key: "extraTime", type: "time" as const, label: "Waktu tambahan" },
            { key: "extraUrl", type: "url" as const, label: "Tautan tambahan" },
          ],
        },
      ],
    },
  });
}

test("accepts compatible extension fields and defaults only values that are not already set", () => {
  const template = createExtendedTemplate();

  expect(isEditorCompatibleTemplate(template)).toBe(true);
  expect(applyTemplateFieldDefaults(template, { welcomeNote: "Teks tersimpan" })).toEqual({
    welcomeNote: "Teks tersimpan",
  });
  expect(applyTemplateFieldDefaults(template)).toEqual({ welcomeNote: "Kami menantikan kehadiranmu." });
});

test("rejects unsafe keys, duplicate custom keys, and extra image slots", () => {
  expect(isSafeTemplateFieldKey("guestMessage")).toBe(true);
  expect(isSafeTemplateFieldKey("__proto__")).toBe(false);
  expect(isSafeTemplateFieldKey("constructor")).toBe(false);
  expect(isSafeTemplateFieldKey("guest-message")).toBe(false);

  const template = createExtendedTemplate();
  const duplicate = structuredClone(template);
  duplicate.schema.sections[3]?.fields.push({ key: "dressCode", type: "text", label: "Duplikat" });
  expect(validateTemplateManifest(duplicate).success).toBe(false);

  const extraImage = structuredClone(template);
  extraImage.schema.sections[3]?.fields.push({ key: "extraPhoto", type: "image", label: "Foto tambahan" });
  const parsedExtraImage = validateTemplateManifest(extraImage);
  expect(parsedExtraImage.success).toBe(true);
  if (parsedExtraImage.success) expect(isEditorCompatibleTemplate(parsedExtraImage.data)).toBe(false);
});

test("caps custom field length at the SDK limit and validates required custom fields", () => {
  const template = createExtendedTemplate();
  const field = template.schema.sections[3]?.fields[0];
  expect(field && templateFieldMaximumLength(field)).toBe(10);

  const draft = createInitialDraft();
  expect(validateTemplateFields(draft, template)).toEqual({
    valid: false,
    message: "Isi tema busana terlebih dahulu.",
    step: 1,
  });
  expect(validateTemplateFields({ ...draft, customFields: { dressCode: "Batik" } }, template)).toEqual({ valid: true });
  expect(validateTemplateFields({ ...draft, customFields: { dressCode: "12345678901" } }, template)).toEqual({
    valid: false,
    message: "Tema busana terlalu panjang.",
    step: 1,
  });
});

test.each([
  ["extraDate", "2027-02-29", "Tanggal tambahan harus berupa tanggal yang valid."],
  ["extraTime", "25:00", "Waktu tambahan harus menggunakan format waktu yang valid."],
  ["extraUrl", "http://example.com", "Tautan tambahan harus menggunakan tautan HTTPS yang valid."],
] as const)("validates custom %s fields on the server", (key, value, message) => {
  const template = createExtendedTemplate();
  const draft = { ...createInitialDraft(), customFields: { dressCode: "Batik", [key]: value } };

  expect(validateTemplateFields(draft, template)).toEqual({ valid: false, message, step: 1 });
});
