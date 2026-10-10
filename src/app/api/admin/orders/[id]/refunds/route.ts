import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { Prisma } from "@/generated/prisma/client";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-json";
import { recalculateRefundedOrder, restoreResellerCreditsAfterFailedRefund } from "@/lib/refunds";
import { isUntrackedAdjustmentActivation } from "@/lib/credit-lots";
import { getResellerCreditState, lockResellerCreditBalance } from "@/lib/reseller-credits";
import { getXenditApiUrl } from "@/lib/xendit-api";

export const runtime = "nodejs";

const schema = z.object({
  reason: z.enum(["FRAUDULENT", "DUPLICATE", "REQUESTED_BY_CUSTOMER", "CANCELLATION", "OTHERS"]),
  amount: z.number().int().positive().max(2_147_483_647),
  adminNote: z.string().trim().max(500).optional().default(""),
});

type XenditRefundResponse = {
  id?: string;
  status?: string;
  payment_request_id?: string;
  reference_id?: string;
  amount?: number;
  currency?: string;
  failure_code?: string | null;
  reason?: string;
};

function safeProviderSnapshot(value: unknown) {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return {};
  const data = value as Record<string, unknown>;
  return {
    error_code: typeof data.error_code === "string" ? data.error_code.slice(0, 80) : undefined,
    httpStatus: typeof data.httpStatus === "number" ? data.httpStatus : undefined,
  };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return NextResponse.json({ error: "ID order tidak valid." }, { status: 400 });
  const body = await readJsonBody(request, 8_000);
  if (!body.ok) return NextResponse.json({ error: "Detail refund tidak valid." }, { status: body.status });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilih alasan refund yang valid." }, { status: 400 });

  const prisma = getPrismaClient();
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN" && admin?.platformRole !== "FINANCE") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  const secret = process.env.XENDIT_SECRET_KEY;
  if (!secret) return NextResponse.json({ error: "Kunci API Xendit belum dikonfigurasi." }, { status: 503 });

  const reservation = await prisma.$transaction(async (tx) => {
    await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "orders" WHERE "id" = ${id}::uuid FOR UPDATE`;
    const order = await tx.order.findUnique({
      where: { id },
      include: {
        items: { select: { itemType: true, sku: true, quantity: true, unitPriceIdr: true, totalPriceIdr: true, templateId: true, templateVersionId: true, entitlementSnapshot: true } },
        paymentSessions: { orderBy: { createdAt: "desc" }, select: { id: true, status: true, providerPaymentRequestId: true, currency: true } },
        refunds: { where: { status: { in: ["INITIATING", "PENDING", "SUCCEEDED"] } }, select: { id: true, status: true, amount: true } },
      },
    });
    if (!order) return { error: "Order tidak ditemukan.", status: 404 as const };
    if (order.refunds.some((refund) => refund.status === "INITIATING" || refund.status === "PENDING")) return { error: "Refund lain untuk order ini masih diproses. Tunggu hasil Xendit sebelum mengajukan lagi.", status: 409 as const };
    const item = order.items[0];
    const creditItem = order.items.length === 1 && item?.itemType === "RESELLER_CREDIT" ? item : null;
    const templateItems = order.items.filter((orderItem) => orderItem.itemType === "TEMPLATE_LICENSE");
    const activationItems = order.items.filter((orderItem) => orderItem.itemType === "ACTIVATION");
    const templateOrder = Boolean(order.invitationId)
      && order.items.length >= 1
      && order.items.length <= 2
      && templateItems.length <= 1
      && activationItems.length <= 1
      && templateItems.length + activationItems.length === order.items.length
      && order.items.every((orderItem) =>
        (orderItem.itemType === "TEMPLATE_LICENSE" || orderItem.itemType === "ACTIVATION")
        && orderItem.quantity === 1
        && orderItem.unitPriceIdr > 0
        && orderItem.totalPriceIdr === orderItem.unitPriceIdr,
      )
      && order.items.reduce((sum, orderItem) => sum + orderItem.totalPriceIdr, 0) === order.totalAmount
      && Boolean(templateItems[0] || activationItems[0]);
    if ((order.status !== "PAID" && order.status !== "PARTIALLY_REFUNDED") || (!creditItem && !templateOrder)) {
      return { error: "Refund hanya tersedia untuk order lisensi template atau top-up kredit yang sudah lunas.", status: 409 as const };
    }
    const templateItem = templateItems[0];
    const activationItem = activationItems[0];
    if (templateItem && (!templateItem.templateId || !templateItem.templateVersionId)) return { error: "Order lisensi tidak memiliki versi template terkait.", status: 409 as const };
    if (activationItem && (!activationItem.templateId || !activationItem.templateVersionId)) return { error: "Order aktivasi tidak memiliki versi template terkait.", status: 409 as const };
    if (templateItem && activationItem && (activationItem.templateId !== templateItem.templateId || activationItem.templateVersionId !== templateItem.templateVersionId)) {
      return { error: "Item aktivasi tidak cocok dengan lisensi template pada order.", status: 409 as const };
    }
    const settledRefundAmount = order.refunds.filter((refund) => refund.status === "SUCCEEDED").reduce((sum, refund) => sum + refund.amount, 0);
    const pendingRefundAmount = order.refunds.filter((refund) => refund.status === "INITIATING" || refund.status === "PENDING").reduce((sum, refund) => sum + refund.amount, 0);
    const availableAmount = order.totalAmount - settledRefundAmount - pendingRefundAmount;
    if (parsed.data.amount > availableAmount) return { error: `Jumlah refund melebihi sisa yang dapat dikembalikan (${availableAmount} ${order.currency}).`, status: 400 as const };

    let resellerCreditSku: "BASIC_ACTIVATION" | "PREMIUM_ACTIVATION" | null = null;
    let resellerCreditUnits = 0;
    let resellerCreditTopUpId: string | null = null;
    if (creditItem) {
      const item = creditItem;
      const snapshot = typeof item.entitlementSnapshot === "object" && item.entitlementSnapshot !== null && !Array.isArray(item.entitlementSnapshot) ? item.entitlementSnapshot as Record<string, unknown> : {};
      const creditSku = snapshot.creditSku;
      const purchasedUnits = Number(snapshot.units);
      if ((creditSku !== "BASIC_ACTIVATION" && creditSku !== "PREMIUM_ACTIVATION") || !Number.isSafeInteger(purchasedUnits) || purchasedUnits !== item.quantity || item.unitPriceIdr < 1 || item.totalPriceIdr !== item.unitPriceIdr * item.quantity) {
        return { error: "Snapshot top-up kredit tidak valid atau tidak dapat direkonsiliasi.", status: 409 as const };
      }
      if (parsed.data.amount % item.unitPriceIdr !== 0) return { error: "Refund top-up harus berupa jumlah kredit utuh dan mengikuti harga per kredit.", status: 400 as const };
      resellerCreditSku = creditSku;
      resellerCreditUnits = parsed.data.amount / item.unitPriceIdr;
      await lockResellerCreditBalance(tx, order.organizationId);
      const creditState = await getResellerCreditState(tx, order.organizationId, creditSku);
      if (!creditState.isConsistent) return { error: "Catatan kredit reseller belum dapat direkonsiliasi.", status: 409 as const };
      const topUps = creditState.entries.filter((entry) => entry.type === "TOP_UP" && entry.orderId === order.id);
      const topUp = topUps.length === 1 ? topUps[0] : null;
      if (!topUp || topUp.unitsDelta !== purchasedUnits) return { error: "Catatan kredit top-up belum lengkap untuk direfund.", status: 409 as const };
      resellerCreditTopUpId = topUp.id;
      const earlierRefundAmount = order.refunds.filter((refund) => refund.status === "SUCCEEDED" || refund.status === "INITIATING" || refund.status === "PENDING").reduce((sum, refund) => sum + refund.amount, 0);
      if (earlierRefundAmount % item.unitPriceIdr !== 0 || earlierRefundAmount / item.unitPriceIdr + resellerCreditUnits > purchasedUnits) return { error: "Sisa kredit dalam order ini tidak cukup untuk jumlah refund tersebut.", status: 409 as const };
      const topUpIndex = creditState.entries.findIndex((entry) => entry.id === topUp.id);
      const ambiguousLegacyActivation = creditState.entries.slice(topUpIndex + 1).some((entry) => entry.type === "ACTIVATION" && !entry.sourceTopUpId && !isUntrackedAdjustmentActivation(entry.metadata));
      if (ambiguousLegacyActivation) return { error: "Aktivasi lama setelah top-up ini belum memiliki catatan asal kredit. Refund ditolak sampai saldo dapat direkonsiliasi.", status: 409 as const };
      const lot = creditState.lots.find((candidate) => candidate.id === topUp.id);
      if (creditState.totalBalance < resellerCreditUnits || (lot?.unitsRemaining ?? 0) < resellerCreditUnits) {
        return { error: "Kredit dari pembelian top-up ini yang belum digunakan tidak cukup untuk jumlah refund tersebut.", status: 409 as const };
      }
    }
    const payment = order.paymentSessions.find((item) => item.status === "SUCCEEDED" && item.providerPaymentRequestId);
    if (!payment?.providerPaymentRequestId) return { error: "Referensi Payment Request Xendit belum tersedia untuk order ini.", status: 409 as const };
    const referenceId = randomUUID();
    const refund = await tx.refund.create({
      data: {
        orderId: order.id,
        paymentSessionId: payment.id,
        requestedById: userId,
        referenceId,
        amount: parsed.data.amount,
        currency: order.currency,
        reason: parsed.data.reason,
        adminNote: parsed.data.adminNote || null,
        requestSnapshot: { reference_id: referenceId, payment_request_id: payment.providerPaymentRequestId, amount: parsed.data.amount, currency: order.currency, reason: parsed.data.reason, resellerCreditSku, resellerCreditUnits },
      },
    });
    if (resellerCreditSku && resellerCreditUnits > 0) {
      await tx.creditLedger.create({
        data: {
          resellerOrgId: order.organizationId,
          orderId: order.id,
          ...(resellerCreditTopUpId ? { sourceTopUpId: resellerCreditTopUpId } : {}),
          sku: resellerCreditSku,
          type: "REFUND",
          unitsDelta: -resellerCreditUnits,
          reference: `refund:${refund.id}`,
          metadata: { refundId: refund.id, reserved: true },
        },
      });
    }
    await tx.auditLog.create({
      data: { organizationId: order.organizationId, actorId: userId, action: "admin.refund_requested", targetType: "Order", targetId: order.id, metadata: { refundId: refund.id, amount: refund.amount, currency: refund.currency, reason: refund.reason, referenceId: refund.referenceId, resellerCreditUnits } },
    });
    return { refund, paymentRequestId: payment.providerPaymentRequestId, invitationId: order.invitationId, organizationId: order.organizationId, amount: parsed.data.amount, currency: order.currency, itemType: creditItem ? "RESELLER_CREDIT" : "TEMPLATE_LICENSE" };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

  if ("error" in reservation) return NextResponse.json({ error: reservation.error }, { status: reservation.status });

  let response: Response;
  try {
    response = await fetch(getXenditApiUrl("refunds"), {
      method: "POST",
      headers: { authorization: `Basic ${Buffer.from(`${secret}:`).toString("base64")}`, "content-type": "application/json" },
      body: JSON.stringify({
        reference_id: reservation.refund.referenceId,
        payment_request_id: reservation.paymentRequestId,
        currency: reservation.currency,
        amount: reservation.amount,
        reason: parsed.data.reason,
        metadata: { order_id: id, refund_id: reservation.refund.id },
      }),
      signal: AbortSignal.timeout(20_000),
    });
  } catch {
    return NextResponse.json({ requested: true, refundId: reservation.refund.id, status: "INITIATING", message: "Xendit belum memberi konfirmasi. Jangan ajukan ulang; periksa status transaksi sebelum tindakan berikutnya." }, { status: 202 });
  }

  const providerBody = await response.json().catch(() => null) as XenditRefundResponse | Record<string, unknown> | null;
  if (!response.ok) {
    if (response.status >= 500) return NextResponse.json({ requested: true, refundId: reservation.refund.id, status: "INITIATING", message: "Xendit belum memberi konfirmasi. Jangan ajukan ulang; periksa status transaksi sebelum tindakan berikutnya." }, { status: 202 });
    await prisma.$transaction(async (tx) => {
      await tx.refund.update({ where: { id: reservation.refund.id }, data: { status: "FAILED", responseSnapshot: { ...safeProviderSnapshot(providerBody), httpStatus: response.status } } });
      await restoreResellerCreditsAfterFailedRefund(tx, reservation.refund.id);
      await tx.auditLog.create({ data: { organizationId: reservation.organizationId, actorId: userId, action: "admin.refund_rejected", targetType: "Order", targetId: id, metadata: { refundId: reservation.refund.id, httpStatus: response.status, errorCode: safeProviderSnapshot(providerBody).error_code ?? null } } });
    });
    return NextResponse.json({ error: "Xendit menolak permintaan refund. Periksa kelayakan channel pembayaran dan riwayat order." }, { status: 502 });
  }

  const result = providerBody as XenditRefundResponse | null;
  const status = result?.status;
  const mappedStatus = status === "SUCCEEDED" ? "SUCCEEDED" : status === "FAILED" ? "FAILED" : status === "CANCELLED" ? "CANCELLED" : status === "PENDING" ? "PENDING" : null;
  if (!result?.id || !mappedStatus || result.reference_id !== reservation.refund.referenceId || result.payment_request_id !== reservation.paymentRequestId || result.amount !== reservation.amount || result.currency !== reservation.currency) {
    return NextResponse.json({ requested: true, refundId: reservation.refund.id, status: "INITIATING", message: "Xendit menerima respons yang belum dapat dipadankan. Jangan ajukan ulang; tunggu webhook atau rekonsiliasi transaksi." }, { status: 202 });
  }

  await prisma.$transaction(async (tx) => {
    await tx.refund.update({ where: { id: reservation.refund.id }, data: { providerRefundId: result.id, status: mappedStatus, failureCode: result.failure_code ?? null, responseSnapshot: JSON.parse(JSON.stringify(result)) } });
    if (mappedStatus === "SUCCEEDED") {
    await recalculateRefundedOrder(tx, id);
      await tx.auditLog.create({ data: { organizationId: reservation.organizationId, actorId: userId, action: "admin.refund_succeeded", targetType: "Order", targetId: id, metadata: { refundId: reservation.refund.id, amount: reservation.amount, currency: reservation.currency, invitationId: reservation.invitationId } } });
    }
  });

  if (mappedStatus === "FAILED" || mappedStatus === "CANCELLED") {
    await prisma.$transaction((tx) => restoreResellerCreditsAfterFailedRefund(tx, reservation.refund.id));
  }
  return NextResponse.json({ requested: true, refundId: reservation.refund.id, status: mappedStatus }, { status: mappedStatus === "PENDING" ? 202 : 200 });
}
