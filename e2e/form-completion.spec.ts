import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";
import { getCustomerCredentials } from "./customer-credentials";

const databasePool = process.env.DATABASE_URL ? (() => {
  const databaseUrl = new URL(process.env.DATABASE_URL);
  databaseUrl.searchParams.delete("schema");
  return new Pool({ connectionString: databaseUrl.toString() });
})() : null;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard(?:\/|$)/);
}

test.afterAll(async () => {
  await databasePool?.end();
});

test("a validated editor form is counted once before checkout", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const customer = getCustomerCredentials(testInfo);
  if (!customer.email || !customer.password || !databasePool) {
    test.skip(true, "Requires a disposable PostgreSQL customer fixture.");
    return;
  }

  await signIn(page, customer.email, customer.password);
  const suffix = randomUUID().slice(0, 8);
  const draftResponse = await page.request.post("/api/invitations/drafts", {
    data: {
      slug: `e2e-form-${suffix}`,
      eventKind: "Pernikahan",
      eventTitle: "Undangan Pernikahan",
      hostOne: "Alya",
      hostTwo: "Bima",
      familyDetails: "",
      eventDate: "2027-10-24",
      eventTime: "10:00",
      venue: "The Garden House",
      address: "Jl. Kebun Raya No. 1, Jakarta",
      mapsUrl: "",
      story: "Dengan penuh kebahagiaan, kami mengundangmu.",
      templateId: "royal-gold",
      templateVersion: "1.0.0",
      themeColor: "default",
      themeFont: "classic",
      sectionOrder: "story-first",
      coverPhoto: "",
      coverPosition: 50,
      coverPositionX: 50,
      galleryPhotos: [],
      giftMessage: "",
      giftBankName: "",
      giftAccountName: "",
      giftAccountNumber: "",
      musicUrl: "",
      musicTitle: "",
    },
  });
  expect(draftResponse.status()).toBe(201);
  const draftResult = await draftResponse.json() as { draft?: Record<string, unknown> & { id?: string } };
  const createdDraft = draftResult.draft;
  const invitationId = createdDraft?.id;
  expect(invitationId).toMatch(/^[0-9a-f-]{36}$/i);
  if (!invitationId || !createdDraft) throw new Error("The draft API did not return its invitation details.");

  const saveResponse = await page.request.patch(`/api/invitations/${invitationId}`, { data: createdDraft });
  expect(saveResponse.status()).toBe(200);
  const completedBeforeCheckout = await databasePool.query<{ formCompletedAt: Date | null }>(
    'SELECT "formCompletedAt" FROM invitations WHERE id = $1',
    [invitationId],
  );
  const formCompletedAt = completedBeforeCheckout.rows[0]?.formCompletedAt;
  expect(formCompletedAt).toBeInstanceOf(Date);

  const activatedPlan = await databasePool.query<{ id: string }>(
    'UPDATE plans SET "isActive" = TRUE, "updatedAt" = NOW() WHERE key = $1 RETURNING id',
    ["e2e-checkout-plan"],
  );
  expect(activatedPlan.rows).toHaveLength(1);
  try {
    const planCatalogResponse = await page.request.get("/api/customer/plans");
    expect(planCatalogResponse.status()).toBe(200);
    const planCatalog = await planCatalogResponse.json() as { plans: Array<{ id: string; key: string; priceIdr: number; durationDays: number; updatedAt: string }> };
    const selectedPlan = planCatalog.plans.find(({ key }) => key === "e2e-checkout-plan");
    expect(selectedPlan).toMatchObject({ id: activatedPlan.rows[0]?.id, priceIdr: 25_000, durationDays: 365 });
    if (!selectedPlan) throw new Error("The active E2E checkout package was not returned to the customer.");

    const publishResponse = await page.request.post(`/api/invitations/${invitationId}/publish`, {
      data: { planId: selectedPlan.id, planUpdatedAt: selectedPlan.updatedAt },
    });
    expect(publishResponse.status()).toBe(200);
    expect(await publishResponse.json()).toMatchObject({ checkoutUrl: expect.stringMatching(/^https:\/\/checkout\.xendit\.co\/e2e\//) });

    const orderLines = await databasePool.query<{
      orderId: string;
      totalAmount: number;
      itemType: string;
      unitPriceIdr: number;
      totalPriceIdr: number;
      entitlementSnapshot: { plan?: { id?: string; priceIdr?: number; durationDays?: number } };
    }>(
      'SELECT o.id AS "orderId", o."totalAmount", oi."itemType", oi."unitPriceIdr", oi."totalPriceIdr", oi."entitlementSnapshot" FROM orders o JOIN order_items oi ON oi."orderId" = o.id WHERE o."invitationId" = $1 ORDER BY oi."itemType"',
      [invitationId],
    );
    expect(orderLines.rows.map(({ itemType }) => itemType).sort()).toEqual(["ACTIVATION", "TEMPLATE_LICENSE"]);
    const activationLine = orderLines.rows.find(({ itemType }) => itemType === "ACTIVATION");
    expect(activationLine?.unitPriceIdr).toBe(selectedPlan.priceIdr);
    expect(activationLine?.entitlementSnapshot.plan).toMatchObject({
      id: selectedPlan.id,
      priceIdr: selectedPlan.priceIdr,
      durationDays: selectedPlan.durationDays,
    });
    expect(orderLines.rows[0]?.totalAmount).toBe(orderLines.rows.reduce((sum, line) => sum + line.totalPriceIdr, 0));

    const result = await databasePool.query<{ formCompletedAt: Date | null }>(
      'SELECT "formCompletedAt" FROM invitations WHERE id = $1',
      [invitationId],
    );
    expect(result.rows[0]?.formCompletedAt).toEqual(formCompletedAt);
  } finally {
    await databasePool.query('UPDATE plans SET "isActive" = FALSE, "updatedAt" = NOW() WHERE id = $1', [activatedPlan.rows[0]?.id]);
  }
});
