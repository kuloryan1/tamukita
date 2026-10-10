import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canReviewContentReports, getAdminContentReports } from "@/lib/admin-content-reports";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

  const user = await getPrismaClient().user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (!canReviewContentReports(user?.platformRole)) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const view = new URL(request.url).searchParams.get("view") ?? "pending";
  if (view !== "pending" && view !== "history") return NextResponse.json({ error: "Filter antrean tidak valid." }, { status: 400 });

  const reports = await getAdminContentReports(view);
  return NextResponse.json({ reports });
}
