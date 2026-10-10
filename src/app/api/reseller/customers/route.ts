import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { getApprovedReseller } from "@/lib/reseller-server";
import { readJsonBody } from "@/lib/request-json";
import { getTemplate } from "@/lib/templates";

export const runtime = "nodejs";

const customerSchema = z.object({ email: z.email().trim().toLowerCase().max(254) });

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const reseller = await getApprovedReseller(userId);
  if (!reseller) return NextResponse.json({ error: "Akun reseller belum disetujui." }, { status: 403 });

  const customers = await getPrismaClient().resellerCustomer.findMany({
    where: { resellerOrgId: reseller.organizationId, status: "ACTIVE", customer: { type: "PERSONAL", status: "ACTIVE" } },
    orderBy: { createdAt: "desc" },
    include: {
      customer: {
        select: {
          id: true,
          name: true,
          memberships: { where: { role: "OWNER" }, take: 1, select: { user: { select: { id: true, name: true, email: true } } } },
          invitations: {
            where: { deletedAt: null, status: { in: ["DRAFT", "PUBLISHED"] } },
            orderBy: { updatedAt: "desc" },
            take: 50,
            select: { id: true, title: true, slug: true, status: true, resellerOrgId: true, templateVersion: { select: { template: { select: { slug: true } } } } },
          },
        },
      },
    },
  });

  return NextResponse.json({ customers: customers.map(({ customer }) => {
    const owner = customer.memberships[0]?.user;
    return {
      organizationId: customer.id,
      name: owner?.name || customer.name.replace(/^Ruang /, ""),
      email: owner?.email ?? "",
      invitations: customer.invitations.map((invitation) => {
        const template = getTemplate(invitation.templateVersion.template.slug);
        return {
          id: invitation.id,
          title: invitation.title,
          slug: invitation.slug,
          status: invitation.status,
          alreadyAssigned: Boolean(invitation.resellerOrgId && invitation.resellerOrgId !== reseller.organizationId),
          activationSku: template?.activationSku ?? null,
        };
      }),
    };
  }) });
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const reseller = await getApprovedReseller(userId);
  if (!reseller) return NextResponse.json({ error: "Akun reseller belum disetujui." }, { status: 403 });
  if (!await allowRequest(`reseller:customer:${userId}`, 20, 60 * 60)) return NextResponse.json({ error: "Terlalu banyak penambahan pelanggan. Coba lagi nanti." }, { status: 429 });
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Email pelanggan tidak valid." }, { status: body.status });
  const parsed = customerSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Masukkan alamat email akun pelanggan yang valid." }, { status: 400 });

  const prisma = getPrismaClient();
  const owner = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      memberships: { where: { role: "OWNER", organization: { type: "PERSONAL", status: "ACTIVE" } }, take: 1, select: { organizationId: true } },
    },
  });
  const customerOrgId = owner?.memberships[0]?.organizationId;
  if (!owner || !customerOrgId) return NextResponse.json({ error: "Akun pelanggan belum ditemukan. Minta pelanggan mendaftar terlebih dahulu." }, { status: 404 });
  if (owner.id === userId) return NextResponse.json({ error: "Gunakan akun pelanggan yang berbeda dari akun reseller." }, { status: 400 });

  const link = await prisma.$transaction(async (tx) => {
    const existing = await tx.resellerCustomer.findUnique({
      where: { resellerOrgId_customerOrgId: { resellerOrgId: reseller.organizationId, customerOrgId } },
      select: { id: true, status: true },
    });
    if (existing) return existing;
    const customerLink = await tx.resellerCustomer.create({ data: { resellerOrgId: reseller.organizationId, customerOrgId }, select: { id: true, status: true } });
    await tx.auditLog.create({
      data: { organizationId: reseller.organizationId, actorId: userId, action: "reseller.customer_access_requested", targetType: "Organization", targetId: customerOrgId, metadata: { email: parsed.data.email } },
    });
    return customerLink;
  });
  if (link.status === "DECLINED" || link.status === "REVOKED") {
    return NextResponse.json({ error: "Pelanggan sudah menolak atau mencabut akses untuk workspace ini." }, { status: 409 });
  }
  return NextResponse.json({ linked: link.status === "ACTIVE", pendingApproval: link.status === "PENDING", customerId: link.id }, { status: link.status === "ACTIVE" ? 200 : 202 });
}
