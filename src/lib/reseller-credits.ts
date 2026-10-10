import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import { calculateCreditLedgerState, type CreditLedgerState } from "@/lib/credit-lots";

export type ResellerCreditSku = "BASIC_ACTIVATION" | "PREMIUM_ACTIVATION";

export async function lockResellerCreditBalance(tx: Prisma.TransactionClient, resellerOrgId: string) {
  await tx.$queryRaw<Array<{ id: string }>>`SELECT "id" FROM "organizations" WHERE "id" = ${resellerOrgId}::uuid FOR UPDATE`;
}

export async function getResellerCreditState(tx: Prisma.TransactionClient, resellerOrgId: string, sku: ResellerCreditSku): Promise<CreditLedgerState> {
  const entries = await tx.creditLedger.findMany({
    where: { resellerOrgId, sku },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true, orderId: true, type: true, unitsDelta: true, sourceTopUpId: true, createdAt: true, metadata: true },
  });
  return calculateCreditLedgerState(entries);
}
