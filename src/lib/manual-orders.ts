import "server-only";

import { getPrismaClient } from "@/lib/prisma";
import { manualPaymentSnapshotSchema, manualPaymentWhatsappUrl } from "@/lib/payment-methods";

export async function getManualOrderPayment(orderId: string, buyerId: string) {
  const order = await getPrismaClient().order.findFirst({
    where: { id: orderId, buyerId, organization: { status: "ACTIVE", memberships: { some: { userId: buyerId } } } },
    select: {
      id: true, status: true, totalAmount: true, currency: true, createdAt: true,
      invitation: { select: { id: true, title: true, slug: true, status: true, deletedAt: true } },
      items: { select: { itemType: true, sku: true, quantity: true } },
      paymentSessions: { where: { provider: "MANUAL" }, orderBy: { createdAt: "desc" }, take: 1, select: { status: true, requestSnapshot: true } },
    },
  });
  const payment = order?.paymentSessions[0];
  const snapshot = manualPaymentSnapshotSchema.safeParse(payment?.requestSnapshot);
  if (!order || !payment || !snapshot.success) return null;
  const kind = order.items.some(item => item.itemType === "RESELLER_CREDIT") ? "reseller"
    : order.items.some(item => item.itemType === "RENEWAL") ? "renewal" : "invitation";
  return {
    id: order.id, code: `TK-${order.id.slice(0, 8).toUpperCase()}`, status: order.status,
    amountIdr: order.totalAmount, paymentStatus: payment.status, createdAt: order.createdAt.toISOString(), kind,
    qrImageUrl: snapshot.data.qrImageUrl,
    whatsappUrl: manualPaymentWhatsappUrl(snapshot.data.whatsapp, order.id, order.totalAmount),
    invitationId: order.invitation?.id ?? null,
    invitationTitle: order.invitation?.title ?? "Pembelian kredit reseller",
    publishedSlug: order.invitation?.status === "PUBLISHED" && !order.invitation.deletedAt ? order.invitation.slug : null,
  };
}

export type ManualOrderPayment = NonNullable<Awaited<ReturnType<typeof getManualOrderPayment>>>;
