import { NextResponse } from "next/server";
import { z } from "zod";
import { createRawAccountToken, hashAccountToken } from "@/lib/account-tokens";
import { sendAccountActionEmail } from "@/lib/email";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest, getRequestAddress } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

const schema = z.object({ email: z.email().trim().toLowerCase().max(254) });
const genericResponse = { requested: true, message: "Jika email itu terdaftar, tautan pemulihan akan dikirim." };

export async function POST(request: Request) {
  const body = await readJsonBody(request, 8_000);
  if (!body.ok) return NextResponse.json({ error: "Email tidak valid." }, { status: body.status });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Masukkan alamat email yang valid." }, { status: 400 });
  const allowed = await Promise.all([
    allowRequest(`password-reset:ip:${getRequestAddress(request)}`, 5, 60 * 60),
    allowRequest(`password-reset:address:${parsed.data.email}`, 3, 60 * 60),
  ]);
  if (allowed.some((value) => !value)) return NextResponse.json({ error: "Terlalu banyak permintaan. Coba lagi nanti." }, { status: 429 });

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, name: true, email: true } });
  if (user?.email) {
    const token = createRawAccountToken();
    const tokenHash = hashAccountToken(token);
    await prisma.$transaction(async (tx) => {
      await tx.accountToken.deleteMany({ where: { userId: user.id, purpose: "PASSWORD_RESET" } });
      await tx.accountToken.create({ data: { userId: user.id, purpose: "PASSWORD_RESET", tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
    });
    try {
      await sendAccountActionEmail({ to: user.email, name: user.name, purpose: "PASSWORD_RESET", token });
    } catch {
      // Avoid exposing whether an account exists when the mail provider is unavailable.
    }
  }
  return NextResponse.json(genericResponse);
}
