import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { TEMPLATE_SDK_VERSION, isEditorCompatibleTemplate, validateTemplateManifest } from "@/lib/template-sdk";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

async function getDeveloper() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }) };
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (user?.platformRole !== "TEMPLATE_DEVELOPER") return { error: NextResponse.json({ error: "Akun ini belum memiliki akses developer template." }, { status: 403 }) };
  return { userId, prisma };
}

export async function GET() {
  const developer = await getDeveloper();
  if ("error" in developer) return developer.error;
  const templates = await developer.prisma.template.findMany({
    where: { authorId: developer.userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
    select: { id: true, slug: true, name: true, status: true, updatedAt: true, versions: { orderBy: { createdAt: "desc" }, take: 1, select: { version: true, manifest: true } } },
  });
  return NextResponse.json({ templates: templates.map((template) => ({ id: template.id, slug: template.slug, name: template.name, status: template.status, version: template.versions[0]?.version ?? "—", manifest: template.versions[0]?.manifest ?? null, updatedAt: template.updatedAt.toISOString() })) }, { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const developer = await getDeveloper();
  if ("error" in developer) return developer.error;
  if (!await allowRequest(`developer:templates:${developer.userId}`, 10, 60 * 60)) return NextResponse.json({ error: "Batas pengajuan template tercapai. Coba lagi nanti." }, { status: 429 });
  const body = await readJsonBody(request, 128_000);
  if (!body.ok) return NextResponse.json({ error: "Manifest terlalu besar atau tidak valid." }, { status: body.status });
  const value = typeof body.value === "object" && body.value !== null && !Array.isArray(body.value) ? (body.value as Record<string, unknown>).manifest : null;
  const parsed = validateTemplateManifest(value);
  if (!parsed.success) return NextResponse.json({ error: "Manifest tidak lolos validasi Template SDK.", issues: parsed.error.issues.slice(0, 20).map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400 });
  if (!isEditorCompatibleTemplate(parsed.data)) return NextResponse.json({ error: "Schema harus menyertakan field acara standar. Field tambahan boleh diletakkan di section lain; slot gambar harus memakai coverPhoto." }, { status: 400 });

  try {
    const template = await developer.prisma.$transaction(async (tx) => {
      const created = await tx.template.create({
        data: {
          slug: parsed.data.slug,
          name: parsed.data.name,
          description: parsed.data.description,
          category: parsed.data.category,
          licenseType: parsed.data.price > 0 ? "PAID_PER_INVITATION" : "FREE",
          priceIdr: parsed.data.price,
          status: "IN_REVIEW",
          authorId: developer.userId,
          versions: { create: { version: parsed.data.version, schemaVersion: parsed.data.schemaVersion, sdkVersion: TEMPLATE_SDK_VERSION, manifest: JSON.parse(JSON.stringify(parsed.data)) } },
        },
      select: { id: true, slug: true, name: true, status: true },
      });
      await tx.auditLog.create({ data: { actorId: developer.userId, action: "developer.template_submitted", targetType: "Template", targetId: created.id, metadata: { slug: created.slug, version: parsed.data.version } } });
      return created;
    });
    return NextResponse.json({ submitted: true, template: { ...template, version: parsed.data.version, updatedAt: new Date().toISOString() } }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Slug template ini sudah terdaftar. Pilih slug lain atau ajukan pembaruan melalui proses review." }, { status: 409 });
    throw error;
  }
}

function compareVersions(left: string, right: string) {
  const leftParts = left.split(".").map(BigInt);
  const rightParts = right.split(".").map(BigInt);
  for (let index = 0; index < 3; index += 1) {
    if (leftParts[index] !== rightParts[index]) return leftParts[index] > rightParts[index] ? 1 : -1;
  }
  return 0;
}

export async function PATCH(request: Request) {
  const developer = await getDeveloper();
  if ("error" in developer) return developer.error;
  if (!await allowRequest(`developer:templates:${developer.userId}`, 10, 60 * 60)) return NextResponse.json({ error: "Batas pengajuan template tercapai. Coba lagi nanti." }, { status: 429 });
  const body = await readJsonBody(request, 128_000);
  if (!body.ok) return NextResponse.json({ error: "Manifest terlalu besar atau tidak valid." }, { status: body.status });
  const requestData = typeof body.value === "object" && body.value !== null && !Array.isArray(body.value) ? body.value as Record<string, unknown> : {};
  const templateId = typeof requestData.templateId === "string" ? requestData.templateId : "";
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(templateId)) return NextResponse.json({ error: "Pengajuan template tidak valid." }, { status: 400 });
  const parsed = validateTemplateManifest(requestData.manifest);
  if (!parsed.success) return NextResponse.json({ error: "Manifest tidak lolos validasi Template SDK.", issues: parsed.error.issues.slice(0, 20).map((issue) => ({ path: issue.path.join("."), message: issue.message })) }, { status: 400 });
  if (!isEditorCompatibleTemplate(parsed.data)) return NextResponse.json({ error: "Schema harus menyertakan field acara standar. Field tambahan boleh diletakkan di section lain; slot gambar harus memakai coverPhoto." }, { status: 400 });

  try {
    const template = await developer.prisma.$transaction(async (tx) => {
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "templates" WHERE id = ${templateId}::uuid AND "authorId" = ${developer.userId}::uuid FOR UPDATE`;
      const existing = await tx.template.findFirst({
        where: { id: templateId, authorId: developer.userId, status: { in: ["DRAFT", "UPDATE_DRAFT", "PUBLISHED"] } },
        include: { versions: { orderBy: [{ createdAt: "desc" }, { id: "asc" }], take: 1, select: { version: true } } },
      });
      if (!existing) throw new Error("SUBMISSION_NOT_EDITABLE");
      const latestVersion = existing.versions[0]?.version;
      if (parsed.data.slug !== existing.slug) throw new Error("SLUG_MISMATCH");
      if (!latestVersion || compareVersions(parsed.data.version, latestVersion) <= 0) throw new Error("VERSION_NOT_NEWER");

      const version = await tx.templateVersion.create({
        data: { templateId, version: parsed.data.version, schemaVersion: parsed.data.schemaVersion, sdkVersion: TEMPLATE_SDK_VERSION, manifest: JSON.parse(JSON.stringify(parsed.data)) },
        select: { version: true },
      });
      const updated = await tx.template.update({
        where: { id: templateId },
        data: existing.status === "DRAFT"
          ? {
            name: parsed.data.name,
            description: parsed.data.description,
            category: parsed.data.category,
            licenseType: parsed.data.price > 0 ? "PAID_PER_INVITATION" : "FREE",
            priceIdr: parsed.data.price,
            status: "IN_REVIEW",
          }
          : { status: "UPDATE_IN_REVIEW" },
        select: { id: true, slug: true, name: true, status: true },
      });
      await tx.auditLog.create({ data: { actorId: developer.userId, action: existing.status === "DRAFT" ? "developer.template_resubmitted" : "developer.template_version_submitted", targetType: "Template", targetId: updated.id, metadata: { slug: updated.slug, previousVersion: latestVersion, version: version.version, previousStatus: existing.status } } });
      return { ...updated, version: version.version, updatedAt: new Date().toISOString() };
    });
    return NextResponse.json({ submitted: true, template });
  } catch (error) {
    if (error instanceof Error && error.message === "SUBMISSION_NOT_EDITABLE") return NextResponse.json({ error: "Template hanya dapat diperbarui setelah reviewer meminta perubahan, atau saat template aktif." }, { status: 409 });
    if (error instanceof Error && error.message === "SLUG_MISMATCH") return NextResponse.json({ error: "Slug template tidak dapat diubah setelah pengajuan pertama." }, { status: 400 });
    if (error instanceof Error && error.message === "VERSION_NOT_NEWER") return NextResponse.json({ error: "Gunakan versi semver yang lebih tinggi dari versi sebelumnya." }, { status: 400 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Versi tersebut sudah pernah diajukan. Naikkan nomor versinya." }, { status: 409 });
    throw error;
  }
}
