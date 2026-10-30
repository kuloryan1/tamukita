import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";
import { getPlatformSettingsOverview, platformCustomerActivationKey, platformHostingKeys, platformPriceKeys } from "@/lib/platform-settings";
import { isPaymentQrUrl, paymentSettingKeys } from "@/lib/payment-settings";
import { normalizePaymentWhatsapp } from "@/lib/payment-methods";

export const runtime = "nodejs";

const schema = z.object({
  basicActivationIdr: z.number().int().min(1_000).max(2_147_483_647).optional(),
  premiumActivationIdr: z.number().int().min(1_000).max(2_147_483_647).optional(),
  customerActivationIdr: z.number().int().min(0).max(2_147_483_647).optional(),
  hostingRenewalIdr: z.number().int().min(0).max(2_147_483_647).optional(),
  hostingTermDays: z.number().int().min(30).max(3_650).optional(),
  paymentMode: z.enum(["manual", "xendit"]).optional(),
  manualQrImageUrl: z.string().max(1_000).refine(value => value === "" || isPaymentQrUrl(value)).optional(),
  manualWhatsapp: z.string().trim().max(30).refine(value => value === "" || normalizePaymentWhatsapp(value) !== null).optional(),
}).strict().refine(value => Object.values(value).some(entry => entry !== undefined));

async function getSuperAdmin() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }) };
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (user?.platformRole !== "SUPER_ADMIN") return { error: NextResponse.json({ error: "Akses ditolak." }, { status: 403 }) };
  return { userId, prisma };
}

export async function GET() {
  const admin = await getSuperAdmin();
  if ("error" in admin) return admin.error;
  const settings = await getPlatformSettingsOverview();
  return NextResponse.json(settings, { headers: { "Cache-Control": "private, no-store" } });
}

export async function PATCH(request: Request) {
  const admin = await getSuperAdmin();
  if ("error" in admin) return admin.error;
  if (!await allowRequest(`admin:settings:${admin.userId}`, 30, 60 * 60)) return NextResponse.json({ error: "Batas perubahan pengaturan tercapai. Coba lagi nanti." }, { status: 429 });
  const body = await readJsonBody(request, 4_000);
  if (!body.ok) return NextResponse.json({ error: "Pengaturan harga tidak valid." }, { status: body.status });
  const parsed = schema.safeParse(body.value);
  if (!parsed.success) return NextResponse.json({ error: "Periksa nominal, QR yang diunggah, dan nomor WhatsApp pada pengaturan." }, { status: 400 });

  const entries = [
    ...(parsed.data.basicActivationIdr === undefined ? [] : [{ key: platformPriceKeys.BASIC_ACTIVATION.key, value: parsed.data.basicActivationIdr }]),
    ...(parsed.data.premiumActivationIdr === undefined ? [] : [{ key: platformPriceKeys.PREMIUM_ACTIVATION.key, value: parsed.data.premiumActivationIdr }]),
    ...(parsed.data.customerActivationIdr === undefined ? [] : [{ key: platformCustomerActivationKey.key, value: parsed.data.customerActivationIdr }]),
    ...(parsed.data.hostingRenewalIdr === undefined ? [] : [{ key: platformHostingKeys.renewalPrice.key, value: parsed.data.hostingRenewalIdr }]),
    ...(parsed.data.hostingTermDays === undefined ? [] : [{ key: platformHostingKeys.termDays.key, value: parsed.data.hostingTermDays }]),
    ...(parsed.data.paymentMode === undefined ? [] : [{ key: paymentSettingKeys.mode, value: parsed.data.paymentMode }]),
    ...(parsed.data.manualQrImageUrl === undefined ? [] : [{ key: paymentSettingKeys.qrImageUrl, value: parsed.data.manualQrImageUrl }]),
    ...(parsed.data.manualWhatsapp === undefined ? [] : [{ key: paymentSettingKeys.whatsapp, value: normalizePaymentWhatsapp(parsed.data.manualWhatsapp) ?? "" }]),
  ];
  await admin.prisma.$transaction(async (tx) => {
    for (const entry of entries) {
      const previous = await tx.platformSetting.findUnique({ where: { key: entry.key }, select: { value: true } });
      await tx.platformSetting.upsert({
        where: { key: entry.key },
        create: { key: entry.key, value: entry.value, updatedById: admin.userId },
        update: { value: entry.value, updatedById: admin.userId },
      });
      await tx.auditLog.create({
        data: { actorId: admin.userId, action: "admin.platform_setting_changed", targetType: "PlatformSetting", targetId: entry.key, metadata: entry.key.startsWith("payment.") ? { changed: true } : { previousValue: typeof previous?.value === "number" ? previous.value : null, nextValue: entry.value } },
      });
    }
  });
  return NextResponse.json(await getPlatformSettingsOverview());
}
