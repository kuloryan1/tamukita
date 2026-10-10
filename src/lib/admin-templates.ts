import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import { ensureTemplateVersion } from "@/lib/invitation-server";
import { templates as sourceTemplates } from "@/lib/templates";

export async function getAdminTemplates() {
  await Promise.all(sourceTemplates.map((template) => ensureTemplateVersion(template.slug)));
  const records = await getPrismaClient().template.findMany({
    where: { status: { in: ["IN_REVIEW", "UPDATE_DRAFT", "UPDATE_IN_REVIEW", "PUBLISHED", "ARCHIVED"] } },
    orderBy: [{ status: "asc" }, { updatedAt: "desc" }, { id: "asc" }],
    take: 100,
    include: {
      author: { select: { name: true, email: true } },
      activeVersion: { select: { version: true } },
      versions: { orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 1, select: { version: true, manifest: true, sourceRef: true, sdkVersion: true } },
    },
  });
  return records.map((template) => {
    const latestManifest = typeof template.versions[0]?.manifest === "object" && template.versions[0]?.manifest !== null && !Array.isArray(template.versions[0]?.manifest)
      ? template.versions[0].manifest as Record<string, unknown>
      : {};
    const reviewingVersion = template.status === "IN_REVIEW" || template.status === "UPDATE_IN_REVIEW" || template.status === "UPDATE_DRAFT";
    return {
      id: template.id,
      slug: template.slug,
      name: reviewingVersion && typeof latestManifest.name === "string" ? latestManifest.name : template.name,
      description: reviewingVersion && typeof latestManifest.description === "string" ? latestManifest.description : template.description,
      category: reviewingVersion && typeof latestManifest.category === "string" ? latestManifest.category : template.category,
      status: template.status,
      licenseType: template.licenseType,
      priceIdr: template.priceIdr,
      version: reviewingVersion ? template.versions[0]?.version ?? "Belum ada versi" : template.activeVersion?.version ?? template.versions[0]?.version ?? "Belum ada versi",
      proposedPrice: typeof latestManifest.price === "number" ? latestManifest.price : null,
      sourceRef: template.versions[0]?.sourceRef ?? null,
      sdkVersion: template.versions[0]?.sdkVersion ?? null,
      author: template.author?.name ?? template.author?.email ?? (template.versions[0]?.sourceRef ? "Kontribusi repository" : "Tim TamuKita"),
      updatedAt: template.updatedAt.toISOString(),
    };
  });
}

export type AdminTemplateRow = Awaited<ReturnType<typeof getAdminTemplates>>[number];
