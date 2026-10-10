import { expect, test } from "@playwright/test";

test("homepage exposes the invitation and template journeys", async ({ page }) => {
  const response = await page.goto("/");

  expect(response?.status()).toBe(200);
  expect(response?.headers()["x-content-type-options"]).toBe("nosniff");
  expect(response?.headers()["x-frame-options"]).toBe("DENY");
  expect(response?.headers()["referrer-policy"]).toBe("strict-origin-when-cross-origin");
  expect(response?.headers()["permissions-policy"]).toBe("camera=(), microphone=(), geolocation=()");
  expect(response?.headers()["x-powered-by"]).toBeUndefined();
  await expect(page.getByRole("heading", { level: 1, name: /undangan yang terasa seperti kamu/i })).toBeVisible();
  await expect(page.getByRole("link", { name: /buat undanganmu/i })).toHaveAttribute("href", "/dashboard/invitations/new/edit");
  await expect(page.getByRole("link", { name: /lihat koleksi/i })).toHaveAttribute("href", "/templates");
});
