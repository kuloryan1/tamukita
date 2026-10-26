import { NextResponse } from "next/server";
import { z } from "zod";
import { hashAccountToken, isAccountTokenFormatValid } from "@/lib/account-tokens";
import { hashPassword } from "@/lib/password";
import { getPrismaClient } from "@/lib/prisma";
import { ADULT_ATTESTATION_VERSION } from "@/lib/consent-versions";
import { allowRequest, getRequestAddress } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

const schema = z.object({
  token: z.string().min(43).max(128).refine(isAccountTokenFormatValid),
  password: z.string().min(12).max(128),
  adultAttested: z.literal(true),
});

export async function POST(request: Request) {
  const body = await readJsonBody(request, 8_000);
  if (!body.ok) return NextResponse.json({ error: "Tautan tidak valid atau sudah kedaluwarsa." }, { status: body.status });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Gunakan tautan yang valid, kata sandi minimal 12 karakter, dan konfirmasikan usia 18 tahun ke atas." }, { status: 400 });
  if (!await allowRequest(`password-reset:complete:${getRequestAddress(request)}`, 10, 60 * 60)) return NextResponse.json({ error: "Terlalu banyak percobaan. Coba lagi nanti." }, { status: 429 });

  const prisma = getPrismaClient();
  const now = new Date();
  const tokenHash = hashAccountToken(parsed.data.token);
  const token = await prisma.accountToken.findFirst({ where: { tokenHash, purpose: "PASSWORD_RESET", consumedAt: null, expiresAt: { gt: now } }, select: { id: true, userId: true, user: { select: { emailVerified: true } } } });
  if (!token) return NextResponse.json({ error: "Tautan tidak valid atau sudah kedaluwarsa." }, { status: 400 });
  const passwordHash = await hashPassword(parsed.data.password);
  const reset = await prisma.$transaction(async (tx) => {
    const claimed = await tx.accountToken.updateMany({ where: { id: token.id, consumedAt: null, expiresAt: { gt: now } }, data: { consumedAt: now } });
    if (claimed.count !== 1) return false;
    await tx.user.update({
      where: { id: token.userId },
      data: {
        passwordHash,
        authVersion: { increment: 1 },
        emailVerified: token.user.emailVerified ?? now,
        adultAttestedAt: now,
        adultAttestationVersion: ADULT_ATTESTATION_VERSION,
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });
    await tx.accountToken.updateMany({ where: { userId: token.userId, purpose: "PASSWORD_RESET", consumedAt: null }, data: { consumedAt: now } });
    return true;
  });
  if (!reset) return NextResponse.json({ error: "Tautan tidak valid atau sudah kedaluwarsa." }, { status: 400 });
  return NextResponse.json({ reset: true });
}
