// Listing a template is independent of its availability to existing invitations.
const listedTemplateSlugs = new Set(["elegant-cream"]);

export function isTemplateListed(slug: string) {
  return listedTemplateSlugs.has(slug);
}

export function filterListedTemplates<T extends { slug: string }>(templates: readonly T[]): T[] {
  return templates.filter((template) => isTemplateListed(template.slug));
}
