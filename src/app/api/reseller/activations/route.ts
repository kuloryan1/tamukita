import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { eventStartsAt, invitationTitle, parseInvitationDraft } from "@/lib/invitation-server";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { getApprovedReseller } from "@/lib/reseller-server";
import { getResellerCreditState, lockResellerCreditBalance } from "@/lib/reseller-credits";
import { readJsonBody } from "@/lib/request-json";
import { isEditorCompatibleTemplate, isTemplateSelectable, validateTemplateManifest } from "@/lib/template-sdk";
import { getHostingTermDays } from "@/lib/platform-settings";
import { validateInvitationDraft } from "@/lib/validation";

export const runtime = "nodejs";

const activationSchema = z.object({ invitationId: z.string().uuid() });

class ActivationError extends Error {
  constructor(message: string, readonly status: number) { super(message); }
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const reseller = await getApprovedReseller(userId);
  if (!reseller) return NextResponse.json({ error: "Akun reseller belum disetujui." }, { status: 403 });
  if (!await allowRequest(`reseller:activation:${userId}`, 30, 60 * 60)) return NextResponse.json({ error: "Terlalu banyak percobaan aktivasi. Coba lagi nanti." }, { status: 429 });
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Data aktivasi tidak valid." }, { status: body.status });
  const parsedBody = activationSchema.safeParse(body.value);
  if (!parsedBody.success) return NextResponse.json({ error: "Undangan tidak valid." }, { status: 400 });

  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: {
      id: parsedBody.data.invitationId,
      deletedAt: null,
      status: "DRAFT",
      OR: [{ resellerOrgId: null }, { resellerOrgId: reseller.organizationId }],
      organization: { type: "PERSONAL", status: "ACTIVE", customerOfResellers: { some: { resellerOrgId: reseller.organizationId, status: "ACTIVE" } } },
    },
    select: {
      id: true,
      organizationId: true,
      ownerId: true,
      resellerOrgId: true,
      templateVersionId: true,
      slug: true,
      status: true,
      draftData: true,
      templateVersion: { select: { id: true, version: true, manifest: true, templateId: true, template: { select: { slug: true, status: true, licenseType: true, priceIdr: true } } } },
      organization: { select: { memberships: { where: { role: "OWNER" }, select: { userId: true } } } },
    },
  });
  if (!invitation?.organization.memberships.some((membership) => membership.userId === invitation.ownerId)) {
    return NextResponse.json({ error: "Draft pelanggan tidak ditemukan atau tidak dapat diaktifkan oleh workspace ini." }, { status: 404 });
  }
  if (!isTemplateSelectable(invitation.templateVersion.template.status)) {
    return NextResponse.json({ error: "Template ini tidak lagi tersedia untuk aktivasi baru." }, { status: 409 });
  }

  const draft = parseInvitationDraft({ ...(invitation.draftData as object), id: invitation.id, slug: invitation.slug });
  if (!draft || draft.templateId !== invitation.templateVersion.template.slug) {
    return NextResponse.json({ error: "Data draft atau versi template tidak cocok. Minta pelanggan menyimpan ulang draft." }, { status: 400 });
  }
  const validation = validateInvitationDraft(draft);
  if (!validation.valid) return NextResponse.json({ error: validation.message ?? "Detail undangan belum lengkap." }, { status: 400 });
  await prisma.invitation.updateMany({
    where: {
      id: invitation.id,
      ownerId: invitation.ownerId,
      organizationId: invitation.organizationId,
      resellerOrgId: invitation.resellerOrgId,
      status: "DRAFT",
      deletedAt: null,
      formCompletedAt: null,
      organization: { status: "ACTIVE", customerOfResellers: { some: { resellerOrgId: reseller.organizationId, status: "ACTIVE" } } },
    },
    data: { formCompletedAt: new Date() },
  });
  const manifest = validateTemplateManifest(invitation.templateVersion.manifest);
  if (!manifest.success || manifest.data.slug !== invitation.templateVersion.template.slug || manifest.data.version !== invitation.templateVersion.version || !isEditorCompatibleTemplate(manifest.data)) {
    return NextResponse.json({ error: "Manifest template ini tidak valid untuk aktivasi reseller." }, { status: 409 });
  }
  const template = manifest.data;
  const creditSku = template.activationSku;
  const publishedAt = new Date();
  const hostingTermDays = await getHostingTermDays();
  const expiresAt = new Date(publishedAt.getTime() + hostingTermDays * 86_400_000);
  const snapshot = { ...draft, publishedAt: publishedAt.toISOString() };
  const title = invitationTitle(draft);
  const eventData = { title, startsAt: eventStartsAt(draft), venue: draft.venue, address: draft.address, mapsUrl: draft.mapsUrl || null };

  try {
    const result = await prisma.$transaction(async (tx) => {
      await lockResellerCreditBalance(tx, reseller.organizationId);
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "reseller_profiles" WHERE "organizationId" = ${reseller.organizationId}::uuid FOR UPDATE`;
      await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM "reseller_customers" WHERE "resellerOrgId" = ${reseller.organizationId}::uuid AND "customerOrgId" = ${invitation.organizationId}::uuid FOR UPDATE`;
      const currentReseller = await tx.resellerProfile.findFirst({
        where: { organizationId: reseller.organizationId, status: "APPROVED", organization: { status: "ACTIVE" } },
        select: { organizationId: true },
      });
      if (!currentReseller) throw new ActivationError("Akun reseller tidak lagi aktif.", 403);

      const currentInvitation = await tx.invitation.findFirst({
        where: {
          id: invitation.id,
          organizationId: invitation.organizationId,
          ownerId: invitation.ownerId,
          status: "DRAFT",
          deletedAt: null,
          OR: [{ resellerOrgId: null }, { resellerOrgId: reseller.organizationId }],
          organization: {
            customerOfResellers: { some: { resellerOrgId: reseller.organizationId, status: "ACTIVE" } },
            memberships: { some: { userId: invitation.ownerId, role: "OWNER" } },
          },
        },
        select: { id: true, resellerOrgId: true },
      });
      if (!currentInvitation) throw new ActivationError("Draft sudah berubah atau tidak lagi ditautkan ke reseller ini.", 409);

      const currentTemplateVersion = await tx.templateVersion.findFirst({
        where: { id: invitation.templateVersionId, templateId: invitation.templateVersion.templateId, template: { status: { in: ["PUBLISHED", "UPDATE_DRAFT", "UPDATE_IN_REVIEW"] } } },
        select: { id: true },
      });
      if (!currentTemplateVersion) throw new ActivationError("Template ini tidak lagi tersedia untuk aktivasi baru.", 409);

      const pendingOrder = await tx.order.findFirst({
        where: { invitationId: invitation.id, status: "PENDING", paymentSessions: { some: { status: { in: ["CREATED", "PENDING"] } } } },
        select: { id: true },
      });
      if (pendingOrder) throw new ActivationError("Pelanggan memiliki pembayaran template yang sedang diproses. Tunggu hasil pembayaran sebelum memakai kredit reseller.", 409);

      const claimed = await tx.invitation.updateMany({
        where: { id: invitation.id, status: "DRAFT", deletedAt: null, OR: [{ resellerOrgId: null }, { resellerOrgId: reseller.organizationId }] },
        data: {
          resellerOrgId: reseller.organizationId,
          status: "PUBLISHED",
          slug: draft.slug,
          title,
          startsAt: eventStartsAt(draft),
          templateVersionId: invitation.templateVersionId,
          publishedAt,
          expiresAt,
          publishedSnapshot: JSON.parse(JSON.stringify(snapshot)),
        },
      });
      if (claimed.count !== 1) throw new ActivationError("Draft sudah diaktifkan atau sedang diproses.", 409);

      const existingLicense = await tx.templateLicense.findUnique({
        where: { invitationId_templateVersionId: { invitationId: invitation.id, templateVersionId: invitation.templateVersionId } },
        select: { id: true },
      });
      let creditUsed = false;
      let orderId: string | undefined;
      if (!existingLicense && invitation.templateVersion.template.licenseType !== "FREE") {
        const creditState = await getResellerCreditState(tx, reseller.organizationId, creditSku);
        if (!creditState.isConsistent) throw new ActivationError("Catatan kredit reseller belum dapat direkonsiliasi. Hubungi admin sebelum aktivasi.", 409);
        if (creditState.totalBalance < 1) {
          throw new ActivationError(`Kredit ${creditSku === "BASIC_ACTIVATION" ? "Basic" : "Premium"} tidak cukup untuk aktivasi ini.`, 409);
        }
        const sourceTopUp = creditState.untrackedBalance > 0 ? null : creditState.lots.find((lot) => lot.unitsRemaining > 0);
        if (!sourceTopUp && creditState.untrackedBalance <= 0) {
          throw new ActivationError("Saldo kredit tidak dapat dipasangkan dengan pembelian top-up. Hubungi admin sebelum aktivasi.", 409);
        }

        const order = await tx.order.create({
          data: {
            organizationId: invitation.organizationId,
            buyerId: userId,
            invitationId: invitation.id,
            status: "PAID",
            currency: "IDR",
            totalAmount: 0,
            paidAt: publishedAt,
            idempotencyKey: randomUUID(),
            priceSnapshot: { flow: "RESELLER_CREDIT_ACTIVATION", resellerOrgId: reseller.organizationId, creditSku, templateSlug: template.slug, templateVersion: invitation.templateVersion.version },
            items: {
              create: [{
                itemType: "TEMPLATE_LICENSE",
                sku: `template:${template.slug}@${invitation.templateVersion.version}`,
                quantity: 1,
                unitPriceIdr: 0,
                totalPriceIdr: 0,
                templateId: invitation.templateVersion.templateId,
                templateVersionId: invitation.templateVersionId,
                entitlementSnapshot: { features: template.features, licenseType: invitation.templateVersion.template.licenseType, activationSku: creditSku, activationSource: "RESELLER_CREDIT" },
              }],
            },
          },
          include: { items: true },
        });
        const item = order.items[0];
        await tx.templateLicense.create({
          data: {
            organizationId: invitation.organizationId,
            invitationId: invitation.id,
            templateId: invitation.templateVersion.templateId,
            templateVersionId: invitation.templateVersionId,
            orderId: order.id,
            orderItemId: item.id,
            licenseSnapshot: JSON.parse(JSON.stringify(item.entitlementSnapshot)),
          },
        });
        await tx.creditLedger.create({
          data: {
            resellerOrgId: reseller.organizationId,
            orderId: order.id,
            sku: creditSku,
            type: "ACTIVATION",
            unitsDelta: -1,
            ...(sourceTopUp ? { sourceTopUpId: sourceTopUp.id } : {}),
            reference: `activation:${invitation.id}:${invitation.templateVersionId}`,
            metadata: { invitationId: invitation.id, customerOrgId: invitation.organizationId, ...(sourceTopUp ? {} : { creditOrigin: "UNTRACKED_ADJUSTMENT" }) },
          },
        });
        creditUsed = true;
        orderId = order.id;
      } else if (!existingLicense) {
        await tx.templateLicense.create({
          data: {
            organizationId: invitation.organizationId,
            invitationId: invitation.id,
            templateId: invitation.templateVersion.templateId,
            templateVersionId: invitation.templateVersionId,
            licenseSnapshot: { features: template.features, licenseType: "FREE", activationSource: "FREE_TEMPLATE" },
          },
        });
      }

      await tx.entitlement.create({ data: { organizationId: invitation.organizationId, invitationId: invitation.id, ...(orderId ? { orderId } : {}), featureKey: "hosting", value: { periodDays: hostingTermDays, source: "RESELLER_ACTIVATION" }, startsAt: publishedAt, expiresAt } });

      const latest = await tx.invitationVersion.aggregate({ where: { invitationId: invitation.id }, _max: { version: true } });
      await tx.invitationVersion.create({
        data: { invitationId: invitation.id, version: (latest._max.version ?? 0) + 1, type: "PUBLISHED", snapshot: JSON.parse(JSON.stringify(snapshot)), createdById: userId },
      });
      const updatedEvent = await tx.event.updateMany({ where: { invitationId: invitation.id }, data: eventData });
      if (updatedEvent.count === 0) await tx.event.create({ data: { invitationId: invitation.id, ...eventData } });
      await tx.auditLog.create({
        data: { organizationId: reseller.organizationId, actorId: userId, action: "reseller.invitation_activated", targetType: "Invitation", targetId: invitation.id, metadata: { customerOrgId: invitation.organizationId, creditSku, creditUsed, orderId: orderId ?? null } },
      });
      await tx.auditLog.create({
        data: { organizationId: invitation.organizationId, actorId: userId, action: "invitation.published_by_reseller", targetType: "Invitation", targetId: invitation.id, metadata: { resellerOrgId: reseller.organizationId, creditSku, creditUsed } },
      });
      return { slug: invitation.slug, creditSku, creditUsed };
    });
    return NextResponse.json({ published: true, ...result });
  } catch (error) {
    if (error instanceof ActivationError) return NextResponse.json({ error: error.message }, { status: error.status });
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Undangan ini sudah memiliki aktivasi kredit." }, { status: 409 });
    }
    throw error;
  }
}
