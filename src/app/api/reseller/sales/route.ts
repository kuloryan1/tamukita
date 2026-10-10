import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { getApprovedResellerManager } from "@/lib/reseller-server";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const saleSchema = z.object({
  amountIdr: z.number().int().min(1).max(2_147_483_647),
  description: z.string().trim().min(2).max(160),
  customerOrgId: z.uuid().optional(),
  invitationId: z.uuid().optional(),
});

function jakartaMonthStart(now: Date) {
  const parts = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jakarta", year: "numeric", month: "numeric" }).formatToParts(now);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  return new Date(Date.UTC(year, month - 1, 1) - 7 * 60 * 60 * 1000);
}

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const reseller = await getApprovedResellerManager(userId);
  if (!reseller) return NextResponse.json({ error: "Laporan hanya tersedia bagi owner atau admin reseller yang disetujui." }, { status: 403 });

  const prisma = getPrismaClient();
  const where = { resellerOrgId: reseller.organizationId, voidedAt: null };
  const [sales, total, monthToDate] = await Promise.all([
    prisma.resellerSale.findMany({
      where: { resellerOrgId: reseller.organizationId },
      orderBy: { createdAt: "desc" },
      take: 100,
      select: {
        id: true,
        amountIdr: true,
        description: true,
        createdAt: true,
        voidedAt: true,
        voidReason: true,
        customer: { select: { name: true } },
        invitation: { select: { title: true } },
      },
    }),
    prisma.resellerSale.aggregate({ where, _sum: { amountIdr: true }, _count: { _all: true } }),
    prisma.resellerSale.aggregate({
      where: { ...where, createdAt: { gte: jakartaMonthStart(new Date()) } },
      _sum: { amountIdr: true },
    }),
  ]);

  return NextResponse.json({
    sales: sales.map((sale) => ({
      id: sale.id,
      amountIdr: sale.amountIdr,
      description: sale.description,
      createdAt: sale.createdAt.toISOString(),
      voidedAt: sale.voidedAt?.toISOString() ?? null,
      voidReason: sale.voidReason,
      customerName: sale.customer?.name ?? null,
      invitationTitle: sale.invitation?.title ?? null,
    })),
    summary: {
      activeTotalIdr: total._sum.amountIdr ?? 0,
      activeSaleCount: total._count._all,
      monthToDateIdr: monthToDate._sum.amountIdr ?? 0,
    },
  });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const reseller = await getApprovedResellerManager(userId);
  if (!reseller) return NextResponse.json({ error: "Hanya owner atau admin reseller yang dapat mencatat penjualan." }, { status: 403 });
  if (!await allowRequest(`reseller:sales:${userId}`, 60, 60 * 60)) return NextResponse.json({ error: "Terlalu banyak catatan penjualan. Coba lagi nanti." }, { status: 429 });

  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Data laporan penjualan tidak valid." }, { status: body.status });
  const parsed = saleSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Isi deskripsi dan nilai penjualan yang valid." }, { status: 400 });

  const prisma = getPrismaClient();
  const result = await prisma.$transaction(async (tx) => {
    let customerOrgId = parsed.data.customerOrgId ?? null;
    if (customerOrgId) {
      const customerLink = await tx.resellerCustomer.findFirst({
        where: {
          resellerOrgId: reseller.organizationId,
          customerOrgId,
          status: "ACTIVE",
          customer: { type: "PERSONAL", status: "ACTIVE" },
        },
        select: { customerOrgId: true },
      });
      if (!customerLink) return { error: "Pelanggan tidak tertaut aktif ke workspace reseller ini." } as const;
    }

    if (parsed.data.invitationId) {
      const invitation = await tx.invitation.findFirst({
        where: {
          id: parsed.data.invitationId,
          deletedAt: null,
          OR: [{ resellerOrgId: null }, { resellerOrgId: reseller.organizationId }],
          organization: { type: "PERSONAL", status: "ACTIVE" },
        },
        select: { id: true, organizationId: true },
      });
      if (!invitation) return { error: "Undangan tidak ditemukan atau sudah ditangani reseller lain." } as const;
      const customerLink = await tx.resellerCustomer.findFirst({
        where: {
          resellerOrgId: reseller.organizationId,
          customerOrgId: invitation.organizationId,
          status: "ACTIVE",
          customer: { type: "PERSONAL", status: "ACTIVE" },
        },
        select: { customerOrgId: true },
      });
      if (!customerLink) return { error: "Pelanggan undangan ini tidak tertaut aktif ke workspace reseller." } as const;
      if (customerOrgId && customerOrgId !== invitation.organizationId) return { error: "Undangan harus berasal dari pelanggan yang dipilih." } as const;
      customerOrgId = invitation.organizationId;
    }

    const sale = await tx.resellerSale.create({
      data: {
        resellerOrgId: reseller.organizationId,
        customerOrgId,
        invitationId: parsed.data.invitationId,
        recordedById: userId,
        amountIdr: parsed.data.amountIdr,
        description: parsed.data.description,
      },
      select: { id: true, amountIdr: true, description: true, createdAt: true },
    });
    await tx.auditLog.create({
      data: {
        organizationId: reseller.organizationId,
        actorId: userId,
        action: "reseller.sale_recorded",
        targetType: "ResellerSale",
        targetId: sale.id,
        metadata: { amountIdr: sale.amountIdr, customerOrgId, invitationId: parsed.data.invitationId ?? null },
      },
    });
    return { sale } as const;
  });

  if ("error" in result) return NextResponse.json({ error: result.error }, { status: 400 });
  return NextResponse.json({ sale: { ...result.sale, createdAt: result.sale.createdAt.toISOString() } }, { status: 201 });
}
