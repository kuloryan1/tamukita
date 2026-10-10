import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, test } from "vitest";
import { createInitialDraft } from "@/lib/invitations";
import { isEditorCompatibleTemplate } from "@/lib/template-sdk";
import { templates } from "@/lib/templates";
import { getTemplateRenderer, hasTemplateRenderer, registeredTemplateRenderers, templateVersionRequiresAdminReview } from "@/templates/registry";

test("source template versions have compatible, rendered React components and review policy", () => {
  const draft = { ...createInitialDraft(), familyDetails: "Keluarga Hadi dan Rina" };
  expect(templates.length).toBeGreaterThanOrEqual(3);
  expect(new Set(templates.map((template) => template.slug)).size).toBe(templates.length);
  expect(new Set(templates.map((template) => `${template.slug}@${template.version}`)).size).toBe(templates.length);
  const coreTemplateSlugs = new Set(["royal-gold", "elegant-cream", "modern-sage"]);
  for (const [key, Renderer] of registeredTemplateRenderers()) {
    const slug = key.slice(0, key.lastIndexOf("@"));
    const template = templates.find((item) => item.slug === slug);
    expect(template, `${key} must belong to a source template in the catalog`).toBeDefined();
    const markup = renderToStaticMarkup(createElement(Renderer, { draft, template, mode: "example" }));
    expect(markup).toContain(`data-template="${slug}"`);
    expect(markup).toContain("Nara");
    expect(markup).toContain("Dimas");
    expect(markup).toContain("Keluarga Hadi dan Rina");
  }

  for (const template of templates) {
    expect(isEditorCompatibleTemplate(template), `${template.slug} must satisfy the Smart Editor contract`).toBe(true);
    expect(hasTemplateRenderer(template.slug, template.version), `${template.slug}@${template.version} must have a React renderer`).toBe(true);
    expect(templateVersionRequiresAdminReview(template.slug, template.version), `${template.slug} should require reviewer approval unless it is a core template`).toBe(!coreTemplateSlugs.has(template.slug));
    expect(getTemplateRenderer(template.slug, template.version)).toBeDefined();
  }
});
