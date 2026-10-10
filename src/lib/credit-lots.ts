export type CreditLedgerEntry = {
  id: string;
  orderId?: string | null;
  type: "TOP_UP" | "ACTIVATION" | "REFUND" | "ADJUSTMENT";
  unitsDelta: number;
  sourceTopUpId: string | null;
  createdAt: Date;
  metadata?: unknown;
};

export type CreditLot = {
  id: string;
  orderId: string | null;
  createdAt: Date;
  unitsPurchased: number;
  unitsRemaining: number;
};

export type CreditLedgerState = {
  entries: CreditLedgerEntry[];
  lots: CreditLot[];
  totalBalance: number;
  untrackedBalance: number;
  isConsistent: boolean;
};

function compareEntries(left: CreditLedgerEntry, right: CreditLedgerEntry) {
  const timestampDifference = left.createdAt.getTime() - right.createdAt.getTime();
  return timestampDifference || left.id.localeCompare(right.id);
}

export function isUntrackedAdjustmentActivation(metadata: unknown) {
  return typeof metadata === "object" && metadata !== null && !Array.isArray(metadata)
    && "creditOrigin" in metadata && metadata.creditOrigin === "UNTRACKED_ADJUSTMENT";
}

export function calculateCreditLedgerState(input: CreditLedgerEntry[]): CreditLedgerState {
  const entries = [...input].sort(compareEntries);
  const topUps = entries.filter((entry) => entry.type === "TOP_UP");
  const topUpById = new Map(topUps.map((entry) => [entry.id, entry]));
  const lotDeltas = new Map(topUps.map((entry) => [entry.id, entry.unitsDelta]));
  const totalBalance = entries.reduce((total, entry) => total + entry.unitsDelta, 0);
  let isConsistent = topUps.every((entry) => entry.unitsDelta > 0);

  for (const entry of entries) {
    if (entry.type === "TOP_UP" || !entry.sourceTopUpId) continue;
    if (!topUpById.has(entry.sourceTopUpId)) {
      isConsistent = false;
      continue;
    }
    lotDeltas.set(entry.sourceTopUpId, (lotDeltas.get(entry.sourceTopUpId) ?? 0) + entry.unitsDelta);
  }

  if (topUps.some((entry) => {
    const lotBalance = lotDeltas.get(entry.id) ?? 0;
    return lotBalance < 0 || lotBalance > entry.unitsDelta;
  })) isConsistent = false;

  const lots = topUps.map((entry) => ({
    id: entry.id,
    orderId: entry.orderId ?? null,
    createdAt: entry.createdAt,
    unitsPurchased: entry.unitsDelta,
    unitsRemaining: Math.max(0, lotDeltas.get(entry.id) ?? 0),
  }));
  const trackedBalance = lots.reduce((total, lot) => total + (lotDeltas.get(lot.id) ?? 0), 0);
  let untrackedBalance = totalBalance - trackedBalance;

  if (untrackedBalance < 0) {
    let legacySpend = -untrackedBalance;
    for (const lot of lots) {
      const reduction = Math.min(lot.unitsRemaining, legacySpend);
      lot.unitsRemaining -= reduction;
      legacySpend -= reduction;
      if (legacySpend === 0) break;
    }
    untrackedBalance = 0;
  }

  return { entries, lots, totalBalance, untrackedBalance, isConsistent };
}
