import { expect, test, type Page } from "@playwright/test";
import { getCustomerCredentials } from "./customer-credentials";

const invitationFixtures = {
  desktop: { id: "10000000-0000-4000-8000-000000000003", slug: "e2e-reseller-desktop", title: "E2E Desktop & Pelanggan" },
  mobile: { id: "10000000-0000-4000-8000-000000000004", slug: "e2e-reseller-mobile", title: "E2E Mobile & Pelanggan" },
  webkit: { id: "10000000-0000-4000-8000-000000000005", slug: "e2e-reseller-webkit", title: "E2E WebKit & Pelanggan" },
};

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  try {
    await page.waitForURL(/\/dashboard(?:\/|$)/, { timeout: 30_000 });
  } catch {
    const loginError = await page.locator(".auth-form [role='alert']").textContent().catch(() => null);
    throw new Error(loginError?.trim() || "Login tidak mengarah ke dashboard dalam 30 detik.");
  }
}

test("reseller access is approved by the customer before the reseller activates their draft", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const resellerEmail = process.env.E2E_OTHER_CUSTOMER_EMAIL;
  const resellerPassword = process.env.E2E_OTHER_CUSTOMER_PASSWORD;
  const alternateResellerEmail = process.env.E2E_CUSTOMER_EMAIL;
  const alternateResellerPassword = process.env.E2E_CUSTOMER_PASSWORD;
  const isMobileProject = testInfo.project.name.startsWith("mobile-");
  const isWebkitProject = testInfo.project.name === "mobile-webkit";
  const { email: customerEmail, password: customerPassword } = getCustomerCredentials(testInfo);
  if (!resellerEmail || !resellerPassword || !alternateResellerEmail || !alternateResellerPassword || !customerEmail || !customerPassword) {
    test.skip(true, "Requires the disposable reseller and customer PostgreSQL fixtures.");
    return;
  }
  const invitation = isWebkitProject ? invitationFixtures.webkit : isMobileProject ? invitationFixtures.mobile : invitationFixtures.desktop;

  await signIn(page, resellerEmail, resellerPassword);
  await page.goto("/reseller");
  await page.getByLabel("Email akun pelanggan").fill(customerEmail);
  const accessRequestPromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/reseller/customers") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Tambahkan pelanggan" }).click();
  const accessRequest = await accessRequestPromise;
  expect(accessRequest.status()).toBe(202);
  const accessRequestResult = await accessRequest.json() as { customerId?: string; pendingApproval?: boolean };
  expect(accessRequestResult.pendingApproval).toBe(true);
  expect(accessRequestResult.customerId).toMatch(/^[0-9a-f-]{36}$/i);
  if (!accessRequestResult.customerId) throw new Error("The reseller access request did not include its request ID.");

  const baseURL = new URL(page.url()).origin;
  const customerContext = await browser.newContext({
    baseURL,
    viewport: page.viewportSize() ?? undefined,
    ...(isMobileProject ? { isMobile: true, hasTouch: true } : {}),
  });
  try {
    const customerPage = await customerContext.newPage();
    await signIn(customerPage, customerEmail, customerPassword);
    const requestSection = customerPage.locator(".customer-reseller-requests");
    await expect(requestSection.getByRole("heading", { name: "Permintaan akses reseller" })).toBeVisible();
    const approvalResponsePromise = customerPage.waitForResponse((response) =>
      response.url().endsWith(`/api/reseller/customer-requests/${accessRequestResult.customerId}`) && response.request().method() === "PATCH",
    );
    await requestSection.getByRole("button", { name: "Setujui" }).click();
    expect((await approvalResponsePromise).status()).toBe(200);
    await customerPage.reload();
    await expect(requestSection.getByRole("heading", { name: "Reseller yang tertaut" })).toBeVisible();

    const alternateResellerContext = await browser.newContext({ baseURL });
    try {
      const alternateResellerPage = await alternateResellerContext.newPage();
      await signIn(alternateResellerPage, alternateResellerEmail, alternateResellerPassword);
      const alternateCustomersResponse = await alternateResellerPage.request.get("/api/reseller/customers");
      expect(alternateCustomersResponse.status()).toBe(200);
      const alternateCustomers = await alternateCustomersResponse.json() as { customers?: Array<{ invitations?: Array<{ id: string }> }> };
      const alternateInvitationIds = alternateCustomers.customers?.flatMap((customer) => customer.invitations?.map(({ id }) => id) ?? []) ?? [];
      expect(alternateInvitationIds).not.toContain(invitation.id);

      const unauthorizedActivation = await alternateResellerPage.request.post("/api/reseller/activations", { data: { invitationId: invitation.id } });
      expect(unauthorizedActivation.status()).toBe(404);
    } finally {
      await alternateResellerContext.close();
    }

    await page.goto("/reseller");
    const customerRow = page.locator(".reseller-customer-row").filter({ hasText: customerEmail });
    await expect(customerRow).toBeVisible();
    const invitationRow = customerRow.locator(".reseller-customer-invitation").filter({ hasText: invitation.title });
    const draftActivationButton = invitationRow.getByRole("button", { name: "Aktifkan · Premium" });
    await expect(draftActivationButton).toBeVisible();
    const activationResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/reseller/activations") && response.request().method() === "POST",
    );
    await draftActivationButton.click();
    const activationResponse = await activationResponsePromise;
    expect(activationResponse.status()).toBe(200);
    expect(await activationResponse.json()).toMatchObject({ published: true, slug: invitation.slug, creditSku: "PREMIUM_ACTIVATION", creditUsed: true });

    const duplicateActivation = await page.request.post("/api/reseller/activations", { data: { invitationId: invitation.id } });
    expect(duplicateActivation.status()).toBe(404);
    expect((await page.request.get(`/${invitation.slug}`)).status()).toBe(200);

    await page.goto("/dashboard");
    await expect(page.locator(".invitation-row").filter({ hasText: invitation.title })).toHaveCount(0);
    await customerPage.goto("/dashboard");
    const ownedInvitation = customerPage.locator(".invitation-row").filter({ hasText: invitation.title });
    await expect(ownedInvitation).toBeVisible();
    await expect(ownedInvitation.locator(".status-pill")).toContainText("Aktif");
  } finally {
    await customerContext.close();
  }
});

