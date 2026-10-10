import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const applicationSchema = z.object({ businessName: z.string().trim().min(2).max(120) });

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Informasi usaha tidak valid." }, { status: body.status });
  const parsed = applicationSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Nama usaha wajib diisi (maksimal 120 karakter)." }, { status: 400 });
  if (!await allowRequest(`reseller:application:${userId}`, 3, 365 * 24 * 60 * 60)) return NextResponse.json({ error: "Pengajuan reseller sudah dikirim. Hubungi dukungan untuk perubahan." }, { status: 429 });

  const prisma = getPrismaClient();
  const existing = await prisma.resellerProfile.findFirst({
    where: { organization: { status: "ACTIVE", memberships: { some: { userId, role: "OWNER" } } } },
    select: { id: true, status: true, businessName: true },
  });
  if (existing) return NextResponse.json({ application: existing });

  const baseSlug = parsed.data.businessName.normalize("NFKD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "mitra";
  const organizationSlug = `reseller-${baseSlug}-${randomUUID().slice(0, 8)}`;
  const application = await prisma.$transaction(async (tx) => {
    const organization = await tx.organization.create({
      data: {
        name: parsed.data.businessName,
        slug: organizationSlug,
        type: "RESELLER",
        memberships: { create: { userId, role: "OWNER" } },
        resellerProfile: { create: { businessName: parsed.data.businessName } },
      },
      select: { id: true, resellerProfile: { select: { id: true, status: true, businessName: true } } },
    });
    const resellerProfile = organization.resellerProfile;
    if (!resellerProfile) throw new Error("Reseller profile was not created.");
    await tx.auditLog.create({ data: { organizationId: organization.id, actorId: userId, action: "reseller.applied", targetType: "ResellerProfile", targetId: resellerProfile.id } });
    return resellerProfile;
  });
  return NextResponse.json({ application }, { status: 201 });
}
