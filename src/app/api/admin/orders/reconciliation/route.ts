import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";

const MAX_EXPORT_ROWS = 10_000;
const DAY_MS = 24 * 60 * 60 * 1000;

const headers = [
  "record_type",
  "recorded_at",
  "order_id",
  "order_status",
  "order_amount_idr",
  "order_currency",
  "payment_session_id",
  "xendit_session_id",
  "xendit_payment_request_id",
  "xendit_payment_id",
  "payment_status",
  "payment_amount_idr",
  "payment_currency",
  "order_items",
  "payment_event_log_id",
  "xendit_event_object_id",
  "event_type",
  "event_reference_id",
  "event_status",
  "event_amount_idr",
  "event_currency",
  "refund_id",
  "xendit_refund_id",
  "refund_reference_id",
  "refund_status",
  "refund_amount_idr",
  "refund_currency",
] as const;

type CsvValue = string | number | null | undefined;

function csvCell(value: CsvValue) {
  const raw = value == null ? "" : String(value);
  const safe = /^\s*[=+@-]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replaceAll('"', '""')}"`;
}

function dateRange(fromValue: string | null, toValue: string | null) {
  const validDate = (value: string | null) => {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value ? date : null;
  };
  const from = validDate(fromValue);
  const to = validDate(toValue);
  if (!from || !to || to < from) return null;
  const days = (to.getTime() - from.getTime()) / DAY_MS + 1;
  if (days > 31) return null;
  return { from, toExclusive: new Date(to.getTime() + DAY_MS) };
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function providerData(payload: unknown) {
  const root = record(payload);
  return record(root?.data) ?? root;
}

function providerText(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value) : null;
}

function providerAmount(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : null;
}

