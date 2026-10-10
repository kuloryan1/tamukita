import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { canReviewEditorFeedback, getAdminEditorFeedback } from "@/lib/editor-feedback";
import { getPrismaClient } from "@/lib/prisma";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });

  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { platformRole: true } });
  if (!canReviewEditorFeedback(user?.platformRole)) return NextResponse.json({ error: "Akses ditolak." }, { status: 403 });

  const view = new URL(request.url).searchParams.get("view") ?? "active";
  if (view !== "active" && view !== "resolved") return NextResponse.json({ error: "Filter laporan tidak valid." }, { status: 400 });

  const feedback = await getAdminEditorFeedback(view);
  return NextResponse.json({ feedback });
}
