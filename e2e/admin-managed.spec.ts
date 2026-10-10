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
  await page.getByRole("link", { name: "Analitik" }).click();
  await expect(page.getByRole("heading", { name: "Analitik platform" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Nilai per saluran" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Template paling banyak dipublikasikan" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Template digunakan per kategori" })).toBeVisible();
  await expect(page.getByText("Tampilan katalog template", { exact: true })).toBeVisible();
  await expect(page.getByText("Tampilan detail template", { exact: true })).toBeVisible();
  await page.goto("/admin");
  await page.getByRole("link", { name: "Audit log" }).click();
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  await expect(page.getByLabel("Cari aktivitas, target, atau workspace")).toBeVisible();
  await page.goto("/admin");

  const financePage = await browser.newPage();
  try {
    await financePage.goto(new URL("/login", page.url()).toString());
    await financePage.getByLabel("Alamat email").fill(process.env.E2E_FINANCE_EMAIL ?? "");
    await financePage.getByLabel("Kata sandi").fill(process.env.E2E_FINANCE_PASSWORD ?? "");
    await financePage.getByRole("button", { name: "Masuk" }).click();
    await financePage.waitForURL(/\/dashboard/);
    await financePage.goto(new URL("/admin/analytics", page.url()).toString());
    await expect(financePage.getByRole("heading", { name: "Analitik platform" })).toBeVisible();
    await expect(financePage.getByRole("heading", { name: "Template digunakan per kategori" })).toBeVisible();
    await expect(financePage.getByText("Tampilan katalog template", { exact: true })).toBeVisible();
    await financePage.goto(new URL("/admin", page.url()).toString());
    await financePage.waitForURL(/\/dashboard/);
    await expect(financePage.getByRole("heading", { name: "Admin TamuKita" })).toHaveCount(0);
    await financePage.goto(new URL("/admin/audit", page.url()).toString());
    await financePage.waitForURL(/\/dashboard/);
    await expect(financePage.getByRole("heading", { name: "Audit log" })).toHaveCount(0);
  } finally {
    await financePage.close();
  }

  const suffix = randomUUID().slice(0, 8);
  const customerEmail = `e2e-managed-${suffix}@example.test`;
  const invitationSlug = `e2e-managed-${suffix}`;
  const newCustomerFamilyDetails = `Keluarga Khitan ${suffix}`;
  await page.getByLabel("Nama pelanggan").fill("Pelanggan Uji");
  await page.getByLabel("Email akun pelanggan").fill(customerEmail);
  await page.getByLabel("Jenis acara").selectOption("Khitan");
  await expect(page.getByLabel("Judul acara")).toBeVisible();
  await expect(page.getByLabel("Nama keluarga / orang tua")).toBeVisible();
  await page.getByLabel("Judul acara").fill("Khitan Nara");
  await page.getByLabel("Nama keluarga / orang tua").fill(newCustomerFamilyDetails);
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
  const newCustomerRequest = creationResponse.request().postDataJSON() as { draft?: { eventKind?: string; familyDetails?: string } };
  expect(result.customerCreated).toBe(true);
  expect(result.onboardingEmailSent).toBe(true);
  expect(result.invitation?.slug).toBe(invitationSlug);
  expect(newCustomerRequest.draft).toMatchObject({ eventKind: "Khitan", familyDetails: newCustomerFamilyDetails });
  const onboardingEmailResponse = await page.request.get(`http://127.0.0.1:3140/messages?to=${encodeURIComponent(customerEmail)}`);
  expect(onboardingEmailResponse.status()).toBe(200);
  const onboardingEmailPayload = await onboardingEmailResponse.json() as { messages: Array<{ subject: string; text: string }> };
  expect(onboardingEmailPayload.messages.some((message) =>
    message.subject === "Atur kata sandi TamuKita" && message.text.includes(`${new URL(page.url()).origin}/reset-password?token=`),
  )).toBe(true);
  await expect(page.getByRole("status")).toContainText("Akun pelanggan dibuat");

  const existingInvitationSlug = `e2e-managed-existing-${suffix}`;
  const existingFamilyDetails = `Keluarga Nara dan Dimas ${suffix}`;
  await page.getByLabel("Nama pelanggan").fill("Pelanggan Uji");
  await page.getByLabel("Email akun pelanggan").fill(existingCustomerEmail);
  await page.getByLabel("Jenis acara").selectOption("Pernikahan");
  await page.getByLabel("Nama pertama").fill(`Nara ${suffix}`);
  await page.getByLabel("Nama kedua").fill(`Dimas ${suffix}`);
  await page.getByLabel("Keluarga yang turut mengundang").fill(existingFamilyDetails);
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
    await customerPage.goto(new URL(`/dashboard/invitations/${existingResult.invitation?.id}/edit`, page.url()).toString());
    await expect(customerPage.getByLabel("Keluarga yang turut mengundang")).toHaveValue(existingFamilyDetails);
  } finally {
    await customerPage.close();
  }
});
