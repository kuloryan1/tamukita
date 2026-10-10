import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const decisionSchema = z.object({ decision: z.enum(["APPROVE", "DECLINE", "REVOKE"]) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "Permintaan tidak valid." }, { status: 400 });
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Pilihan tidak valid." }, { status: body.status });
  const parsed = decisionSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Pilihan akses tidak valid." }, { status: 400 });

  const prisma = getPrismaClient();
  const previousStatus = parsed.data.decision === "REVOKE" ? "ACTIVE" : "PENDING";
  const customerLink = await prisma.resellerCustomer.findFirst({
    where: {
      id,
      status: previousStatus,
      customer: { type: "PERSONAL", status: "ACTIVE", memberships: { some: { userId, role: "OWNER" } } },
    },
    select: { id: true, resellerOrgId: true, customerOrgId: true, customer: { select: { name: true } }, reseller: { select: { name: true, resellerProfile: { select: { businessName: true } } } } },
  });
  if (!customerLink) return NextResponse.json({ error: "Permintaan tidak ditemukan." }, { status: 404 });

  const status = parsed.data.decision === "APPROVE" ? "ACTIVE" : parsed.data.decision === "REVOKE" ? "REVOKED" : "DECLINED";
  const updated = await prisma.$transaction(async (tx) => {
    const result = await tx.resellerCustomer.updateMany({ where: { id, customerOrgId: customerLink.customerOrgId, status: previousStatus }, data: { status, approvedAt: status === "ACTIVE" ? new Date() : null } });
    if (result.count !== 1) return false;
    await tx.auditLog.create({
      data: { organizationId: customerLink.customerOrgId, actorId: userId, action: status === "ACTIVE" ? "reseller.access_approved" : status === "REVOKED" ? "reseller.access_revoked" : "reseller.access_declined", targetType: "Organization", targetId: customerLink.resellerOrgId, metadata: { resellerName: customerLink.reseller.resellerProfile?.businessName ?? customerLink.reseller.name } },
    });
    await tx.auditLog.create({
      data: { organizationId: customerLink.resellerOrgId, actorId: userId, action: status === "ACTIVE" ? "reseller.customer_approved" : status === "REVOKED" ? "reseller.customer_access_revoked" : "reseller.customer_declined", targetType: "Organization", targetId: customerLink.customerOrgId },
    });
    const recipients = await tx.membership.findMany({
      where: { organizationId: customerLink.resellerOrgId, role: { in: ["OWNER", "ADMIN", "RESELLER_STAFF"] } },
      select: { userId: true, user: { select: { name: true, email: true } } },
    });
    const resellerName = customerLink.reseller.resellerProfile?.businessName ?? customerLink.reseller.name;
    const notificationDecision = status === "ACTIVE" ? "APPROVED" : status;
    for (const recipient of recipients) {
      if (!recipient.user.email) continue;
      await tx.notificationJob.upsert({
        where: { jobKey: `reseller-customer-access:${id}:${status}:${recipient.userId}` },
        create: {
          jobKey: `reseller-customer-access:${id}:${status}:${recipient.userId}`,
          jobType: "RESELLER_CUSTOMER_ACCESS_EMAIL",
          payload: { to: recipient.user.email, name: recipient.user.name ?? "", resellerName, customerName: customerLink.customer.name, decision: notificationDecision, dashboardPath: "/reseller" },
        },
        update: {},
      });
    }
    return true;
  });
  if (!updated) return NextResponse.json({ error: "Permintaan sudah diproses." }, { status: 409 });
  return NextResponse.json({ updated: true, status });
}
