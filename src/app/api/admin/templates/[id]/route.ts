import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { isEditorCompatibleTemplate, validateTemplateManifest } from "@/lib/template-sdk";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const actionSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("publish") }),
  z.object({ action: z.literal("request_changes") }),
  z.object({ action: z.literal("archive") }),
  z.object({ action: z.literal("restore") }),
  z.object({ action: z.literal("set_pricing"), licenseType: z.enum(["FREE", "PAID_PER_INVITATION"]), priceIdr: z.number().int().min(0).max(100_000_000) }),
]);

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const prisma = getPrismaClient();
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  const role = admin?.platformRole;
  if (!role || !["SUPER_ADMIN", "FINANCE", "CONTENT_REVIEWER"].includes(role)) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Template tidak valid." }, { status: 400 });
  if (!await allowRequest(`admin:templates:${userId}`, 100, 60 * 60)) return NextResponse.json({ error: "Batas perubahan template tercapai. Coba lagi nanti." }, { status: 429 });
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Perubahan template tidak valid." }, { status: body.status });
  const parsed = actionSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih perubahan template yang valid." }, { status: 400 });
  if (parsed.data.action === "set_pricing" && !["SUPER_ADMIN", "FINANCE"].includes(role)) return NextResponse.json({ error: "Hanya Super Admin atau Finance yang dapat mengubah harga." }, { status: 403 });

  if (parsed.data.action === "set_pricing" && ((parsed.data.licenseType === "FREE" && parsed.data.priceIdr !== 0) || (parsed.data.licenseType === "PAID_PER_INVITATION" && parsed.data.priceIdr < 1_000))) {
    return NextResponse.json({ error: "Template gratis harus berharga Rp0 dan template berbayar minimal Rp1.000." }, { status: 400 });
  }

  const template = await prisma.template.findUnique({
    where: { id },
    include: { versions: { orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 1 } },
  });
  if (!template) return NextResponse.json({ error: "Template tidak ditemukan." }, { status: 404 });

  let update: { status?: "DRAFT" | "IN_REVIEW" | "UPDATE_DRAFT" | "UPDATE_IN_REVIEW" | "PUBLISHED" | "ARCHIVED"; activeVersionId?: string | null; licenseType?: "FREE" | "PAID_PER_INVITATION"; priceIdr?: number; name?: string; description?: string; category?: string };
  let action: string;
  let metadata: Record<string, string | number | null> = {};
  if (parsed.data.action === "publish") {
    if (role !== "SUPER_ADMIN" && role !== "CONTENT_REVIEWER") return NextResponse.json({ error: "Peran ini tidak dapat menerbitkan template." }, { status: 403 });
    if (template.status !== "IN_REVIEW" && template.status !== "UPDATE_IN_REVIEW") return NextResponse.json({ error: "Hanya template yang sedang ditinjau yang dapat diterbitkan." }, { status: 409 });
    const version = template.versions[0];
    const manifest = validateTemplateManifest(version?.manifest);
    if (!version || !manifest.success || manifest.data.slug !== template.slug || manifest.data.version !== version.version || !isEditorCompatibleTemplate(manifest.data)) {
      return NextResponse.json({ error: "Manifest versi terbaru tidak valid atau tidak cocok dengan slug dan versi template." }, { status: 409 });
    }
    update = {
      status: "PUBLISHED",
      activeVersionId: version.id,
      name: manifest.data.name,
      description: manifest.data.description,
      category: manifest.data.category,
      ...(template.status === "IN_REVIEW" ? { licenseType: manifest.data.price > 0 ? "PAID_PER_INVITATION" as const : "FREE" as const, priceIdr: manifest.data.price } : {}),
    };
    action = "admin.template_published";
    metadata = { versionId: version.id, version: version.version };
  } else if (parsed.data.action === "request_changes") {
    if (role !== "SUPER_ADMIN" && role !== "CONTENT_REVIEWER") return NextResponse.json({ error: "Peran ini tidak dapat meninjau template." }, { status: 403 });
    if (template.status !== "IN_REVIEW" && template.status !== "UPDATE_IN_REVIEW") return NextResponse.json({ error: "Hanya template dalam antrean review yang dapat dikembalikan." }, { status: 409 });
    update = { status: template.status === "IN_REVIEW" ? "DRAFT" : "UPDATE_DRAFT" };
    action = "admin.template_changes_requested";
  } else if (parsed.data.action === "archive") {
    if (role !== "SUPER_ADMIN" && role !== "CONTENT_REVIEWER") return NextResponse.json({ error: "Peran ini tidak dapat mengarsipkan template." }, { status: 403 });
    if (template.status !== "PUBLISHED" && template.status !== "UPDATE_DRAFT") return NextResponse.json({ error: "Template ini tidak dapat diarsipkan pada status sekarang." }, { status: 409 });
    update = { status: "ARCHIVED" };
    action = "admin.template_archived";
  } else if (parsed.data.action === "restore") {
    if (role !== "SUPER_ADMIN" && role !== "CONTENT_REVIEWER") return NextResponse.json({ error: "Peran ini tidak dapat memulihkan template." }, { status: 403 });
    if (template.status !== "ARCHIVED" || !template.activeVersionId) return NextResponse.json({ error: "Template ini belum memiliki versi terbit untuk dipulihkan." }, { status: 409 });
    update = { status: "PUBLISHED" };
    action = "admin.template_restored";
  } else {
    if (template.status !== "PUBLISHED" && template.status !== "UPDATE_DRAFT") return NextResponse.json({ error: "Harga hanya dapat diubah pada template terbit." }, { status: 409 });
    update = { licenseType: parsed.data.licenseType, priceIdr: parsed.data.priceIdr };
    action = "admin.template_pricing_changed";
    metadata = { previousLicenseType: template.licenseType, previousPriceIdr: template.priceIdr, nextLicenseType: parsed.data.licenseType, nextPriceIdr: parsed.data.priceIdr };
  }

  let changed: boolean;
  try {
    changed = await prisma.$transaction(async (tx) => {
      const result = await tx.template.updateMany({ where: { id, status: template.status }, data: update });
      if (result.count !== 1) return false;
      if (update.activeVersionId) {
        const publishedVersion = await tx.templateVersion.updateMany({ where: { id: update.activeVersionId, templateId: id }, data: { publishedAt: new Date() } });
        if (publishedVersion.count !== 1) throw new Error("TEMPLATE_VERSION_CHANGED");
      }
      await tx.auditLog.create({
        data: {
          actorId: userId,
          action,
          targetType: "Template",
          targetId: id,
          metadata: { previousStatus: template.status, ...metadata },
        },
      });
      return true;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "TEMPLATE_VERSION_CHANGED") return NextResponse.json({ error: "Versi kandidat berubah saat diterbitkan. Muat ulang halaman review." }, { status: 409 });
    throw error;
  }
  if (!changed) return NextResponse.json({ error: "Template berubah. Muat ulang lalu coba lagi." }, { status: 409 });
  return NextResponse.json({ status: update.status ?? template.status, licenseType: update.licenseType ?? template.licenseType, priceIdr: update.priceIdr ?? template.priceIdr });
}
