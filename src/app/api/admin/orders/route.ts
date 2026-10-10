import { NextResponse } from "next/server";
import type { Prisma } from "@/generated/prisma/client";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const prisma = getPrismaClient();
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN" && admin?.platformRole !== "FINANCE") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const url = new URL(request.url);
  const query = (url.searchParams.get("q") ?? "").trim().slice(0, 100);
  const pageValue = Number(url.searchParams.get("page") ?? "0");
  const page = Number.isSafeInteger(pageValue) ? Math.min(10_000, Math.max(0, pageValue)) : 0;
  const where: Prisma.OrderWhereInput = query ? {
    OR: [
      ...( /^[0-9a-f-]{36}$/i.test(query) ? [{ id: query }] : []),
      { buyer: { email: { contains: query, mode: "insensitive" } } },
      { buyer: { name: { contains: query, mode: "insensitive" } } },
      { organization: { name: { contains: query, mode: "insensitive" } } },
      { invitation: { is: { OR: [{ title: { contains: query, mode: "insensitive" } }, { slug: { contains: query, mode: "insensitive" } }] } } },
      { items: { some: { sku: { contains: query, mode: "insensitive" } } } },
    ],
  } : {};
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where,
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      skip: page * 25,
      take: 25,
      include: {
        buyer: { select: { name: true, email: true } },
        organization: { select: { name: true } },
        invitation: { select: { title: true, slug: true } },
        items: { orderBy: { createdAt: "asc" }, select: { sku: true, quantity: true, itemType: true, unitPriceIdr: true } },
        paymentSessions: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, providerPaymentRequestId: true } },
        refunds: { orderBy: { createdAt: "desc" }, select: { id: true, amount: true, currency: true, reason: true, adminNote: true, failureCode: true, status: true, createdAt: true, requestedBy: { select: { name: true, email: true } } } },
      },
    }),
    prisma.order.count({ where }),
  ]);
  const rows = orders.map((order) => {
    const settledRefundedAmount = order.refunds.filter((refund) => refund.status === "SUCCEEDED").reduce((sum, refund) => sum + refund.amount, 0);
    const reservedRefundAmount = order.refunds.filter((refund) => refund.status === "INITIATING" || refund.status === "PENDING").reduce((sum, refund) => sum + refund.amount, 0);
    const creditItem = order.items.find((item) => item.itemType === "RESELLER_CREDIT");
    return {
      id: order.id,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt.toISOString(),
      buyer: order.buyer.name ?? "Pengguna",
      email: order.buyer.email ?? "",
      organization: order.organization.name,
      invitationId: order.invitationId,
      invitationTitle: order.invitation?.title ?? "",
      invitationSlug: order.invitation?.slug ?? "",
      item: order.items.length > 0 ? order.items.map((item) => `${item.sku}${item.quantity > 1 ? ` × ${item.quantity}` : ""}`).join(" + ") : "Order kosong",
      itemType: creditItem ? "RESELLER_CREDIT" : order.items.some((item) => item.itemType === "TEMPLATE_LICENSE" || item.itemType === "ACTIVATION") ? "TEMPLATE_LICENSE" : order.items[0]?.itemType ?? "",
      itemQuantity: creditItem?.quantity ?? order.items.reduce((sum, item) => sum + item.quantity, 0),
      itemUnitPriceIdr: creditItem?.unitPriceIdr ?? 0,
      paymentStatus: order.paymentSessions[0]?.status ?? "TANPA PEMBAYARAN",
      hasRefundPaymentReference: Boolean(order.paymentSessions[0]?.providerPaymentRequestId),
      refundedAmount: settledRefundedAmount,
      reservedRefundAmount,
      availableRefundAmount: Math.max(0, order.totalAmount - settledRefundedAmount - reservedRefundAmount),
      refunds: order.refunds.map((refund) => ({ ...refund, createdAt: refund.createdAt.toISOString(), requestedBy: refund.requestedBy.name ?? refund.requestedBy.email ?? "Admin" })),
    };
  });
  return NextResponse.json({ orders: rows, page, pageSize: 25, total, hasMore: (page + 1) * 25 < total });
}
