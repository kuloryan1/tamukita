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
  await expect(page.getByText("Pengunjung marketplace harian", { exact: true })).toBeVisible();
  await expect(page.getByText("Form editor selesai", { exact: true })).toBeVisible();
  await expect(page.getByText("Penyelesaian form", { exact: true })).toBeVisible();
  await expect(page.getByText("Keluhan editor", { exact: true })).toBeVisible();
  await page.goto("/admin");
  await page.getByRole("link", { name: "Audit log" }).click();
  await expect(page.getByRole("heading", { name: "Audit log" })).toBeVisible();
  await expect(page.getByLabel("Cari aktivitas, target, atau workspace")).toBeVisible();
  await page.goto("/admin");
  await page.getByRole("link", { name: "Pengguna" }).click();
  await expect(page.getByRole("heading", { name: "Pengguna platform" })).toBeVisible();
  const sessionResponse = await page.request.get(new URL("/api/auth/session", page.url()).toString());
  const adminSession = await sessionResponse.json() as { user?: { id?: string } };
  expect(adminSession.user?.id).toMatch(/^[0-9a-f-]{36}$/i);
  const ownRoleChange = await page.request.patch(new URL(`/api/admin/users/${adminSession.user?.id}`, page.url()).toString(), { data: { platformRole: "CUSTOMER" } });
  expect(ownRoleChange.status()).toBe(409);
  const customerDirectory = await page.request.get(new URL(`/api/admin/users?q=${encodeURIComponent(existingCustomerEmail)}`, page.url()).toString());
  expect(customerDirectory.status()).toBe(200);
  const directory = await customerDirectory.json() as { users: Array<{ id: string; platformRole: string }> };
  const existingCustomer = directory.users.find((user) => user.platformRole === "CUSTOMER");
  expect(existingCustomer?.id).toMatch(/^[0-9a-f-]{36}$/i);
  if (!existingCustomer) throw new Error("The customer account is missing from the platform user directory.");
  await page.getByLabel("Cari pengguna").fill(existingCustomerEmail);
  const userRow = page.getByTestId(`admin-user-row-${existingCustomer.id}`);
  await expect(userRow).toBeVisible();
  const roleSelect = userRow.getByLabel(`Peran platform ${existingCustomerEmail}`);
  try {
    const promoteResponse = page.waitForResponse((response) => response.url().endsWith(`/api/admin/users/${existingCustomer.id}`) && response.request().method() === "PATCH");
    await roleSelect.selectOption("SUPPORT");
    await userRow.getByRole("button", { name: "Simpan peran" }).click();
    expect((await promoteResponse).status()).toBe(200);
    await expect(roleSelect).toHaveValue("SUPPORT");
    await expect(page.getByRole("status")).toContainText("dicatat di audit log");
  } finally {
    await page.request.patch(new URL(`/api/admin/users/${existingCustomer.id}`, page.url()).toString(), { data: { platformRole: "CUSTOMER" } });
  }
  await page.goto(new URL("/admin/audit?q=admin.user_platform_role_changed", page.url()).toString());
  expect(await page.getByText("admin · user_platform_role_changed", { exact: true }).count()).toBeGreaterThanOrEqual(2);
  await page.goto("/admin");
  await page.getByRole("link", { name: "Paket" }).click();
  await expect(page.getByRole("heading", { name: "Paket dan entitlement" })).toBeVisible();
  const planKey = `e2e-${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Kode paket").fill(planKey);
  await page.getByLabel("Nama paket").fill("Paket uji E2E");
  await page.getByLabel("Deskripsi").fill("Paket konfigurasi uji");
  await page.getByLabel("Harga (IDR)").fill("10000");
  await page.getByLabel("Masa berlaku (hari)").fill("90");
  await page.getByLabel("Entitlement JSON").fill('{"gallery.limit":6,"music":true}');
  const activePlanCreation = await page.request.post(new URL("/api/admin/plans", page.url()).toString(), { data: { key: planKey, name: "Paket aktif langsung", description: null, priceIdr: 10000, durationDays: 90, isActive: true, entitlements: [] } });
  expect(activePlanCreation.status()).toBe(400);
  const invalidPlan = await page.request.post(new URL("/api/admin/plans", page.url()).toString(), { data: { key: planKey, name: "Paket invalid", description: null, priceIdr: 10000, durationDays: 90, entitlements: [{ featureKey: "music", value: true }, { featureKey: "music", value: false }] } });
  expect(invalidPlan.status()).toBe(400);
  const reservedEntitlementPlan = await page.request.post(new URL("/api/admin/plans", page.url()).toString(), { data: { key: planKey, name: "Paket invalid", description: null, priceIdr: 10000, durationDays: 90, entitlements: [{ featureKey: "hosting", value: { periodDays: 90 } }] } });
  expect(reservedEntitlementPlan.status()).toBe(400);
  const planCreationPromise = page.waitForResponse((response) => response.url().endsWith("/api/admin/plans") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Buat paket" }).click();
  const planCreation = await planCreationPromise;
  expect(planCreation.status()).toBe(201);
  const createdPlan = await planCreation.json() as { plan: { id: string; isActive: boolean; priceIdr: number; updatedAt: string } };
  expect(createdPlan.plan.isActive).toBe(false);
  expect(createdPlan.plan.priceIdr).toBe(10_000);
  const planRow = page.getByTestId(`admin-plan-row-${createdPlan.plan.id}`);
  await expect(planRow).toBeVisible();
  await planRow.getByRole("button", { name: "Edit paket Paket uji E2E" }).click();
  await page.getByLabel("Harga (IDR)").fill("12000");
  await page.getByLabel("Entitlement JSON").fill('{"gallery.limit":8,"music":true,"rsvp.enabled":true}');
  await page.getByLabel("Tandai paket aktif").check();
  const planUpdatePromise = page.waitForResponse((response) => response.url().endsWith(`/api/admin/plans/${createdPlan.plan.id}`) && response.request().method() === "PATCH");
  await page.getByRole("button", { name: "Simpan perubahan" }).click();
  const planUpdate = await planUpdatePromise;
  expect(planUpdate.status()).toBe(200);
  const updatedPlan = await planUpdate.json() as { plan: { priceIdr: number; isActive: boolean; updatedAt: string; entitlements: Array<{ featureKey: string; value: unknown }> } };
  expect(updatedPlan.plan.priceIdr).toBe(12_000);
  expect(updatedPlan.plan.isActive).toBe(true);
  expect(updatedPlan.plan.entitlements.map(({ featureKey }) => featureKey)).toEqual(["gallery.limit", "music", "rsvp.enabled"]);
  const stalePlanUpdate = await page.request.patch(new URL(`/api/admin/plans/${createdPlan.plan.id}`, page.url()).toString(), { data: { expectedUpdatedAt: createdPlan.plan.updatedAt, name: "Paket stale", description: null, priceIdr: 10000, durationDays: 90, isActive: false, entitlements: [] } });
  expect(stalePlanUpdate.status()).toBe(409);
  const listedPlansResponse = await page.request.get(new URL(`/api/admin/plans?q=${planKey}`, page.url()).toString());
  expect(listedPlansResponse.status()).toBe(200);
  const listedPlans = await listedPlansResponse.json() as { plans: Array<{ id: string; isActive: boolean; entitlements: Array<{ featureKey: string; value: unknown }> }> };
  expect(listedPlans.plans).toContainEqual(expect.objectContaining({ id: createdPlan.plan.id, isActive: true }));
  const customerPlansResponse = await page.request.get(new URL("/api/customer/plans", page.url()).toString());
  expect(customerPlansResponse.status()).toBe(200);
  const customerPlans = await customerPlansResponse.json() as { plans: Array<{ id: string; key: string; priceIdr: number; durationDays: number }> };
  expect(customerPlans.plans).toContainEqual(expect.objectContaining({ id: createdPlan.plan.id, key: planKey, priceIdr: 12_000, durationDays: 90 }));
  const deactivatedPlan = await page.request.patch(new URL(`/api/admin/plans/${createdPlan.plan.id}`, page.url()).toString(), { data: { expectedUpdatedAt: updatedPlan.plan.updatedAt, name: "Paket uji E2E", description: "Paket konfigurasi uji", priceIdr: 12_000, durationDays: 90, isActive: false, entitlements: [{ featureKey: "gallery.limit", value: 8 }, { featureKey: "music", value: true }, { featureKey: "rsvp.enabled", value: true }] } });
  expect(deactivatedPlan.status()).toBe(200);
  await page.goto(new URL("/admin/audit?q=admin.plan_updated", page.url()).toString());
  expect(await page.getByText("admin · plan_updated", { exact: true }).count()).toBeGreaterThan(0);
  await page.goto("/admin");

  const financePage = await browser.newPage();
  try {
    await financePage.goto(new URL("/login", page.url()).toString());
    await financePage.getByLabel("Alamat email").fill(process.env.E2E_FINANCE_EMAIL ?? "");
    await financePage.getByLabel("Kata sandi").fill(process.env.E2E_FINANCE_PASSWORD ?? "");
    await financePage.getByRole("button", { name: "Masuk" }).click();
    await financePage.waitForURL(/\/dashboard/);
    expect((await financePage.request.get(new URL("/api/admin/users", page.url()).toString())).status()).toBe(403);
    expect((await financePage.request.patch(new URL("/api/admin/users/00000000-0000-4000-8000-000000000001", page.url()).toString(), { data: { platformRole: "SUPPORT" } })).status()).toBe(403);
    expect((await financePage.request.get(new URL("/api/admin/plans", page.url()).toString())).status()).toBe(403);
    expect((await financePage.request.post(new URL("/api/admin/plans", page.url()).toString(), { data: { key: "finance-test", name: "Paket", description: null, priceIdr: 1000, durationDays: 30, isActive: false, entitlements: [] } })).status()).toBe(403);
    await financePage.goto(new URL("/admin/plans", page.url()).toString());
    await financePage.waitForURL(/\/dashboard/);
    await expect(financePage.getByRole("heading", { name: "Paket dan entitlement" })).toHaveCount(0);
    await financePage.goto(new URL("/admin/users", page.url()).toString());
    await financePage.waitForURL(/\/dashboard/);
    await expect(financePage.getByRole("heading", { name: "Pengguna platform" })).toHaveCount(0);
    expect((await financePage.request.get(new URL("/api/admin/editor-feedback", page.url()).toString())).status()).toBe(403);
    await financePage.goto(new URL("/admin/editor-feedback", page.url()).toString());
    await financePage.waitForURL(/\/dashboard/);
    await expect(financePage.getByRole("heading", { name: "Keluhan editor" })).toHaveCount(0);
    await financePage.goto(new URL("/admin/analytics", page.url()).toString());
    await expect(financePage.getByRole("heading", { name: "Analitik platform" })).toBeVisible();
    await expect(financePage.getByRole("heading", { name: "Template digunakan per kategori" })).toBeVisible();
    await expect(financePage.getByText("Tampilan katalog template", { exact: true })).toBeVisible();
    await expect(financePage.getByText("Pengunjung marketplace harian", { exact: true })).toBeVisible();
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
