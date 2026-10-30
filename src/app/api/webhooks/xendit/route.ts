import { createHash, timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { fulfillPaidOrder } from "@/lib/order-fulfillment";
import { getPrismaClient } from "@/lib/prisma";
import { recalculateRefundedOrder, restoreResellerCreditsAfterFailedRefund } from "@/lib/refunds";
import { lockResellerCreditBalance } from "@/lib/reseller-credits";

export const runtime = "nodejs";

type XenditSessionWebhook = {
  event?: string;
  data?: {
    payment_session_id?: string;
    reference_id?: string;
    payment_id?: string | null;
    payment_request_id?: string | null;
    id?: string;
    failure_code?: string | null;
    status?: string;
    amount?: number;
    currency?: string;
  };
};

function matchesToken(expected: string, actual: string) {
  const expectedBytes = Buffer.from(expected);
  const actualBytes = Buffer.from(actual);
  return expectedBytes.length === actualBytes.length && timingSafeEqual(expectedBytes, actualBytes);
}

async function processRefundWebhook(payload: XenditSessionWebhook, rawBody: string) {
  const data = payload.data;
  const eventType = payload.event;
  const expectedStatus = eventType === "refund.succeeded" ? "SUCCEEDED" : "FAILED";
  if (!data?.id || !data.reference_id || !data.payment_request_id || !Number.isSafeInteger(data.amount) || !data.currency || data.status !== expectedStatus) {
    return NextResponse.json({ error: "Payload refund tidak valid." }, { status: 400 });
  }
  const prisma = getPrismaClient();
  const providerEventId = createHash("sha256").update(eventType ?? "").update(":").update(data.id).digest("hex");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const priorEvent = await tx.paymentEvent.findUnique({ where: { provider_providerEventId: { provider: "XENDIT", providerEventId } }, select: { id: true } });
      if (priorEvent) return { duplicate: true, processed: true };
      const initialRefund = await tx.refund.findUnique({
        where: { referenceId: data.reference_id },
        include: {
          paymentSession: { select: { providerPaymentRequestId: true } },
          order: { select: { id: true, organizationId: true, items: { select: { itemType: true } } } },
        },
      });
      if (!initialRefund) return { duplicate: false, processed: false, missing: true };
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "orders" WHERE "id" = ${initialRefund.order.id}::uuid FOR UPDATE`;
      if (initialRefund.order.items.some((item) => item.itemType === "RESELLER_CREDIT")) {
        await lockResellerCreditBalance(tx, initialRefund.order.organizationId);
      }
      const refund = await tx.refund.findUnique({
        where: { id: initialRefund.id },
        include: {
          paymentSession: { select: { providerPaymentRequestId: true } },
          order: { select: { id: true, organizationId: true, items: { select: { itemType: true } } } },
        },
      });
      if (!refund) return { duplicate: false, processed: false, missing: true };
      const matches = refund.paymentSession.providerPaymentRequestId === data.payment_request_id
        && refund.amount === data.amount
        && refund.currency === data.currency
        && (!refund.providerRefundId || refund.providerRefundId === data.id);
      const matchesExpectedStatus = (eventType === "refund.succeeded" && data.status === "SUCCEEDED") || (eventType === "refund.failed" && data.status === "FAILED");
      const isValid = matches && matchesExpectedStatus;
      await tx.paymentEvent.create({
        data: {
          provider: "XENDIT",
          providerEventId,
          eventType: eventType ?? "refund.unknown",
          paymentSessionId: refund.paymentSessionId,
          orderId: refund.orderId,
          payload: JSON.parse(rawBody),
          processedAt: isValid ? new Date() : null,
          processingError: isValid ? null : "Refund callback does not match the stored request.",
        },
      });
      if (!isValid) return { duplicate: false, processed: false };
      const nextStatus = eventType === "refund.succeeded" ? "SUCCEEDED" : "FAILED";
      const claimed = await tx.refund.updateMany({
        where: { id: refund.id, status: { in: ["INITIATING", "PENDING"] } },
        data: { providerRefundId: data.id, status: nextStatus, failureCode: data.failure_code ?? null, responseSnapshot: JSON.parse(rawBody) },
      });
      if (claimed.count === 1) {
        if (nextStatus === "SUCCEEDED") await recalculateRefundedOrder(tx, refund.orderId);
        else await restoreResellerCreditsAfterFailedRefund(tx, refund.id);
        await tx.auditLog.create({ data: { organizationId: refund.order.organizationId, action: nextStatus === "SUCCEEDED" ? "payment.refund_succeeded" : "payment.refund_failed", targetType: "Refund", targetId: refund.id, metadata: { orderId: refund.orderId, amount: refund.amount, currency: refund.currency, failureCode: data.failure_code ?? null } } });
      }
      return { duplicate: false, processed: claimed.count === 1 };
    });
    if ("missing" in result && result.missing) return NextResponse.json({ error: "Refund belum ditemukan." }, { status: 404 });
    return NextResponse.json({ received: true, duplicate: result.duplicate, processed: result.processed });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const duplicateEvent = await prisma.paymentEvent.findUnique({ where: { provider_providerEventId: { provider: "XENDIT", providerEventId } }, select: { id: true } });
      if (duplicateEvent) return NextResponse.json({ received: true, duplicate: true });
    }
    throw error;
  }
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (Buffer.byteLength(rawBody, "utf8") > 256_000) return NextResponse.json({ error: "Payload webhook terlalu besar." }, { status: 413 });
  let payload: XenditSessionWebhook;
  try {
    payload = JSON.parse(rawBody) as XenditSessionWebhook;
  } catch {
    return NextResponse.json({ error: "Payload webhook tidak valid." }, { status: 400 });
  }
  const isRefundEvent = payload.event === "refund.succeeded" || payload.event === "refund.failed";
  const eventType = payload.event ?? "";
  const expectedToken = isRefundEvent ? process.env.XENDIT_REFUND_WEBHOOK_TOKEN : process.env.XENDIT_WEBHOOK_TOKEN;
  if (!expectedToken) return NextResponse.json({ error: "Webhook belum dikonfigurasi." }, { status: 503 });
  const receivedToken = request.headers.get("x-callback-token") ?? "";
  if (!matchesToken(expectedToken, receivedToken)) return NextResponse.json({ error: "Token webhook tidak valid." }, { status: 401 });
  if (isRefundEvent) return processRefundWebhook(payload, rawBody);
  const data = payload.data;
  if (!data?.payment_session_id || !data.reference_id || !["payment_session.completed", "payment_session.expired"].includes(eventType)) {
    return NextResponse.json({ received: true, ignored: true });
  }

  const prisma = getPrismaClient();
  const eventId = createHash("sha256").update(rawBody).digest("hex");
  try {
    const result = await prisma.$transaction(async (tx) => {
      const initialPaymentSession = await tx.paymentSession.findUnique({
        where: { providerSessionId: data.payment_session_id },
        include: { order: { include: { items: true, invitation: true, buyer: { select: { name: true, email: true } } } } },
      });
      if (!initialPaymentSession) return "retryable" as const;
      await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "orders" WHERE "id" = ${initialPaymentSession.orderId}::uuid FOR UPDATE`;
      const paymentSession = await tx.paymentSession.findUnique({
        where: { id: initialPaymentSession.id },
        include: { order: { include: { items: true, invitation: true, buyer: { select: { name: true, email: true } } } } },
      });
      if (!paymentSession) return "retryable" as const;
      const isCompleted = eventType === "payment_session.completed";
      const statusMatches = isCompleted ? data.status === "COMPLETED" : data.status === "EXPIRED";
      const amountMatches = data.amount === paymentSession.amountIdr && data.currency === paymentSession.currency;
      const orderMatches = paymentSession.order.id === data.reference_id && paymentSession.order.totalAmount === data.amount;
      await tx.paymentEvent.create({
        data: {
          provider: "XENDIT",
          providerEventId: eventId,
          eventType,
          paymentSessionId: paymentSession.id,
          orderId: paymentSession.orderId,
          payload: JSON.parse(rawBody),
          processedAt: statusMatches && amountMatches && orderMatches ? new Date() : null,
          processingError: !statusMatches || !amountMatches || !orderMatches ? "Webhook session, amount, currency, atau status tidak cocok." : null,
        },
      });
      if (!statusMatches || !amountMatches || !orderMatches) return;
      if (!isCompleted && (paymentSession.status === "SUCCEEDED" || paymentSession.order.status === "PAID")) return;
      if (isCompleted && paymentSession.status === "SUCCEEDED" && paymentSession.order.status === "PAID") return;

      if (isCompleted) {
        await fulfillPaidOrder(tx, paymentSession, { paymentId: data.payment_id, paymentRequestId: data.payment_request_id });
      } else {
        await tx.paymentSession.update({ where: { id: paymentSession.id }, data: { status: "EXPIRED" } });
        await tx.order.update({ where: { id: paymentSession.orderId }, data: { status: "EXPIRED" } });
      }
    });
    if (result === "retryable") {
      return NextResponse.json({ error: "Sesi pembayaran belum siap diproses; webhook dapat dicoba ulang.", retryable: true }, { status: 503 });
    }
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const duplicateEvent = await prisma.paymentEvent.findUnique({
        where: { provider_providerEventId: { provider: "XENDIT", providerEventId: eventId } },
        select: { id: true },
      });
      if (duplicateEvent) return NextResponse.json({ received: true, duplicate: true });
    }
    throw error;
  }
  return NextResponse.json({ received: true });
}
