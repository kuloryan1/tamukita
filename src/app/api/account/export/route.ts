import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const privateHeaders = {
  "Cache-Control": "private, no-store, no-cache, max-age=0, must-revalidate",
  Pragma: "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401, headers: privateHeaders });
  if (!await allowRequest(`account:export:${userId}`, 10, 60 * 60)) {
    return NextResponse.json({ error: "Batas unduhan data tercapai. Coba lagi nanti." }, { status: 429, headers: privateHeaders });
  }

  const prisma = getPrismaClient();
  const account = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      name: true,
      email: true,
      emailVerified: true,
      image: true,
      adultAttestedAt: true,
      adultAttestationVersion: true,
      createdAt: true,
      updatedAt: true,
      accounts: { select: { type: true, provider: true, providerAccountId: true } },
    },
  });
  if (!account) return NextResponse.json({ error: "Akun tidak ditemukan." }, { status: 404, headers: privateHeaders });

  const [memberships, invitations, orders, refunds, feedback] = await Promise.all([
    prisma.membership.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: {
        role: true,
        createdAt: true,
        organization: { select: { name: true, slug: true, type: true, status: true } },
      },
    }),
    prisma.invitation.findMany({
      where: { OR: [{ ownerId: userId }, { createdById: userId }] },
      orderBy: { createdAt: "asc" },
      select: {
        title: true,
        slug: true,
        status: true,
        draftData: true,
        publishedSnapshot: true,
        publishedAt: true,
        startsAt: true,
        expiresAt: true,
        deletedAt: true,
        createdAt: true,
        updatedAt: true,
        organization: { select: { name: true, slug: true, type: true } },
        templateVersion: { select: { version: true, template: { select: { name: true, slug: true } } } },
        events: {
          orderBy: { startsAt: "asc" },
          select: { title: true, startsAt: true, endsAt: true, venue: true, address: true, mapsUrl: true },
        },
        versions: {
          orderBy: { createdAt: "asc" },
          select: { version: true, type: true, snapshot: true, createdAt: true },
        },
      },
    }),
    prisma.order.findMany({
      where: { buyerId: userId },
      orderBy: { createdAt: "asc" },
      select: {
        status: true,
        currency: true,
        totalAmount: true,
        paidAt: true,
        canceledAt: true,
        createdAt: true,
        updatedAt: true,
        items: { select: { itemType: true, sku: true, quantity: true, unitPriceIdr: true, totalPriceIdr: true, createdAt: true } },
      },
    }),
    prisma.refund.findMany({
      where: { requestedById: userId },
      orderBy: { createdAt: "asc" },
      select: { orderId: true, amount: true, currency: true, reason: true, status: true, createdAt: true, updatedAt: true },
    }),
    prisma.editorFeedback.findMany({
      where: { userId },
      orderBy: { createdAt: "asc" },
      select: { category: true, message: true, status: true, createdAt: true, updatedAt: true },
    }),
  ]);

  const generatedAt = new Date();
  const exportedAccount = {
    name: account.name,
    email: account.email,
    emailVerified: account.emailVerified,
    image: account.image,
    adultAttestedAt: account.adultAttestedAt,
    adultAttestationVersion: account.adultAttestationVersion,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
    accounts: account.accounts.map(({ type, provider, providerAccountId }) => ({ type, provider, providerAccountId })),
  };
  const payload = {
    schemaVersion: "1",
    generatedAt: generatedAt.toISOString(),
    scope: "Data akun, workspace, undangan yang dimiliki atau dibuat, pesanan, permintaan refund, dan laporan bantuan.",
    exclusions: [
      "Kata sandi, token autentikasi, sesi, dan token provider tidak disertakan.",
      "Respons RSVP, buku tamu, dan data tamu orang lain tidak disertakan.",
      "Payload pembayaran dan catatan internal admin tidak disertakan.",
    ],
    data: { account: exportedAccount, memberships, invitations, orders, refunds, feedback },
  };
  const date = generatedAt.toISOString().slice(0, 10);

  return new NextResponse(JSON.stringify(payload, null, 2), {
    status: 200,
    headers: {
      ...privateHeaders,
      "Content-Type": "application/json; charset=utf-8",
      "Content-Disposition": `attachment; filename="tamukita-account-data-${date}.json"`,
    },
  });
}
