import { expect, test, type APIRequestContext, type Page } from "@playwright/test";

const expiredOrderId = "20000000-0000-4000-8000-000000000003";
const successfulRefundOrderId = "20000000-0000-4000-8000-000000000004";
const failedRefundOrderId = "20000000-0000-4000-8000-000000000005";
const attributableRefundOrderId = "20000000-0000-4000-8000-000000000006";
const alreadyUsedRefundOrderId = "20000000-0000-4000-8000-000000000008";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard(?:\/|$)/);
}

function postWebhook(request: APIRequestContext, token: string, payload: Record<string, unknown>) {
  return request.post("/api/webhooks/xendit", {
    headers: { "x-callback-token": token },
    data: payload,
  });
}

async function readAdminOrder(page: Page, orderId: string) {
  const response = await page.request.get(`/api/admin/orders?q=${encodeURIComponent(orderId)}`);
  expect(response.status()).toBe(200);
  const payload = await response.json() as { orders?: Array<{ id: string; status: string; paymentStatus: string; refunds: Array<{ status: string; failureCode: string | null }> }> };
  const order = payload.orders?.find((candidate) => candidate.id === orderId);
  if (!order) throw new Error(`Admin order lookup did not return ${orderId}.`);
  return order;
}

test("Xendit expiry and refund callbacks retry safely and update reseller balances", async ({ request, browser }, testInfo) => {
  test.setTimeout(90_000);
  test.skip(testInfo.project.name !== "desktop-chromium", "Payment lifecycle callbacks run once per disposable database fixture.");

  const sessionToken = process.env.E2E_XENDIT_WEBHOOK_TOKEN;
  const refundToken = process.env.E2E_XENDIT_REFUND_WEBHOOK_TOKEN;
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  const resellerEmail = process.env.E2E_REFUND_RESELLER_EMAIL;
  const resellerPassword = process.env.E2E_REFUND_RESELLER_PASSWORD;
  const checkoutEmail = process.env.E2E_CUSTOMER_EMAIL;
  const checkoutPassword = process.env.E2E_CUSTOMER_PASSWORD;
  if (!sessionToken || !refundToken || !adminEmail || !adminPassword || !resellerEmail || !resellerPassword || !checkoutEmail || !checkoutPassword) {
    test.skip(true, "Requires disposable PostgreSQL payment fixtures and both Xendit webhook tokens.");
    return;
  }

  const expiredPayload = {
    event: "payment_session.expired",
    data: {
      payment_session_id: "e2e-expired-reseller-top-up-session",
      reference_id: expiredOrderId,
      status: "EXPIRED",
      amount: 40_000,
      currency: "IDR",
    },
  };
  const earlyRetry = await postWebhook(request, sessionToken, {
    ...expiredPayload,
    data: { ...expiredPayload.data, payment_session_id: "e2e-session-not-yet-persisted" },
  });
  expect(earlyRetry.status()).toBe(503);
  expect(await earlyRetry.json()).toMatchObject({ retryable: true });

  const expiredResponse = await postWebhook(request, sessionToken, expiredPayload);
  expect(expiredResponse.status()).toBe(200);
  expect(await expiredResponse.json()).toMatchObject({ received: true });
  const duplicateExpiredResponse = await postWebhook(request, sessionToken, expiredPayload);
  expect(duplicateExpiredResponse.status()).toBe(200);
  expect(await duplicateExpiredResponse.json()).toMatchObject({ received: true, duplicate: true });

  const successfulRefundPayload = {
    event: "refund.succeeded",
    data: {
      id: "e2e-provider-refund-success",
      reference_id: "e2e-successful-refund-reference",
      payment_request_id: "e2e-successful-refund-payment-request",
      amount: 100_000,
      currency: "IDR",
      status: "SUCCEEDED",
    },
  };
  const successfulRefundResponse = await postWebhook(request, refundToken, successfulRefundPayload);
  expect(successfulRefundResponse.status()).toBe(200);
  expect(await successfulRefundResponse.json()).toMatchObject({ received: true, duplicate: false, processed: true });
  const duplicateSuccessfulRefundResponse = await postWebhook(request, refundToken, successfulRefundPayload);
  expect(duplicateSuccessfulRefundResponse.status()).toBe(200);
  expect(await duplicateSuccessfulRefundResponse.json()).toMatchObject({ received: true, duplicate: true, processed: true });

  const failedRefundPayload = {
    event: "refund.failed",
    data: {
      id: "e2e-provider-refund-failure",
      reference_id: "e2e-failed-refund-reference",
      payment_request_id: "e2e-failed-refund-payment-request",
      amount: 20_000,
      currency: "IDR",
      status: "FAILED",
      failure_code: "E2E_PROVIDER_DECLINED",
    },
  };
  const failedRefundResponse = await postWebhook(request, refundToken, failedRefundPayload);
  expect(failedRefundResponse.status()).toBe(200);
  expect(await failedRefundResponse.json()).toMatchObject({ received: true, duplicate: false, processed: true });
  const duplicateFailedRefundResponse = await postWebhook(request, refundToken, failedRefundPayload);
  expect(duplicateFailedRefundResponse.status()).toBe(200);
  expect(await duplicateFailedRefundResponse.json()).toMatchObject({ received: true, duplicate: true, processed: true });

  const baseURL = process.env.PLAYWRIGHT_TEST_BASE_URL?.trim() || `http://127.0.0.1:${process.env.PLAYWRIGHT_TEST_PORT ?? "23300"}`;
  const adminContext = await browser.newContext({ baseURL });
  const resellerContext = await browser.newContext({ baseURL });
  const checkoutContext = await browser.newContext({ baseURL });
  try {
    const adminPage = await adminContext.newPage();
    await signIn(adminPage, adminEmail, adminPassword);

    await adminPage.goto("/admin/orders");
    await expect(adminPage.getByText("Ekspor rekonsiliasi Xendit")).toBeVisible();
    const rangeTo = new Date();
    const rangeFrom = new Date(rangeTo);
    rangeFrom.setUTCDate(rangeFrom.getUTCDate() - 30);
    const dateFrom = rangeFrom.toISOString().slice(0, 10);
    const dateTo = rangeTo.toISOString().slice(0, 10);
    const reconciliationResponse = await adminPage.request.get(`/api/admin/orders/reconciliation?from=${dateFrom}&to=${dateTo}`);
    expect(reconciliationResponse.status()).toBe(200);
    expect(reconciliationResponse.headers()["content-type"]).toContain("text/csv");
    expect(reconciliationResponse.headers()["content-disposition"]).toContain("tamukita-reconciliation-");
    const reconciliationCsv = await reconciliationResponse.text();
    expect(reconciliationCsv).toContain("payment_event_log_id");
    expect(reconciliationCsv).toContain(expiredOrderId);
    expect(reconciliationCsv).toContain("e2e-provider-refund-success");

    await expect.poll(async () => (await readAdminOrder(adminPage, expiredOrderId)).status).toBe("EXPIRED");
    expect((await readAdminOrder(adminPage, expiredOrderId)).paymentStatus).toBe("EXPIRED");

    const successfulRefundOrder = await readAdminOrder(adminPage, successfulRefundOrderId);
    expect(successfulRefundOrder.status).toBe("REFUNDED");
    expect(successfulRefundOrder.refunds).toContainEqual(expect.objectContaining({ status: "SUCCEEDED", failureCode: null }));

    const failedRefundOrder = await readAdminOrder(adminPage, failedRefundOrderId);
    expect(failedRefundOrder.status).toBe("PAID");
    expect(failedRefundOrder.refunds).toContainEqual(expect.objectContaining({ status: "FAILED", failureCode: "E2E_PROVIDER_DECLINED" }));

    const attributableRefund = await adminPage.request.post(`/api/admin/orders/${attributableRefundOrderId}/refunds`, {
      data: { reason: "REQUESTED_BY_CUSTOMER", amount: 100_000, adminNote: "Refund unused credits from the purchased lot." },
    });
    expect(attributableRefund.status()).toBe(202);
    expect(await attributableRefund.json()).toMatchObject({ requested: true, status: "PENDING" });

    const alreadyUsedRefund = await adminPage.request.post(`/api/admin/orders/${alreadyUsedRefundOrderId}/refunds`, {
      data: { reason: "REQUESTED_BY_CUSTOMER", amount: 50_000, adminNote: "This lot funded a completed activation." },
    });
    expect(alreadyUsedRefund.status()).toBe(409);

    const resellerPage = await resellerContext.newPage();
    await signIn(resellerPage, resellerEmail, resellerPassword);
    const forbiddenReconciliation = await resellerPage.request.get(`/api/admin/orders/reconciliation?from=${dateFrom}&to=${dateTo}`);
    expect(forbiddenReconciliation.status()).toBe(403);
    await resellerPage.goto("/reseller");
    await expect(resellerPage.locator(".reseller-credit-grid .stat-card").filter({ hasText: "Kredit aktivasi Basic" }).locator("strong")).toHaveText("1");
    await expect(resellerPage.locator(".reseller-credit-grid .stat-card").filter({ hasText: "Kredit aktivasi Premium" }).locator("strong")).toHaveText("0");

    if (!process.env.PLAYWRIGHT_TEST_BASE_URL) {
      const checkoutPage = await checkoutContext.newPage();
      await signIn(checkoutPage, checkoutEmail, checkoutPassword);
      const successfulCheckout = await checkoutPage.request.post("/api/reseller/credits/checkout", { data: { sku: "BASIC_ACTIVATION", quantity: 1 } });
      expect(successfulCheckout.status()).toBe(200);
      const checkoutResult = await successfulCheckout.json() as { checkoutUrl?: string };
      expect(checkoutResult.checkoutUrl).toMatch(/^https:\/\/checkout\.xendit\.co\/e2e\//);

      const canceledCheckout = await resellerPage.request.post("/api/reseller/credits/checkout", { data: { sku: "BASIC_ACTIVATION", quantity: 1 } });
      expect(canceledCheckout.status()).toBe(502);

      const checkoutOrderResponse = await adminPage.request.get(`/api/admin/orders?q=${encodeURIComponent(checkoutEmail)}`);
      expect(checkoutOrderResponse.status()).toBe(200);
      const checkoutOrders = await checkoutOrderResponse.json() as { orders?: Array<{ status: string; paymentStatus: string; item: string }> };
      expect(checkoutOrders.orders).toContainEqual(expect.objectContaining({ status: "PENDING", paymentStatus: "PENDING", item: "credit:BASIC_ACTIVATION" }));

      const canceledOrderResponse = await adminPage.request.get(`/api/admin/orders?q=${encodeURIComponent(resellerEmail)}`);
      expect(canceledOrderResponse.status()).toBe(200);
      const canceledOrders = await canceledOrderResponse.json() as { orders?: Array<{ status: string; paymentStatus: string; item: string }> };
      expect(canceledOrders.orders).toContainEqual(expect.objectContaining({ status: "CANCELED", paymentStatus: "FAILED", item: "credit:BASIC_ACTIVATION" }));
      await expect(resellerPage.locator(".reseller-credit-grid .stat-card").filter({ hasText: "Kredit aktivasi Basic" }).locator("strong")).toHaveText("1");
    }
  } finally {
    await Promise.all([adminContext.close(), resellerContext.close(), checkoutContext.close()]);
  }
});
