import { expect, test } from "@playwright/test";

test("admin settings show web and worker readiness without exposing secrets", async ({ page }) => {
  test.setTimeout(60_000);
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
    test.skip(true, "Requires the disposable platform admin E2E fixture.");
    return;
  }

  expect((await page.request.get("/api/admin/settings")).status()).toBe(401);
  await page.goto("/admin/settings");
  await expect(page).toHaveURL(/\/login/);

  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard/);
  await page.goto("/admin/settings");

  await expect(page.getByRole("heading", { name: "Pengaturan platform" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Status integrasi web" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Status environment worker" })).toBeVisible();
  await expect(page.getByText("Database URL", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("Media R2", { exact: true }).first()).toBeVisible();

  const response = await page.request.get("/api/admin/settings");
  expect(response.status()).toBe(200);
  const settings = await response.json() as {
    integrations: Array<{ label: string; status: string }>;
    workerConfiguration: null | { checkedAt: string; integrations: Array<{ label: string; status: string }> };
  };
  expect(settings.integrations.map(({ label }) => label)).toContain("Xendit API");
  expect(settings.integrations.every(({ status }) => ["configured", "missing", "incomplete", "invalid"].includes(status))).toBe(true);
  expect(settings.workerConfiguration).not.toBeNull();
  expect(Number.isFinite(Date.parse(settings.workerConfiguration?.checkedAt ?? ""))).toBe(true);
  expect(settings.workerConfiguration?.integrations.map(({ label }) => label)).toEqual([
    "Database URL",
    "Email Resend",
    "Redis endpoint",
    "Media R2",
  ]);
  expect(settings.workerConfiguration?.integrations.every(({ status }) => status === "configured")).toBe(true);

  const serialized = JSON.stringify(settings);
  for (const secret of [
    "ci-only-secret-not-for-deployment",
    "ci-only-e2e-secret",
    "ci-only-xendit-callback-token",
    "ci-only-xendit-refund-callback-token",
    "e2e-access-key",
    "e2e-secret-key",
    "e2e-local-only",
  ]) {
    expect(serialized).not.toContain(secret);
  }
  for (const integration of [...settings.integrations, ...(settings.workerConfiguration?.integrations ?? [])]) {
    expect(Object.keys(integration).sort()).toEqual(["label", "status"]);
  }
});
