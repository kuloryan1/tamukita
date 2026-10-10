import { notFound } from "next/navigation";
import { CheckoutReturn } from "@/components/checkout-return";

export default async function CheckoutReturnPage({ searchParams }: { searchParams: Promise<{ invitationId?: string; payment?: string; renewal?: string }> }) {
  const params = await searchParams;
  if (!params.invitationId || !/^[0-9a-f-]{36}$/i.test(params.invitationId)) notFound();
  return <CheckoutReturn invitationId={params.invitationId} wasCancelled={params.payment === "cancelled"} isRenewal={params.renewal === "1"} />;
}
