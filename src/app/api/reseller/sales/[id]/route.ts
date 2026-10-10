import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { getApprovedResellerManager } from "@/lib/reseller-server";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const voidSchema = z.object({ reason: z.string().trim().min(3).max(240) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const reseller = await getApprovedResellerManager(userId);
  if (!reseller) return NextResponse.json({ error: "Hanya owner atau admin reseller yang dapat mengoreksi laporan." }, { status: 403 });
  if (!await allowRequest(`reseller:sales:void:${userId}`, 60, 60 * 60)) return NextResponse.json({ error: "Terlalu banyak koreksi laporan. Coba lagi nanti." }, { status: 429 });

  const { id } = await params;
  if (!z.uuid().safeParse(id).success) return NextResponse.json({ error: "Catatan penjualan tidak ditemukan." }, { status: 404 });
  const body = await readJsonBody(request, 2_000);
  if (!body.ok) return NextResponse.json({ error: "Alasan pembatalan tidak valid." }, { status: body.status });
  const parsed = voidSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Isi alasan koreksi minimal 3 karakter." }, { status: 400 });

  const prisma = getPrismaClient();
  const result = await prisma.$transaction(async (tx) => {
    const update = await tx.resellerSale.updateMany({
      where: { id, resellerOrgId: reseller.organizationId, voidedAt: null },
      data: { voidedAt: new Date(), voidReason: parsed.data.reason, voidedById: userId },
    });
    if (update.count === 0) return false;
    await tx.auditLog.create({
      data: {
        organizationId: reseller.organizationId,
        actorId: userId,
        action: "reseller.sale_voided",
        targetType: "ResellerSale",
        targetId: id,
        metadata: { reason: parsed.data.reason },
      },
    });
    return true;
  });

  if (!result) return NextResponse.json({ error: "Catatan penjualan tidak ditemukan atau sudah dibatalkan." }, { status: 404 });
  return NextResponse.json({ voided: true });
}
