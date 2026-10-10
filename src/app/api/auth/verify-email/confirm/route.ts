import { NextResponse } from "next/server";
import { z } from "zod";
import { hashAccountToken, isAccountTokenFormatValid } from "@/lib/account-tokens";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest, getRequestAddress } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

const schema = z.object({ token: z.string().min(43).max(128).refine(isAccountTokenFormatValid) });

export async function POST(request: Request) {
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Tautan verifikasi tidak valid atau sudah kedaluwarsa." }, { status: body.status });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Tautan verifikasi tidak valid atau sudah kedaluwarsa." }, { status: 400 });
  if (!await allowRequest(`verify-email:confirm:${getRequestAddress(request)}`, 30, 60 * 60)) return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, { status: 429 });

  const prisma = getPrismaClient();
  const now = new Date();
  const token = await prisma.accountToken.findFirst({ where: { tokenHash: hashAccountToken(parsed.data.token), purpose: "VERIFY_EMAIL", consumedAt: null, expiresAt: { gt: now } }, select: { id: true, userId: true, user: { select: { email: true, emailVerified: true } } } });
  if (!token || token.user.emailVerified || !token.user.email) return NextResponse.json({ error: "Tautan verifikasi tidak valid atau sudah kedaluwarsa." }, { status: 400 });

  const verified = await prisma.$transaction(async (tx) => {
    const claimed = await tx.accountToken.updateMany({ where: { id: token.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
    if (claimed.count !== 1) return false;
    const updated = await tx.user.updateMany({ where: { id: token.userId, email: token.user.email, emailVerified: null }, data: { emailVerified: now } });
    if (updated.count !== 1) return false;
    await tx.accountToken.updateMany({ where: { userId: token.userId, purpose: "VERIFY_EMAIL", consumedAt: null }, data: { consumedAt: now } });
    return true;
  });
  if (!verified) return NextResponse.json({ error: "Tautan verifikasi tidak valid atau sudah kedaluwarsa." }, { status: 400 });
  return NextResponse.json({ verified: true });
}