test("reseller sales reports are visible to managers and auditable when corrected", async ({ page, browser }, testInfo) => {
  test.setTimeout(180_000);
  const ownerEmail = process.env.E2E_RESELLER_REPORT_OWNER_EMAIL;
  const ownerPassword = process.env.E2E_RESELLER_REPORT_OWNER_PASSWORD;
  const staffEmail = process.env.E2E_MOBILE_CUSTOMER_EMAIL;
  const staffPassword = process.env.E2E_MOBILE_CUSTOMER_PASSWORD;
  const otherResellerEmail = process.env.E2E_OTHER_CUSTOMER_EMAIL;
  const otherResellerPassword = process.env.E2E_OTHER_CUSTOMER_PASSWORD;
  if (!ownerEmail || !ownerPassword || !staffEmail || !staffPassword || !otherResellerEmail || !otherResellerPassword) {
    test.skip(true, "Requires disposable reseller owner, staff, and second-reseller fixtures.");
    return;
  }

  await signIn(page, ownerEmail, ownerPassword);
  await page.goto("/reseller");
  const report = page.locator(".reseller-sales-card");
  await expect(report.getByRole("heading", { name: "Laporan penjualan", exact: true })).toBeVisible();
  const description = `E2E sales report ${testInfo.project.name} ${Date.now()}`;
  await page.getByLabel("Deskripsi penjualan").fill(description);
  await page.getByLabel("Nilai yang dilaporkan (IDR)").fill("1500000");
  const createResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/reseller/sales") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Catat penjualan" }).click();
  const createResponse = await createResponsePromise;
  expect(createResponse.status()).toBe(201);
  const createdSale = await createResponse.json() as { sale?: { id: string } };
  expect(createdSale.sale?.id).toMatch(/^[0-9a-f-]{36}$/i);
  if (!createdSale.sale?.id) throw new Error("The reseller sale report did not include its ID.");
  const saleRow = report.locator(".reseller-sale-row").filter({ hasText: description });
  await expect(saleRow).toContainText("1.500.000");

  const otherResellerContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const otherResellerPage = await otherResellerContext.newPage();
    await signIn(otherResellerPage, otherResellerEmail, otherResellerPassword);
    const otherSalesResponse = await otherResellerPage.request.get("/api/reseller/sales");
    expect(otherSalesResponse.status()).toBe(200);
    const otherSales = await otherSalesResponse.json() as { sales?: Array<{ id: string }> };
    expect(otherSales.sales?.some(({ id }) => id === createdSale.sale?.id)).toBe(false);
    const crossTenantCorrection = await otherResellerPage.request.patch(`/api/reseller/sales/${createdSale.sale.id}`, { data: { reason: "Cross-tenant E2E check" } });
    expect(crossTenantCorrection.status()).toBe(404);
  } finally {
    await otherResellerContext.close();
  }

  await saleRow.getByRole("button", { name: "Koreksi" }).click();
  await saleRow.getByLabel("Alasan koreksi").fill("Catatan E2E dibatalkan untuk validasi.");
  const voidResponsePromise = page.waitForResponse((response) =>
    response.url().includes("/api/reseller/sales/") && response.request().method() === "PATCH",
  );
  await saleRow.getByRole("button", { name: "Batalkan catatan" }).click();
  expect((await voidResponsePromise).status()).toBe(200);
  await expect(saleRow).toContainText("Dibatalkan");

  const staffContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const staffPage = await staffContext.newPage();
    await signIn(staffPage, staffEmail, staffPassword);
    await staffPage.goto("/reseller");
    await expect(staffPage.locator(".reseller-sales-card")).toHaveCount(0);
    expect((await staffPage.request.get("/api/reseller/sales")).status()).toBe(403);
    expect((await staffPage.request.post("/api/reseller/sales", { data: { amountIdr: 1000, description: "Staf tidak boleh melaporkan" } })).status()).toBe(403);
  } finally {
    await staffContext.close();
  }
});
