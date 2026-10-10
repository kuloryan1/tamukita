import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Sesi akun berakhir." }, { status: 401 });
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID undangan tidak valid." }, { status: 400 });
  const prisma = getPrismaClient();
  const invitation = await prisma.invitation.findFirst({
    where: { id, ownerId: userId, deletedAt: null, organization: { status: "ACTIVE", memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } },
    select: {
      status: true,
      slug: true,
      expiresAt: true,
      orders: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, paymentSessions: { orderBy: { createdAt: "desc" }, take: 1, select: { status: true, expiresAt: true } } } },
    },
  });
  if (!invitation) return NextResponse.json({ error: "Undangan tidak ditemukan." }, { status: 404 });
  const latestOrder = invitation.orders[0];
  const latestPayment = latestOrder?.paymentSessions[0];
  const paymentInProgress = latestOrder?.status === "PENDING" && latestPayment?.status === "PENDING" && Boolean(latestPayment.expiresAt && latestPayment.expiresAt > new Date());
  const published = invitation.status === "PUBLISHED" && !paymentInProgress;
  return NextResponse.json({
    published,
    slug: published ? invitation.slug : null,
    orderStatus: invitation.orders[0]?.status ?? "NONE",
    paymentStatus: invitation.orders[0]?.paymentSessions[0]?.status ?? "NONE",
    expiresAt: invitation.orders[0]?.paymentSessions[0]?.expiresAt?.toISOString() ?? null,
    hostingExpiresAt: invitation.expiresAt?.toISOString() ?? null,
  });
}
