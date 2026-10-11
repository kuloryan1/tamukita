import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getAdminUserDirectory } from "@/lib/admin-users";
import { getPrismaClient } from "@/lib/prisma";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

  const admin = await getPrismaClient().user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (admin?.platformRole !== "SUPER_ADMIN") return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });
  if (!await allowRequest(`admin:users:search:${userId}`, 120, 60 * 60)) return NextResponse.json({ error: "Batas pencarian tercapai. Coba lagi nanti." }, { status: 429 });

  const params = new URL(request.url).searchParams;
  const query = (params.get("q") ?? "").trim().slice(0, 100);
  const requestedPage = Number(params.get("page") ?? "1");
  const page = Number.isSafeInteger(requestedPage) && requestedPage > 0 ? Math.min(requestedPage, 100_000) : 1;
  return NextResponse.json(await getAdminUserDirectory(query, page), { headers: { "Cache-Control": "private, no-store" } });
}
