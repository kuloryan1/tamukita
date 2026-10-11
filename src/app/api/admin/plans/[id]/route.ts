import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { Prisma } from "@/generated/prisma/client";
import { mapAdminPlan } from "@/lib/admin-plans";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";

export const runtime = "nodejs";

const entitlementSchema = z.object({ featureKey: z.string().trim().regex(/^[a-z][a-z0-9_.-]{0,63}$/), value: z.unknown() }).strict();
const patchSchema = z.object({
  expectedUpdatedAt: z.string().datetime(),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).nullable(),
  priceIdr: z.number().int().min(0).max(2_147_483_647),
  durationDays: z.number().int().min(1).max(3_650),
  isActive: z.boolean(),
  entitlements: z.array(entitlementSchema).max(32),
}).strict();

function isBoundedJson(value: unknown, depth = 0): boolean {
  if (depth > 5) return false;
  if (value === null || typeof value === "boolean") return true;
  if (typeof value === "string") return value.length <= 500;
  if (typeof value === "number") return Number.isFinite(value);
  if (Array.isArray(value)) return value.length <= 50 && value.every((item) => isBoundedJson(item, depth + 1));
  if (typeof value !== "object") return false;
  const entries = Object.entries(value);
  return entries.length <= 50 && entries.every(([key, item]) => key.length <= 64 && isBoundedJson(item, depth + 1));
}

function validEntitlements(entitlements: Array<{ featureKey: string; value: unknown }>) {
  const keys = new Set<string>();
  for (const entitlement of entitlements) {
    if (entitlement.featureKey === "hosting" || keys.has(entitlement.featureKey) || !isBoundedJson(entitlement.value)) return false;
    keys.add(entitlement.featureKey);
  }
  return new TextEncoder().encode(JSON.stringify(entitlements)).byteLength <= 10_000;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  const actorId = session?.user?.id;
  if (!actorId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const prisma = getPrismaClient();
  const actor = await prisma.user.findUnique({ where: { id: actorId }, select: { platformRole: true } });
  if (actor?.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  const { id } = await params;
  if (!z.string().uuid().safeParse(id).success) return NextResponse.json({ error: "Paket tidak valid." }, { status: 400 });
  if (!await allowRequest(`admin:plans:write:${actorId}`, 40, 60 * 60)) return NextResponse.json({ error: "Batas perubahan paket tercapai. Coba lagi nanti." }, { status: 429 });

  const body = await readJsonBody(request, 16_000);
  if (!body.ok) return NextResponse.json({ error: "Perubahan paket tidak valid." }, { status: body.status });
  const parsed = patchSchema.safeParse(body.value);
  if (!parsed.success || !validEntitlements(parsed.data?.entitlements ?? [])) return NextResponse.json({ error: "Isi paket dan entitlement harus valid, unik, serta berukuran wajar." }, { status: 400 });

  const outcome = await prisma.$transaction(async (tx) => {
    const current = await tx.plan.findUnique({ where: { id }, include: { entitlements: { orderBy: { featureKey: "asc" } } } });
    if (!current) return { kind: "not-found" as const };
    const updated = await tx.plan.updateMany({
      where: { id, updatedAt: new Date(parsed.data.expectedUpdatedAt) },
      data: {
        name: parsed.data.name,
        description: parsed.data.description || null,
        priceIdr: parsed.data.priceIdr,
        durationDays: parsed.data.durationDays,
        isActive: parsed.data.isActive,
      },
    });
    if (updated.count !== 1) return { kind: "conflict" as const };

    await tx.planEntitlement.deleteMany({ where: { planId: id } });
    if (parsed.data.entitlements.length) {
      await tx.planEntitlement.createMany({
        data: parsed.data.entitlements.map(({ featureKey, value }) => ({ planId: id, featureKey, value: value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue })),
      });
    }
    const plan = await tx.plan.findUniqueOrThrow({ where: { id }, include: { entitlements: { orderBy: { featureKey: "asc" } }, _count: { select: { grants: true } } } });
    await tx.auditLog.create({
      data: {
        actorId,
        action: "admin.plan_updated",
        targetType: "Plan",
        targetId: id,
        metadata: {
          key: plan.key,
          previousPriceIdr: current.priceIdr,
          nextPriceIdr: plan.priceIdr,
          previousDurationDays: current.durationDays,
          nextDurationDays: plan.durationDays,
          previousIsActive: current.isActive,
          nextIsActive: plan.isActive,
          previousEntitlementKeys: current.entitlements.map(({ featureKey }) => featureKey),
          nextEntitlementKeys: plan.entitlements.map(({ featureKey }) => featureKey),
        },
      },
    });
    return { kind: "updated" as const, plan };
  });

  if (outcome.kind === "not-found") return NextResponse.json({ error: "Paket tidak ditemukan." }, { status: 404 });
  if (outcome.kind === "conflict") return NextResponse.json({ error: "Paket berubah di sesi lain. Muat ulang lalu coba lagi." }, { status: 409 });
  return NextResponse.json({ plan: mapAdminPlan(outcome.plan) });
}
