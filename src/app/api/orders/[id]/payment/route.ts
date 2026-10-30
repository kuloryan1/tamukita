import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getManualOrderPayment } from "@/lib/manual-orders";
import { paymentOrderIdSchema } from "@/lib/payment-methods";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  const { id } = await params;
  if (!paymentOrderIdSchema.safeParse(id).success) return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  const order = await getManualOrderPayment(id, session.user.id);
  if (!order) return NextResponse.json({ error: "Order tidak ditemukan." }, { status: 404 });
  return NextResponse.json(order, { headers: { "Cache-Control": "private, no-store" } });
}
