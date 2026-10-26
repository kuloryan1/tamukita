import { expect, test } from "@playwright/test";
import { getCustomerCredentials } from "./customer-credentials";

test("customer can request a private account data export", async ({ page }, testInfo) => {
  const { email, password } = getCustomerCredentials(testInfo);
  if (!email || !password) {
    test.skip(true, "Requires the disposable PostgreSQL customer fixture.");
    return;
  }

  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard(?:\/|$)/);
  await page.goto("/dashboard/privacy");
  await expect(page.getByRole("heading", { name: "Data & privasi" })).toBeVisible();

  const exportLink = page.getByRole("link", { name: "Unduh data akun (JSON)" });
  await expect(exportLink).toHaveAttribute("href", "/api/account/export");
  const response = await page.evaluate(async () => {
    const result = await fetch("/api/account/export");
    return {
      status: result.status,
      contentType: result.headers.get("content-type"),
      contentDisposition: result.headers.get("content-disposition"),
      payload: await result.json(),
    };
  });
  expect(response.status).toBe(200);
  expect(response.contentType).toContain("application/json");
  expect(response.contentDisposition).toMatch(/^attachment; filename="tamukita-account-data-\d{4}-\d{2}-\d{2}\.json"$/);
  const payload = response.payload as {
    data: { account: { email: string | null }; invitations: unknown[] };
    exclusions: string[];
  };
  expect(payload.data.account.email).toBe(email);
  expect(payload.data.invitations).toBeInstanceOf(Array);
  expect(payload.exclusions.join(" ")).toContain("Respons RSVP");
});
