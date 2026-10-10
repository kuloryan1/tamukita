import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { ResellerApplicationForm, ResellerDashboard } from "@/components/reseller-portal";
import { getPrismaClient } from "@/lib/prisma";

export const metadata: Metadata = { title: "Portal reseller" };

function configuredPrice(value: string | undefined) {
  const price = Number(value);
  return Number.isSafeInteger(price) && price > 0 ? price : null;
}

export default async function ResellerPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect("/login");
  const prisma = getPrismaClient();
  const profile = await prisma.resellerProfile.findFirst({
    where: { organization: { memberships: { some: { userId, role: { in: ["OWNER", "ADMIN", "RESELLER_STAFF"] } } } } },
    select: { organizationId: true, businessName: true, status: true, organization: { select: { memberships: { where: { userId }, select: { role: true } } } } },
  });
  if (!profile) return <ResellerApplicationForm />;
  if (profile.status !== "APPROVED") {
    return <section className="reseller-application-card"><span className="status-pill status-pill--draft"><i />{profile.status === "PENDING" ? "Menunggu pemeriksaan" : profile.status === "REJECTED" ? "Pengajuan belum disetujui" : "Akun reseller dinonaktifkan"}</span><h1>{profile.businessName}</h1><p>{profile.status === "PENDING" ? "Pengajuanmu sudah tercatat. Portal kredit akan terbuka setelah tim TamuKita menyetujui akun ini." : profile.status === "REJECTED" ? "Hubungi dukungan TamuKita jika ingin meminta pemeriksaan ulang." : "Akses portal reseller sedang ditangguhkan."}</p></section>;
  }

  const [balances, orders, activationCount, customerCount] = await Promise.all([
    prisma.creditLedger.groupBy({ by: ["sku"], where: { resellerOrgId: profile.organizationId }, _sum: { unitsDelta: true } }),
    prisma.order.findMany({
      where: { organizationId: profile.organizationId, items: { some: { itemType: "RESELLER_CREDIT" } } },
      orderBy: { createdAt: "desc" },
      take: 25,
      include: { items: { where: { itemType: "RESELLER_CREDIT" }, select: { sku: true, quantity: true } } },
    }),
    prisma.creditLedger.count({ where: { resellerOrgId: profile.organizationId, type: "ACTIVATION" } }),
    prisma.resellerCustomer.count({ where: { resellerOrgId: profile.organizationId, status: "ACTIVE" } }),
  ]);
  const basicCredits = balances.find((balance) => balance.sku === "BASIC_ACTIVATION")?._sum.unitsDelta ?? 0;
  const premiumCredits = balances.find((balance) => balance.sku === "PREMIUM_ACTIVATION")?._sum.unitsDelta ?? 0;
  const resellerOrders = orders.map((order) => ({
    id: order.id,
    status: order.status,
    totalAmount: order.totalAmount,
    createdAt: order.createdAt.toISOString(),
    sku: order.items[0]?.sku.replace("credit:", "") ?? "BASIC_ACTIVATION",
    units: order.items[0]?.quantity ?? 0,
  }));
  return <ResellerDashboard
    businessName={profile.businessName}
    basicCredits={basicCredits}
    premiumCredits={premiumCredits}
    activationCount={activationCount}
    customerCount={customerCount}
    canManageStaff={profile.organization.memberships[0]?.role === "OWNER"}
    basicUnitPrice={configuredPrice(process.env.RESELLER_BASIC_ACTIVATION_PRICE_IDR)}
    premiumUnitPrice={configuredPrice(process.env.RESELLER_PREMIUM_ACTIVATION_PRICE_IDR)}
    orders={resellerOrders}
  />;
}
