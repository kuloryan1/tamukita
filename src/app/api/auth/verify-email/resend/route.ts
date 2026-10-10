import { NextResponse } from "next/server";
import { z } from "zod";
import { createRawAccountToken, hashAccountToken } from "@/lib/account-tokens";
import { sendAccountActionEmail } from "@/lib/email";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest, getRequestAddress } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

const schema = z.object({ email: z.email().trim().toLowerCase().max(254) });

export async function POST(request: Request) {
  const body = await readJsonBody(request, 8_000);
  if (!body.ok) return NextResponse.json({ error: "Email tidak valid." }, { status: body.status });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Masukkan alamat email yang valid." }, { status: 400 });
  const allowed = await Promise.all([
    allowRequest(`verify-email:ip:${getRequestAddress(request)}`, 5, 60 * 60),
    allowRequest(`verify-email:address:${parsed.data.email}`, 3, 60 * 60),
  ]);
  if (allowed.some((value) => !value)) return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi nanti." }, { status: 429 });

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, name: true, email: true, emailVerified: true } });
  if (user?.email && !user.emailVerified) {
    const token = createRawAccountToken();
    const tokenHash = hashAccountToken(token);
    await prisma.$transaction(async (tx) => {
      await tx.accountToken.deleteMany({ where: { userId: user.id, purpose: "VERIFY_EMAIL" } });
      await tx.accountToken.create({ data: { userId: user.id, purpose: "VERIFY_EMAIL", tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
    });
    try {
      await sendAccountActionEmail({ to: user.email, name: user.name, purpose: "VERIFY_EMAIL", token });
    } catch {
      // Keep the response identical whether the address exists or the mail provider is unavailable.
    }
  }
  return NextResponse.json({ requested: true });
}
