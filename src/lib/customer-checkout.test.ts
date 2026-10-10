import { expect, test } from "vitest";
import { buildCustomerCheckoutOrder } from "@/lib/customer-checkout";

const paidTemplate = {
  id: "template-id",
  versionId: "template-version-id",
  slug: "royal-gold",
  version: "1.2.0",
  licenseType: "PAID_PER_INVITATION" as const,
  priceIdr: 75_000,
  features: ["cover", "rsvp"],
};

test("splits paid template licensing and customer activation into separate order items", () => {
  const order = buildCustomerCheckoutOrder({ template: paidTemplate, activationPriceIdr: 25_000, hostingTermDays: 365 });

  expect(order?.totalAmountIdr).toBe(100_000);
  expect(order?.items.map(({ itemType, totalPriceIdr }) => ({ itemType, totalPriceIdr }))).toEqual([
    { itemType: "TEMPLATE_LICENSE", totalPriceIdr: 75_000 },
    { itemType: "ACTIVATION", totalPriceIdr: 25_000 },
  ]);
});

test("keeps a free template activation separate and bound to its selected version", () => {
  const order = buildCustomerCheckoutOrder({
    template: { ...paidTemplate, licenseType: "FREE", priceIdr: 0 },
    activationPriceIdr: 25_000,
    hostingTermDays: 365,
  });

  expect(order?.totalAmountIdr).toBe(25_000);
  expect(order?.items).toHaveLength(1);
  expect(order?.items[0]).toMatchObject({
    itemType: "ACTIVATION",
    templateId: paidTemplate.id,
    templateVersionId: paidTemplate.versionId,
    entitlementSnapshot: { licenseType: "FREE", hostingTermDays: 365 },
  });
});

test("preserves license-only checkout while the customer activation price is zero", () => {
  const order = buildCustomerCheckoutOrder({ template: paidTemplate, activationPriceIdr: 0, hostingTermDays: 365 });

  expect(order?.totalAmountIdr).toBe(75_000);
  expect(order?.items.map((item) => item.itemType)).toEqual(["TEMPLATE_LICENSE"]);
});

test("rejects invalid template pricing and totals that exceed the database amount range", () => {
  expect(buildCustomerCheckoutOrder({ template: { ...paidTemplate, licenseType: "FREE", priceIdr: 1 }, activationPriceIdr: 10, hostingTermDays: 365 })).toBeNull();
  expect(buildCustomerCheckoutOrder({ template: { ...paidTemplate, priceIdr: 2_147_483_647 }, activationPriceIdr: 1, hostingTermDays: 365 })).toBeNull();
});
