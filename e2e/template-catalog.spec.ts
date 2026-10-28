import { expect, test } from "@playwright/test";

test("template category filters are actionable and show their selected state", async ({ page }) => {
  const response = await page.goto("/templates");
  expect(response?.status()).toBe(200);

  const categoryNavigation = page.getByRole("navigation", { name: "Kategori template" });
  const categoryLinks = categoryNavigation.getByRole("link");
  await expect(categoryLinks.first()).toHaveAttribute("aria-current", "page");
  expect(await categoryLinks.count()).toBeGreaterThan(1);

  await categoryLinks.nth(1).click();
  await expect(page).toHaveURL(/\/templates\?category=/);
  await expect(categoryNavigation.getByRole("link").nth(1)).toHaveAttribute("aria-current", "page");
  await expect(page.locator(".catalog-result-count")).toHaveText(/^\d+ desain untuk dipilih$/);

  await categoryNavigation.getByRole("link", { name: /Semua/ }).click();
  await expect(page).toHaveURL(/\/templates$/);
  await expect(categoryLinks.first()).toHaveAttribute("aria-current", "page");
});
