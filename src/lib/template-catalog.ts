import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import { ensureTemplateVersion } from "@/lib/invitation-server";
import { templates as builtInTemplates } from "@/lib/templates";
import { isEditorCompatibleTemplate, validateTemplateManifest, type Template } from "@/lib/template-sdk";

export async function getPublishedTemplateCatalog(): Promise<Template[]> {
  const prisma = getPrismaClient();
  await Promise.all(builtInTemplates.map((template) => ensureTemplateVersion(template.slug)));

  const records = await prisma.template.findMany({
    where: { status: { in: ["PUBLISHED", "UPDATE_DRAFT", "UPDATE_IN_REVIEW"] }, activeVersionId: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { activeVersion: true },
  });
  return records.flatMap((record) => {
    const parsed = validateTemplateManifest(record.activeVersion?.manifest);
    return parsed.success
      && parsed.data.slug === record.slug
      && parsed.data.version === record.activeVersion?.version
      && isEditorCompatibleTemplate(parsed.data)
      ? [{ ...parsed.data, price: record.priceIdr }]
      : [];
  });
}
