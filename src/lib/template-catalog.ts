import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import { ensureTemplateVersion } from "@/lib/invitation-server";
import { ensureInvitationCopySection } from "@/lib/invitation-copy";
import { templates as builtInTemplates } from "@/lib/templates";
import { isEditorCompatibleTemplate, validateTemplateManifest, type Template } from "@/lib/template-sdk";
import { filterListedTemplates } from "@/lib/template-visibility";

let builtInTemplateSync: Promise<void> | undefined;

async function syncBuiltInTemplateVersions() {
  if (!builtInTemplateSync) {
    builtInTemplateSync = (async () => {
      for (const template of builtInTemplates) {
        await ensureTemplateVersion(template.slug);
      }
    })().catch((error: unknown) => {
      builtInTemplateSync = undefined;
      throw error;
    });
  }
  await builtInTemplateSync;
}

export async function getPublishedTemplateCatalog(): Promise<Template[]> {
  const prisma = getPrismaClient();
  await syncBuiltInTemplateVersions();

  const records = await prisma.template.findMany({
    where: { status: { in: ["PUBLISHED", "UPDATE_DRAFT", "UPDATE_IN_REVIEW"] }, activeVersionId: { not: null } },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    include: { activeVersion: true },
  });
  return records.flatMap((record) => {
    const parsed = validateTemplateManifest(record.activeVersion?.manifest);
    if (!parsed.success || parsed.data.slug !== record.slug || parsed.data.version !== record.activeVersion?.version) return [];
    const editorTemplate = ensureInvitationCopySection({ ...parsed.data, price: record.priceIdr });
    return isEditorCompatibleTemplate(editorTemplate) ? [editorTemplate] : [];
  });
}

export async function getListedTemplateCatalog(): Promise<Template[]> {
  return filterListedTemplates(await getPublishedTemplateCatalog());
}
