import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { lockResellerCreditBalance } from "@/lib/reseller-credits";

export async function restoreResellerCreditsAfterFailedRefund(tx: Prisma.TransactionClient, refundId: string) {
  const refund = await tx.refund.findUnique({
    where: { id: refundId },
    select: { id: true, orderId: true, order: { select: { id: true, organizationId: true } }, requestSnapshot: true },
  });
  if (!refund || typeof refund.requestSnapshot !== "object" || refund.requestSnapshot === null || Array.isArray(refund.requestSnapshot)) return false;
  const snapshot = refund.requestSnapshot as Record<string, unknown>;
  const sku = snapshot.resellerCreditSku;
  const units = Number(snapshot.resellerCreditUnits);
  if ((sku !== "BASIC_ACTIVATION" && sku !== "PREMIUM_ACTIVATION") || !Number.isSafeInteger(units) || units <= 0) return false;
  await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "orders" WHERE "id" = ${refund.orderId}::uuid FOR UPDATE`;
  await lockResellerCreditBalance(tx, refund.order.organizationId);
  const topUp = await tx.creditLedger.findFirst({
    where: { orderId: refund.orderId, resellerOrgId: refund.order.organizationId, sku, type: "TOP_UP" },
    select: { id: true },
  });
  if (!topUp) return false;
  await tx.creditLedger.upsert({
    where: { resellerOrgId_reference: { resellerOrgId: refund.order.organizationId, reference: `refund-failed:${refund.id}` } },
    create: {
      resellerOrgId: refund.order.organizationId,
      orderId: refund.orderId,
      sourceTopUpId: topUp.id,
      sku,
      type: "ADJUSTMENT",
      unitsDelta: units,
      reference: `refund-failed:${refund.id}`,
      metadata: { refundId: refund.id, reason: "Xendit refund failed; reserved credits restored." },
    },
    update: {},
  });
  return true;
}

export async function recalculateRefundedOrder(tx: Prisma.TransactionClient, orderId: string) {
  const order = await tx.order.findUnique({ where: { id: orderId }, select: { id: true, totalAmount: true, invitationId: true } });
  if (!order) return null;
  const aggregate = await tx.refund.aggregate({ where: { orderId, status: "SUCCEEDED" }, _sum: { amount: true } });
  const refundedAmount = aggregate._sum.amount ?? 0;
  const status = refundedAmount >= order.totalAmount ? "REFUNDED" : refundedAmount > 0 ? "PARTIALLY_REFUNDED" : "PAID";
  await tx.order.update({ where: { id: orderId }, data: { status } });
  if (status === "REFUNDED" && order.invitationId) {
    await tx.invitation.updateMany({ where: { id: order.invitationId, status: { in: ["PUBLISHED", "SUSPENDED"] } }, data: { status: "EXPIRED" } });
  }
  return { status, refundedAmount };
}
