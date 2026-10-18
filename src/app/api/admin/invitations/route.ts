import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { createRawAccountToken, hashAccountToken } from "@/lib/account-tokens";
import { sendAccountActionEmail } from "@/lib/email";
import { ensureTemplateVersion, eventStartsAt, invitationDraftSchema, invitationTitle } from "@/lib/invitation-server";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";
import { validateInvitationDraft } from "@/lib/validation";
import { isTemplateSelectable } from "@/lib/template-sdk";

export const runtime = "nodejs";

const managedInvitationSchema = z.object({
  customerName: z.string().trim().min(2).max(80),
  customerEmail: z.email().trim().toLowerCase().max(254),
  draft: invitationDraftSchema.omit({ id: true, updatedAt: true, publishedAt: true, isPublished: true, qaFixture: true }),
});

function workspaceSlug(name: string, id: string) {
  const base = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ruang-pribadi";
  return `${base}-${id.slice(0, 8)}`;
}

export async function POST(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const prisma = getPrismaClient();
  const admin = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  if (!await allowRequest(`admin:managed-invitation:${userId}`, 30, 60 * 60)) return NextResponse.json({ error: "Terlalu banyak draft yang dibuat. Coba lagi nanti." }, { status: 429 });
  const body = await readJsonBody(request, 24_000);
  if (!body.ok) return NextResponse.json({ error: "Informasi undangan terlalu besar atau tidak valid." }, { status: body.status });
  const parsed = managedInvitationSchema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Periksa email pelanggan dan detail undangan." }, { status: 400 });
  if (parsed.data.draft.galleryPhotos.length || parsed.data.draft.coverPhoto || parsed.data.draft.musicUrl) return NextResponse.json({ error: "Foto dan musik ditambahkan pelanggan setelah draft dibuat." }, { status: 400 });
  const validation = validateInvitationDraft({ ...parsed.data.draft, id: "preview", updatedAt: new Date().toISOString() });
  if (!validation.valid) return NextResponse.json({ error: validation.message ?? "Detail undangan belum lengkap." }, { status: 400 });

  const template = await ensureTemplateVersion(parsed.data.draft.templateId);
  if (!template) return NextResponse.json({ error: "Template tidak tersedia." }, { status: 400 });
  if (!isTemplateSelectable(template.template.status)) return NextResponse.json({ error: "Template ini tidak menerima undangan baru." }, { status: 409 });
  if (parsed.data.draft.templateVersion !== template.version.version) return NextResponse.json({ error: "Versi template sudah berubah. Muat ulang form dan coba lagi." }, { status: 409 });
  const id = randomUUID();
  const draft = { ...parsed.data.draft, id, updatedAt: new Date().toISOString() };
  const rawOnboardingToken = createRawAccountToken();
  const onboardingTokenHash = hashAccountToken(rawOnboardingToken);
  try {
    const created = await prisma.$transaction(async (tx) => {
      let customer = await tx.user.findUnique({
        where: { email: parsed.data.customerEmail },
        select: {
          id: true,
          name: true,
          email: true,
          memberships: { where: { role: "OWNER", organization: { type: "PERSONAL", status: "ACTIVE" } }, take: 1, select: { organizationId: true } },
        },
      });
      let customerCreated = false;
      let organizationId = customer?.memberships[0]?.organizationId;

      if (!customer) {
        const customerId = randomUUID();
        const organizationIdForNewCustomer = randomUUID();
        customer = await tx.user.create({
          data: { id: customerId, name: parsed.data.customerName, email: parsed.data.customerEmail, passwordHash: null },
          select: { id: true, name: true, email: true, memberships: { select: { organizationId: true } } },
        });
        await tx.organization.create({
          data: { id: organizationIdForNewCustomer, name: `Ruang ${parsed.data.customerName}`, slug: workspaceSlug(parsed.data.customerName, customerId), type: "PERSONAL" },
        });
        await tx.membership.create({ data: { organizationId: organizationIdForNewCustomer, userId: customer.id, role: "OWNER" } });
        await tx.accountToken.create({
          data: { userId: customer.id, purpose: "PASSWORD_RESET", tokenHash: onboardingTokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) },
        });
        await tx.auditLog.create({
          data: { organizationId: organizationIdForNewCustomer, actorId: userId, action: "admin.customer_created_for_managed_invitation", targetType: "User", targetId: customer.id },
        });
        organizationId = organizationIdForNewCustomer;
        customerCreated = true;
      }

      if (!organizationId) throw new Error("CUSTOMER_WORKSPACE_MISSING");
      const invitation = await tx.invitation.create({
        data: {
          id,
          organizationId,
          ownerId: customer.id,
          createdById: userId,
          templateVersionId: template.version.id,
          slug: draft.slug,
          title: invitationTitle(draft),
          draftData: JSON.parse(JSON.stringify(draft)),
          startsAt: eventStartsAt(draft),
          events: { create: [{ title: invitationTitle(draft), startsAt: eventStartsAt(draft), venue: draft.venue, address: draft.address, mapsUrl: draft.mapsUrl || null }] },
          versions: { create: [{ version: 1, type: "DRAFT", snapshot: JSON.parse(JSON.stringify(draft)), createdById: userId }] },
        },
        select: { id: true, slug: true, title: true },
      });
      await tx.auditLog.create({
        data: { organizationId, actorId: userId, action: "admin.invitation_created_for_customer", targetType: "Invitation", targetId: id, metadata: { templateSlug: template.template.slug, customerId: customer.id } },
      });
      const invitationNotificationQueued = !customerCreated && Boolean(customer.email);
      if (invitationNotificationQueued && customer.email) {
        await tx.notificationJob.create({
          data: {
            jobKey: `admin-managed-invitation:${invitation.id}:${customer.id}`,
            jobType: "ADMIN_MANAGED_INVITATION_EMAIL",
            payload: {
              to: customer.email,
              name: customer.name ?? "",
              invitationId: invitation.id,
              invitationTitle: invitation.title,
            },
          },
        });
      }
      return { invitation, customerCreated, invitationNotificationQueued };
    });
    let onboardingEmailSent = false;
    if (created.customerCreated) {
      try {
        onboardingEmailSent = await sendAccountActionEmail({ to: parsed.data.customerEmail, name: parsed.data.customerName, purpose: "PASSWORD_RESET", token: rawOnboardingToken });
      } catch {
        onboardingEmailSent = false;
      }
    }
    return NextResponse.json({
      created: true,
      invitation: created.invitation,
      customerCreated: created.customerCreated,
      onboardingEmailSent,
      invitationNotificationQueued: created.invitationNotificationQueued,
    }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "CUSTOMER_WORKSPACE_MISSING") {
      return NextResponse.json({ error: "Akun pelanggan tidak memiliki workspace pribadi yang aktif." }, { status: 409 });
    }
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      const targets = "meta" in error && typeof error.meta === "object" && error.meta !== null && "target" in error.meta ? error.meta.target : undefined;
      if (Array.isArray(targets) && targets.includes("slug")) return NextResponse.json({ error: "Tautan undangan ini sudah dipakai. Pilih slug lain." }, { status: 409 });
      return NextResponse.json({ error: "Akun pelanggan atau undangan baru saja berubah. Muat ulang halaman dan coba lagi." }, { status: 409 });
    }
    throw error;
  }
}
