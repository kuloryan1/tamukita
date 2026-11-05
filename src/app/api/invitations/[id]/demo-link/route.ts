import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { createInvitationDemoToken, invitationDemoLifetimeDays } from "@/lib/invitation-demo";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: "ID draft tidak valid." }, { status: 400 });

  const invitation = await getPrismaClient().invitation.findFirst({
    where: {
      id,
      ownerId: userId,
      deletedAt: null,
      status: "DRAFT",
      organization: {
        status: "ACTIVE",
        memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "EDITOR"] } } },
      },
    },
    select: { id: true, updatedAt: true },
  });
  if (!invitation) return NextResponse.json({ error: "Draft tidak ditemukan atau sudah diterbitkan." }, { status: 404 });

  const now = Date.now();
  const token = createInvitationDemoToken(invitation.id, invitation.updatedAt, now);
  const baseUrl = new URL(process.env.NEXT_PUBLIC_APP_URL || "https://tamukita.io");
  const demoUrl = new URL(`/demo/${token}`, baseUrl.origin).toString();
  const expiresAt = new Date(now + invitationDemoLifetimeDays * 24 * 60 * 60 * 1000).toISOString();
  return NextResponse.json({ demoUrl, expiresAt, lifetimeDays: invitationDemoLifetimeDays }, { headers: { "Cache-Control": "no-store" } });
}
