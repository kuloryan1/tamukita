import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { fulfillPaidOrder, paidSessionInclude } from "@/lib/order-fulfillment";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";
import { containsControlCharacters } from "@/lib/text";

const safeText = z.string().trim().min(5).max(100).refine(value => !containsControlCharacters(value));
const schema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("confirm"), amountIdr: z.number().int().positive(), reference: safeText, fundsReceived: z.literal(true), note: z.string().trim().max(500).default("") }).strict(),
  z.object({ action: z.literal("cancel"), reason: z.string().trim().min(5).max(500) }).strict(),
]);
class ManualPaymentConflict extends Error {}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const actorId = session?.user?.id;
  if (!actorId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const prisma = getPrismaClient();
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { platformRole: true } });
  if (actor?.platformRole !== "SUPER_ADMIN" && actor?.platformRole !== "FINANCE") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  if (!await allowRequest(`admin:manual-payment:${actorId}`, 60, 3_600)) return NextResponse.json({ error: "Terlalu banyak perubahan pembayaran. Coba lagi nanti." }, { status: 429 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  const body = await readJsonBody(request, 3_000);
  if (!body.ok) return NextResponse.json({ error: "Detail konfirmasi tidak valid." }, { status: body.status });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Isi nominal, referensi transaksi, dan konfirmasi dana masuk dengan benar." }, { status: 400 });
  const input = parsed.data;

  try {
    const result = await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM "orders" WHERE id = ${id}::uuid FOR UPDATE`;
      const payment = await tx.paymentSession.findFirst({ where: { orderId: id, provider: "MANUAL" }, orderBy: { createdAt: "desc" }, include: paidSessionInclude });
      if (!payment) throw new ManualPaymentConflict("Order QR manual tidak ditemukan.");
      if (input.action === "cancel") {
        if (payment.order.status === "CANCELED") return { status: "CANCELED", alreadyProcessed: true };
        if (payment.order.status !== "PENDING" || payment.status !== "PENDING") throw new ManualPaymentConflict("Order yang sudah dibayar tidak dapat dibatalkan. Gunakan pencatatan refund.");
        await tx.order.update({ where: { id }, data: { status: "CANCELED", canceledAt: new Date() } });
        await tx.paymentSession.update({ where: { id: payment.id }, data: { status: "EXPIRED" } });
        await tx.auditLog.create({ data: { actorId, organizationId: payment.order.organizationId, action: "admin.manual_payment_canceled", targetType: "Order", targetId: id, metadata: { reason: input.reason } } });
        return { status: "CANCELED", alreadyProcessed: false };
      }
      if (input.amountIdr !== payment.amountIdr || input.amountIdr !== payment.order.totalAmount) throw new ManualPaymentConflict("Nominal dana masuk harus sama dengan total order.");
      const referenceId = `manual:${createHash("sha256").update(input.reference.replace(/\s+/g, "").toUpperCase()).digest("hex")}`;
      if (payment.status === "SUCCEEDED" && payment.order.status === "PAID") {
        if (payment.providerPaymentId !== referenceId) throw new ManualPaymentConflict("Order sudah dikonfirmasi memakai referensi transaksi lain.");
        return { status: "PAID", alreadyProcessed: true };
      }
      if (payment.order.status !== "PENDING" || payment.status !== "PENDING") throw new ManualPaymentConflict("Status order sudah berubah. Muat ulang sebelum mengonfirmasi.");
      const organization = await tx.organization.findFirst({ where: { id: payment.order.organizationId, status: "ACTIVE" }, select: { id: true } });
      if (!organization || (payment.order.invitation && (payment.order.invitation.deletedAt || !["DRAFT", "PUBLISHED", "EXPIRED"].includes(payment.order.invitation.status)))) throw new ManualPaymentConflict("Workspace atau undangan tidak aktif. Tinjau order sebelum mengonfirmasi pembayaran.");
      await fulfillPaidOrder(tx, payment, { paymentId: referenceId });
      const confirmedAt = new Date();
      await tx.paymentSession.update({ where: { id: payment.id }, data: { responseSnapshot: { reference: input.reference, note: input.note, confirmedBy: actorId, confirmedAt: confirmedAt.toISOString() } } });
      await tx.paymentEvent.create({ data: { provider: "MANUAL", providerEventId: referenceId, eventType: "manual.payment_confirmed", orderId: id, paymentSessionId: payment.id, payload: { amountIdr: input.amountIdr, reference: input.reference, confirmedBy: actorId }, processedAt: confirmedAt } });
      await tx.auditLog.create({ data: { actorId, organizationId: payment.order.organizationId, action: "admin.manual_payment_confirmed", targetType: "Order", targetId: id, metadata: { amountIdr: input.amountIdr, reference: input.reference, note: input.note } } });
      return { status: "PAID", alreadyProcessed: false };
    }, { isolationLevel: "Serializable" });
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof ManualPaymentConflict) return NextResponse.json({ error: error.message }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Referensi transaksi sudah digunakan. Periksa order lain sebelum mencoba kembali." }, { status: 409 });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2034") return NextResponse.json({ error: "Order sedang diperbarui oleh proses lain. Muat ulang status sebelum mencoba kembali." }, { status: 409 });
    console.error("Manual payment confirmation failed", { orderId: id, error: error instanceof Error ? error.name : "unknown" });
    return NextResponse.json({ error: "Order belum dapat dikonfirmasi. Periksa rincian order dan coba kembali." }, { status: 409 });
  }
}
