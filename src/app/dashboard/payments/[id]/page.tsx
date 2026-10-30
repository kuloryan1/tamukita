import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { ManualPayment } from "@/components/manual-payment";
import { getManualOrderPayment } from "@/lib/manual-orders";
import { paymentOrderIdSchema } from "@/lib/payment-methods";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pembayaran QR · TamuKita" };

export default async function ManualPaymentPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const { id } = await params;
  if (!paymentOrderIdSchema.safeParse(id).success) notFound();
  const order = await getManualOrderPayment(id, session.user.id);
  if (!order) notFound();
  return <ManualPayment initial={order} />;
}
