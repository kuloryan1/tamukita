import { expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { Pool } from "pg";

const templateOrderId = "20000000-0000-4000-8000-000000000001";
const resellerOrderId = "20000000-0000-4000-8000-000000000002";
const paymentInvitationId = "10000000-0000-4000-8000-000000000002";
const paymentInvitationSlug = "e2e-payment-invite";
const templateAmountIdr = 174_000;
const planId = "50000000-0000-4000-8000-000000000001";
const databasePool = process.env.DATABASE_URL ? (() => {
  const databaseUrl = new URL(process.env.DATABASE_URL);
  databaseUrl.searchParams.delete("schema");
  return new Pool({ connectionString: databaseUrl.toString() });
})() : null;

test.afterAll(async () => {
  await databasePool?.end();
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard(?:\/|$)/);
}

async function postCompletedPayment(request: APIRequestContext, token: string, payload: Record<string, unknown>) {
  return request.post("/api/webhooks/xendit", {
    headers: { "x-callback-token": token },
    data: payload,
  });
}

test("verified payment callbacks publish a licensed invitation and top up reseller credits once", async ({ request, page }, testInfo) => {
  const token = process.env.E2E_XENDIT_WEBHOOK_TOKEN;
  const customerEmail = process.env.E2E_CUSTOMER_EMAIL;
  const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;
  if (!token || !customerEmail || !customerPassword || !databasePool) {
    test.skip(true, "Requires the disposable PostgreSQL payment fixtures and webhook token.");
    return;
  }

  await signIn(page, customerEmail, customerPassword);
  await page.goto(`/dashboard/checkout/return?invitationId=${paymentInvitationId}&payment=return`);
  if (testInfo.project.name === "desktop-chromium") {
    await expect(page.getByRole("heading", { name: "Memeriksa pembayaran..." })).toBeVisible();
    expect((await request.get(`/${paymentInvitationSlug}`)).status()).toBe(404);
  } else {
    await page.waitForURL(new RegExp(`/${paymentInvitationSlug}$`));
  }

  const templatePayment = {
    event: "payment_session.completed",
    data: {
      payment_session_id: "e2e-template-payment-session",
      reference_id: templateOrderId,
      payment_id: "e2e-template-payment-id",
      payment_request_id: "e2e-template-payment-request",
      status: "COMPLETED",
      amount: templateAmountIdr,
      currency: "IDR",
    },
  };
  const templatePaymentResponse = await postCompletedPayment(request, token, templatePayment);
  expect(templatePaymentResponse.status()).toBe(200);
  const duplicateTemplatePaymentResponse = await postCompletedPayment(request, token, templatePayment);
  expect(duplicateTemplatePaymentResponse.status()).toBe(200);
  expect(await duplicateTemplatePaymentResponse.json()).toMatchObject({ received: true, duplicate: true });
  const planGrants = await databasePool.query<{ planId: string; featureKey: string; value: unknown }>(
    'SELECT "planId", "featureKey", "value" FROM entitlements WHERE "invitationId" = $1 AND "orderId" = $2 ORDER BY "featureKey"',
    [paymentInvitationId, templateOrderId],
  );
  expect(planGrants.rows.map(({ featureKey }) => featureKey)).toEqual(["gallery.limit", "hosting", "music"]);
  expect(planGrants.rows.every(({ planId: grantedPlanId }) => grantedPlanId === planId)).toBe(true);
  expect(planGrants.rows).toContainEqual(expect.objectContaining({ featureKey: "gallery.limit", value: 6 }));
  expect(planGrants.rows).toContainEqual(expect.objectContaining({ featureKey: "music", value: true }));

  const resellerTopUp = {
    event: "payment_session.completed",
    data: {
      payment_session_id: "e2e-reseller-top-up-session",
      reference_id: resellerOrderId,
      payment_id: "e2e-reseller-top-up-payment-id",
      payment_request_id: "e2e-reseller-top-up-payment-request",
      status: "COMPLETED",
      amount: 100_000,
      currency: "IDR",
    },
  };
  const topUpResponse = await postCompletedPayment(request, token, resellerTopUp);
  expect(topUpResponse.status()).toBe(200);
  const duplicateTopUpResponse = await postCompletedPayment(request, token, resellerTopUp);
  expect(duplicateTopUpResponse.status()).toBe(200);
  expect(await duplicateTopUpResponse.json()).toMatchObject({ received: true, duplicate: true });

  await page.waitForURL(new RegExp(`/${paymentInvitationSlug}$`));
  const publishedInvitation = await request.get(`/${paymentInvitationSlug}`);
  expect(publishedInvitation.status()).toBe(200);

  await page.goto("/reseller");
  await expect(page.locator(".reseller-credit-grid .stat-card").nth(1).locator("strong")).toHaveText("2");
  await expect(page.locator(".reseller-order-row").filter({ hasText: "2 kredit Premium" })).toContainText("Lunas");
});
