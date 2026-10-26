import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createRawAccountToken, hashAccountToken } from "@/lib/account-tokens";
import { sendAccountActionEmail } from "@/lib/email";
import { hashPassword } from "@/lib/password";
import { getPrismaClient } from "@/lib/prisma";
import { ADULT_ATTESTATION_VERSION } from "@/lib/consent-versions";
import { allowRequest, getRequestAddress } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

const registrationSchema = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase().max(254),
  password: z.string().min(12).max(128),
  adultAttested: z.literal(true),
});

function workspaceSlug(name: string, id: string) {
  const base = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40) || "ruang-pribadi";
  return `${base}-${id.slice(0, 8)}`;
}

export async function POST(request: Request) {
  const body = await readJsonBody(request, 16_000);
  if (!body.ok) return NextResponse.json({ error: "Isi formulir pendaftaran tidak valid." }, { status: body.status });

  const parsed = registrationSchema.safeParse(body.value);
  if (!parsed.success) {
    return NextResponse.json({ error: "Periksa nama, email, kata sandi (minimal 12 karakter), dan konfirmasi usia 18 tahun ke atas." }, { status: 400 });
  }

  const address = getRequestAddress(request);
  const [ipAllowed, emailAllowed] = await Promise.all([
    allowRequest(`register:ip:${address}`, 5, 60 * 60),
    allowRequest(`register:email:${parsed.data.email}`, 5, 60 * 60),
  ]);
  if (!ipAllowed || !emailAllowed) return NextResponse.json({ error: "Terlalu banyak percobaan pendaftaran. Coba lagi nanti." }, { status: 429 });

  const prisma = getPrismaClient();
  const id = randomUUID();
  const passwordHash = await hashPassword(parsed.data.password);
  const adultAttestedAt = new Date();
  const verificationToken = createRawAccountToken();
  const verificationTokenHash = hashAccountToken(verificationToken);
  try {
    await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          id,
          name: parsed.data.name,
          email: parsed.data.email,
          passwordHash,
          adultAttestedAt,
          adultAttestationVersion: ADULT_ATTESTATION_VERSION,
        },
      });
      await tx.accountToken.create({ data: { userId: user.id, purpose: "VERIFY_EMAIL", tokenHash: verificationTokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } });
      const organization = await tx.organization.create({
        data: { name: `Ruang ${parsed.data.name}`, slug: workspaceSlug(parsed.data.name, id), type: "PERSONAL" },
      });
      await tx.membership.create({
        data: { organizationId: organization.id, userId: user.id, role: "OWNER" },
      });
      await tx.auditLog.create({
        data: {
          organizationId: organization.id,
          actorId: user.id,
          action: "account.registered",
          targetType: "User",
          targetId: user.id,
        },
      });
    });
    let emailSent = false;
    try {
      emailSent = await sendAccountActionEmail({ to: parsed.data.email, name: parsed.data.name, purpose: "VERIFY_EMAIL", token: verificationToken });
    } catch {
      emailSent = false;
    }
    return NextResponse.json({ created: true, emailSent }, { status: 201 });
  } catch (error) {
    if (typeof error === "object" && error !== null && "code" in error && error.code === "P2002") {
      return NextResponse.json({ error: "Pendaftaran tidak dapat diproses. Jika sudah punya akun, coba masuk." }, { status: 409 });
    }
    throw error;
  }
}
