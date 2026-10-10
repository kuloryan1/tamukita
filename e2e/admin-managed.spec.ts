import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("admin creates customer drafts and notifies an existing customer", async ({ page, browser }) => {
  test.setTimeout(60_000);
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  const existingCustomerEmail = process.env.E2E_CUSTOMER_EMAIL;
  const existingCustomerPassword = process.env.E2E_CUSTOMER_PASSWORD;
  if (!email || !password || !existingCustomerEmail || !existingCustomerPassword) {
    test.skip(true, "Requires the disposable PostgreSQL E2E fixture.");
    return;
  }

  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard/);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { name: "Admin TamuKita" })).toBeVisible();
  await expect(page.getByText("Publikasi awal 30 hari", { exact: true })).toBeVisible();

  const suffix = randomUUID().slice(0, 8);
  const customerEmail = `e2e-managed-${suffix}@example.test`;
  const invitationSlug = `e2e-managed-${suffix}`;
  await page.getByLabel("Nama pelanggan").fill("Pelanggan Uji");
  await page.getByLabel("Email akun pelanggan").fill(customerEmail);
  await page.getByLabel("Nama pertama").fill("Nara");
  await page.getByLabel("Nama kedua").fill("Dimas");
  await page.getByLabel("Tanggal").fill("2027-06-22");
  await page.getByLabel("Tempat acara").fill("The Garden House");
  await page.getByLabel("Alamat lengkap").fill("Jl. Kebun Raya No. 1, Jakarta");
  await page.getByLabel("Tautan undangan").fill(invitationSlug);

  const creationResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/admin/invitations") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Buat draft pelanggan" }).click();
  const creationResponse = await creationResponsePromise;
  expect(creationResponse.status()).toBe(201);
  const result = await creationResponse.json() as { customerCreated?: boolean; onboardingEmailSent?: boolean; invitation?: { slug: string } };
  expect(result.customerCreated).toBe(true);
  expect(result.onboardingEmailSent).toBe(true);
  expect(result.invitation?.slug).toBe(invitationSlug);
  const onboardingEmailResponse = await page.request.get(`http://127.0.0.1:3140/messages?to=${encodeURIComponent(customerEmail)}`);
  expect(onboardingEmailResponse.status()).toBe(200);
  const onboardingEmailPayload = await onboardingEmailResponse.json() as { messages: Array<{ subject: string; text: string }> };
  expect(onboardingEmailPayload.messages.some((message) =>
    message.subject === "Atur kata sandi TamuKita" && message.text.includes(`${new URL(page.url()).origin}/reset-password?token=`),
  )).toBe(true);
  await expect(page.getByRole("status")).toContainText("Akun pelanggan dibuat");

  const existingInvitationSlug = `e2e-managed-existing-${suffix}`;
  await page.getByLabel("Nama pelanggan").fill("Pelanggan Uji");
  await page.getByLabel("Email akun pelanggan").fill(existingCustomerEmail);
  await page.getByLabel("Nama pertama").fill(`Nara ${suffix}`);
  await page.getByLabel("Nama kedua").fill(`Dimas ${suffix}`);
  await page.getByLabel("Tautan undangan").fill(existingInvitationSlug);
  const existingCreationResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/admin/invitations") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Buat draft pelanggan" }).click();
  const existingCreationResponse = await existingCreationResponsePromise;
  expect(existingCreationResponse.status()).toBe(201);
  const existingResult = await existingCreationResponse.json() as { customerCreated?: boolean; invitationNotificationQueued?: boolean; invitation?: { id: string; title: string; slug: string } };
  expect(existingResult.customerCreated).toBe(false);
  expect(existingResult.invitationNotificationQueued).toBe(true);
  expect(existingResult.invitation?.slug).toBe(existingInvitationSlug);
  await expect(page.getByRole("status")).toContainText("email pemberitahuan sudah masuk antrean");
  await expect.poll(async () => {
    const notificationEmailResponse = await page.request.get(`http://127.0.0.1:3140/messages?to=${encodeURIComponent(existingCustomerEmail)}`);
    if (!notificationEmailResponse.ok()) return false;
    const notificationEmailPayload = await notificationEmailResponse.json() as { messages: Array<{ subject: string; text: string }> };
    const invitationId = existingResult.invitation?.id;
    return Boolean(invitationId && notificationEmailPayload.messages.some((message) =>
      message.subject.startsWith("Draft undangan siap ditinjau · ")
      && message.text.includes(`/dashboard/invitations/${invitationId}/edit`),
    ));
  }, { timeout: 20_000, message: "the worker should deliver the managed invitation email to the local mock" }).toBe(true);

  const customerPage = await browser.newPage();
  try {
    await customerPage.goto(new URL("/login", page.url()).toString());
    await customerPage.getByLabel("Alamat email").fill(existingCustomerEmail);
    await customerPage.getByLabel("Kata sandi").fill(existingCustomerPassword);
    await customerPage.getByRole("button", { name: "Masuk" }).click();
    await customerPage.waitForURL(/\/dashboard/);
    const invitationRow = customerPage.locator(".invitation-row").filter({
      has: customerPage.getByRole("heading", { name: existingResult.invitation?.title ?? "", exact: true }),
    });
    await expect(invitationRow).toHaveCount(1);
    await expect(invitationRow).toBeVisible();
  } finally {
    await customerPage.close();
  }
});
