import { describe, expect, it } from "vitest";
import { calculateCreditLedgerState } from "@/lib/credit-lots";

const date = (day: number) => new Date(`2026-10-${String(day).padStart(2, "0")}T00:00:00.000Z`);

describe("reseller credit lot accounting", () => {
  it("keeps usage attached to the top-up lot that funded it", () => {
    const state = calculateCreditLedgerState([
      { id: "top-up-a", orderId: "order-a", type: "TOP_UP", unitsDelta: 2, sourceTopUpId: null, createdAt: date(1) },
      { id: "top-up-b", orderId: "order-b", type: "TOP_UP", unitsDelta: 1, sourceTopUpId: null, createdAt: date(2) },
      { id: "activation-b", type: "ACTIVATION", unitsDelta: -1, sourceTopUpId: "top-up-b", createdAt: date(3) },
    ]);

    expect(state.totalBalance).toBe(2);
    expect(state.lots).toMatchObject([
      { id: "top-up-a", unitsRemaining: 2 },
      { id: "top-up-b", unitsRemaining: 0 },
    ]);
  });

  it("uses old untracked activations conservatively and leaves later purchases attributable", () => {
    const state = calculateCreditLedgerState([
      { id: "top-up-a", orderId: "order-a", type: "TOP_UP", unitsDelta: 1, sourceTopUpId: null, createdAt: date(1) },
      { id: "legacy-activation", type: "ACTIVATION", unitsDelta: -1, sourceTopUpId: null, createdAt: date(2) },
      { id: "top-up-b", orderId: "order-b", type: "TOP_UP", unitsDelta: 2, sourceTopUpId: null, createdAt: date(3) },
    ]);

    expect(state.totalBalance).toBe(2);
    expect(state.lots).toMatchObject([
      { id: "top-up-a", unitsRemaining: 0 },
      { id: "top-up-b", unitsRemaining: 2 },
    ]);
  });

  it("keeps refunded reservations and failed-refund restorations on the same lot", () => {
    const state = calculateCreditLedgerState([
      { id: "top-up-a", orderId: "order-a", type: "TOP_UP", unitsDelta: 3, sourceTopUpId: null, createdAt: date(1) },
      { id: "refund", orderId: "order-a", type: "REFUND", unitsDelta: -2, sourceTopUpId: "top-up-a", createdAt: date(2) },
      { id: "restore", orderId: "order-a", type: "ADJUSTMENT", unitsDelta: 2, sourceTopUpId: "top-up-a", createdAt: date(3) },
    ]);

    expect(state.totalBalance).toBe(3);
    expect(state.lots).toMatchObject([{ id: "top-up-a", unitsRemaining: 3 }]);
  });
});
