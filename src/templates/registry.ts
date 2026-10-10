import type { TemplateRenderer } from "@/lib/template-sdk";
import { CuratedManifestTemplate } from "@/templates/curated-manifest";
import { ElegantCreamTemplate } from "@/templates/elegant-cream";
import { ModernSageTemplate } from "@/templates/modern-sage";
import { RoyalGoldTemplate } from "@/templates/royal-gold";

type TemplateRendererRegistration = { component: TemplateRenderer; requiresAdminReview: boolean };

const renderers = new Map<string, TemplateRendererRegistration>([
  ["royal-gold@1.0.0", { component: RoyalGoldTemplate, requiresAdminReview: false }],
  ["elegant-cream@1.0.0", { component: ElegantCreamTemplate, requiresAdminReview: false }],
  ["modern-sage@1.0.0", { component: ModernSageTemplate, requiresAdminReview: false }],
]);

export function hasTemplateRenderer(slug: string, version: string) {
  return renderers.has(`${slug}@${version}`);
}

export function getTemplateRenderer(slug: string, version: string): TemplateRenderer {
  return renderers.get(`${slug}@${version}`)?.component ?? CuratedManifestTemplate;
}

export function templateVersionRequiresAdminReview(slug: string, version: string) {
  return renderers.get(`${slug}@${version}`)?.requiresAdminReview ?? true;
}

export function registeredTemplateRenderers() {
  return [...renderers.entries()].map(([key, registration]) => [key, registration.component] as const);
}
