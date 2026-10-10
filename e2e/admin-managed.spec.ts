import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("admin creates a customer workspace and a draft invitation", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
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
  expect(result.onboardingEmailSent).toBe(false);
  expect(result.invitation?.slug).toBe(invitationSlug);
  await expect(page.getByRole("status")).toContainText("Akun pelanggan dibuat");
});
