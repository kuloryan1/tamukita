import { NextResponse } from "next/server";
import { z } from "zod";
import { auth } from "@/auth";
import { getAdminPlanDirectory, mapAdminPlan } from "@/lib/admin-plans";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";
import { readJsonBody } from "@/lib/request-json";
import { Prisma } from "@/generated/prisma/client";

export const runtime = "nodejs";

const entitlementSchema = z.object({
  featureKey: z.string().trim().regex(/^[a-z][a-z0-9_.-]{0,63}$/),
  value: z.unknown(),
}).strict();

const planSchema = z.object({
  key: z.string().trim().toLowerCase().regex(/^[a-z0-9][a-z0-9_-]{1,47}$/),
  name: z.string().trim().min(2).max(80),
  description: z.string().trim().max(500).nullable(),
  priceIdr: z.number().int().min(0).max(2_147_483_647),
  durationDays: z.number().int().min(1).max(3_650),
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

async function requireSuperAdmin() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return { error: NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 }) };
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (user?.platformRole !== "SUPER_ADMIN") return { error: NextResponse.json({ error: "Akses ditolak." }, { status: 403 }) };
  return { userId, prisma };
}

export async function GET(request: Request) {
  const admin = await requireSuperAdmin();
  if ("error" in admin) return admin.error;
  if (!await allowRequest(`admin:plans:read:${admin.userId}`, 120, 60 * 60)) return NextResponse.json({ error: "Batas permintaan katalog paket tercapai. Coba lagi nanti." }, { status: 429 });

  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const requestedPage = Number(params.get("page") ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100_000) : 1;
  return NextResponse.json(await getAdminPlanDirectory(query, page), { headers: { "Cache-Control": "private, no-store" } });
}

export async function POST(request: Request) {
  const admin = await requireSuperAdmin();
  if ("error" in admin) return admin.error;
  if (!await allowRequest(`admin:plans:write:${admin.userId}`, 40, 60 * 60)) return NextResponse.json({ error: "Batas perubahan paket tercapai. Coba lagi nanti." }, { status: 429 });

  const body = await readJsonBody(request, 16_000);
  if (!body.ok) return NextResponse.json({ error: "Data paket tidak valid." }, { status: body.status });
  const parsed = planSchema.safeParse(body.value);
  if (!parsed.success || !validEntitlements(parsed.data?.entitlements ?? [])) return NextResponse.json({ error: "Isi paket dan entitlement harus valid, unik, serta berukuran wajar." }, { status: 400 });

  try {
    const plan = await admin.prisma.$transaction(async (tx) => {
      const created = await tx.plan.create({
        data: {
          key: parsed.data.key,
          name: parsed.data.name,
          description: parsed.data.description || null,
          priceIdr: parsed.data.priceIdr,
          durationDays: parsed.data.durationDays,
          isActive: false,
          entitlements: {
            create: parsed.data.entitlements.map(({ featureKey, value }) => ({ featureKey, value: value === null ? Prisma.JsonNull : value as Prisma.InputJsonValue })),
          },
        },
        include: { entitlements: { orderBy: { featureKey: "asc" } }, _count: { select: { grants: true } } },
      });
      await tx.auditLog.create({
        data: {
          actorId: admin.userId,
          action: "admin.plan_created",
          targetType: "Plan",
          targetId: created.id,
          metadata: { key: created.key, isActive: false, priceIdr: created.priceIdr, entitlementKeys: parsed.data.entitlements.map(({ featureKey }) => featureKey) },
        },
      });
      return created;
    });
    return NextResponse.json({ plan: mapAdminPlan(plan) }, { status: 201 });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2002") return NextResponse.json({ error: "Kode paket sudah digunakan." }, { status: 409 });
    throw error;
  }
}
