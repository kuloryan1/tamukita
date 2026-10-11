import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getCustomerActivationPrice, getHostingTermDays } from "@/lib/platform-settings";
import { getCustomerPlanCatalog } from "@/lib/customer-plans";
import { allowRequest } from "@/lib/rate-limit";

export const runtime = "nodejs";

export async function GET() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return NextResponse.json({ error: "Silakan masuk terlebih dahulu." }, { status: 401 });
  if (!await allowRequest(`customer:plans:${userId}`, 120, 60 * 60)) return NextResponse.json({ error: "Batas permintaan paket tercapai. Coba lagi nanti." }, { status: 429 });

  const [plans, activationPriceIdr, hostingTermDays] = await Promise.all([
    getCustomerPlanCatalog(),
    getCustomerActivationPrice(),
    getHostingTermDays(),
  ]);
  return NextResponse.json({ plans, fallback: { activationPriceIdr, hostingTermDays } }, { headers: { "Cache-Control": "private, no-store" } });
}