function csvRow(values: CsvValue[]) {
  return headers.map((_, index) => csvCell(values[index])).join(",");
}

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (user?.platformRole !== "SUPER_ADMIN" && user?.platformRole !== "FINANCE") {
    return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  }

  const url = new URL(request.url);
  const range = dateRange(url.searchParams.get("from"), url.searchParams.get("to"));
  if (!range) {
    return NextResponse.json({ error: "Pilih rentang UTC yang valid, maksimal 31 hari." }, { status: 400 });
  }
  const period = { gte: range.from, lt: range.toExclusive };
  const orderWhere = { createdAt: period };
  const eventWhere = { receivedAt: period };
  const refundWhere = { createdAt: period };

  const [orderWithoutSessionCount, paymentSessionCount, paymentEventCount, refundCount] = await Promise.all([
    prisma.order.count({ where: { ...orderWhere, paymentSessions: { none: {} } } }),
    prisma.paymentSession.count({ where: { createdAt: period } }),
    prisma.paymentEvent.count({ where: eventWhere }),
    prisma.refund.count({ where: refundWhere }),
  ]);
  const rowCount = orderWithoutSessionCount + paymentSessionCount + paymentEventCount + refundCount;
  if (rowCount > MAX_EXPORT_ROWS) {
    return NextResponse.json({ error: "Rentang ini memuat lebih dari 10.000 baris. Persempit rentang tanggal." }, { status: 422 });
  }

  const [ordersWithoutSession, paymentSessions, paymentEvents, refunds] = await Promise.all([
    prisma.order.findMany({
      where: { ...orderWhere, paymentSessions: { none: {} } },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: { id: true, status: true, totalAmount: true, currency: true, createdAt: true },
    }),
    prisma.paymentSession.findMany({
      where: { createdAt: period },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        providerSessionId: true,
        providerPaymentRequestId: true,
        providerPaymentId: true,
        status: true,
        amountIdr: true,
        currency: true,
        createdAt: true,
        order: {
          select: {
            id: true,
            status: true,
            totalAmount: true,
            currency: true,
            items: { orderBy: { createdAt: "asc" }, select: { sku: true, quantity: true, unitPriceIdr: true } },
          },
        },
      },
    }),
    prisma.paymentEvent.findMany({
      where: eventWhere,
      orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        providerEventId: true,
        eventType: true,
        payload: true,
        receivedAt: true,
        order: { select: { id: true, status: true, totalAmount: true, currency: true } },
        paymentSession: {
          select: {
            id: true,
            providerSessionId: true,
            providerPaymentRequestId: true,
            providerPaymentId: true,
            status: true,
            amountIdr: true,
            currency: true,
            order: { select: { id: true, status: true, totalAmount: true, currency: true } },
          },
        },
      },
    }),
    prisma.refund.findMany({
      where: refundWhere,
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        providerRefundId: true,
        referenceId: true,
        status: true,
        amount: true,
        currency: true,
        createdAt: true,
        order: { select: { id: true, status: true, totalAmount: true, currency: true } },
        paymentSession: {
          select: {
            id: true,
            providerSessionId: true,
            providerPaymentRequestId: true,
            providerPaymentId: true,
            status: true,
          },
        },
      },
    }),
  ]);

  const rows: CsvValue[][] = [
    [...headers],
    ...ordersWithoutSession.map((order) => [
      "ORDER_WITHOUT_PAYMENT", order.createdAt.toISOString(), order.id, order.status,
      order.totalAmount, order.currency,
    ]),
    ...paymentSessions.map((payment) => [
      "PAYMENT_SESSION", payment.createdAt.toISOString(), payment.order.id, payment.order.status,
      payment.order.totalAmount, payment.order.currency, payment.id, payment.providerSessionId,
      payment.providerPaymentRequestId, payment.providerPaymentId, payment.status,
      payment.amountIdr, payment.currency,
      payment.order.items.map((item) => `${item.sku} × ${item.quantity} @ ${item.unitPriceIdr}`).join(" | "),
    ]),
    ...paymentEvents.map((event) => {
      const data = providerData(event.payload);
      const payment = event.paymentSession;
      const order = payment?.order ?? event.order;
      return [
        "PAYMENT_EVENT", event.receivedAt.toISOString(), order?.id, order?.status,
        order?.totalAmount, order?.currency, payment?.id,
        payment?.providerSessionId ?? providerText(data?.payment_session_id),
        payment?.providerPaymentRequestId ?? providerText(data?.payment_request_id),
        payment?.providerPaymentId ?? providerText(data?.payment_id), payment?.status,
        payment?.amountIdr, payment?.currency, undefined, event.id,
        providerText(data?.id), event.eventType, providerText(data?.reference_id),
        providerText(data?.status), providerAmount(data?.amount), providerText(data?.currency),
      ];
    }),
    ...refunds.map((refund) => [
      "REFUND", refund.createdAt.toISOString(), refund.order.id, refund.order.status,
      refund.order.totalAmount, refund.order.currency, refund.paymentSession.id,
      refund.paymentSession.providerSessionId, refund.paymentSession.providerPaymentRequestId,
      refund.paymentSession.providerPaymentId, refund.paymentSession.status, undefined, undefined,
      undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined,
      refund.id, refund.providerRefundId, refund.referenceId, refund.status, refund.amount, refund.currency,
    ]),
  ];

  const csv = `\uFEFF${rows.map(csvRow).join("\r\n")}\r\n`;
  const fromLabel = range.from.toISOString().slice(0, 10);
  const toLabel = new Date(range.toExclusive.getTime() - DAY_MS).toISOString().slice(0, 10);
  await prisma.auditLog.create({
    data: {
      actorId: userId,
      action: "admin.order_reconciliation_exported",
      targetType: "PaymentReconciliation",
      targetId: `${fromLabel}:${toLabel}`,
      metadata: { from: fromLabel, to: toLabel, rowCount, orderWithoutSessionCount, paymentSessionCount, paymentEventCount, refundCount },
    },
  });
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="tamukita-reconciliation-${fromLabel}-${toLabel}.csv"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
