import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { getCustomerCredentials } from "./customer-credentials";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard(?:\/|$)/);
}

test("customer editor feedback is queued for Support and can be resolved", async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000);
  const customer = getCustomerCredentials(testInfo);
  const supportEmail = process.env.E2E_SUPPORT_EMAIL;
  const supportPassword = process.env.E2E_SUPPORT_PASSWORD;
  if (!customer.email || !customer.password || !supportEmail || !supportPassword) {
    test.skip(true, "Requires disposable PostgreSQL customer and Support fixtures.");
    return;
  }

  await signIn(page, customer.email, customer.password);
  const draftCreation = page.waitForResponse((response) => response.url().endsWith("/api/invitations/drafts") && response.request().method() === "POST");
  await page.goto("/dashboard/invitations/new/edit?new=1");
  expect((await draftCreation).status()).toBe(201);

  const message = `Penyimpanan draft gagal ${randomUUID()}`;
  await page.getByTestId("editor-feedback-trigger").click();
  await expect(page.getByRole("dialog", { name: "Laporkan kendala editor" })).toBeVisible();
  await page.getByLabel("Bagian yang bermasalah").selectOption("AUTOSAVE");
  await page.getByLabel("Ceritakan kendalanya").fill(message);
  const submission = page.waitForResponse((response) => response.url().endsWith("/api/editor-feedback") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Kirim laporan" }).click();
  expect((await submission).status()).toBe(201);
  await expect(page.getByRole("heading", { name: "Laporan terkirim" })).toBeVisible();
  expect((await page.request.get("/api/admin/editor-feedback")).status()).toBe(403);

  const supportPage = await browser.newPage();
  try {
    await signIn(supportPage, supportEmail, supportPassword);
    await expect(supportPage.getByRole("main").getByRole("link", { name: "Antrean bantuan" })).toBeVisible();
    await supportPage.goto("/admin/editor-feedback");
    await expect(supportPage.getByRole("heading", { name: "Keluhan editor" })).toBeVisible();
    await expect(supportPage.getByText(message, { exact: true })).toBeVisible();
    const feedbackCard = supportPage.locator(".admin-feedback-card").filter({ hasText: message });
    const reviewUpdate = supportPage.waitForResponse((response) => response.url().includes("/api/admin/editor-feedback/") && response.request().method() === "PATCH");
    await feedbackCard.getByRole("button", { name: "Tandai ditinjau" }).click();
    expect((await reviewUpdate).status()).toBe(200);
    const resolveUpdate = supportPage.waitForResponse((response) => response.url().includes("/api/admin/editor-feedback/") && response.request().method() === "PATCH");
    await feedbackCard.getByRole("button", { name: "Tandai selesai" }).click();
    expect((await resolveUpdate).status()).toBe(200);
    const resolvedQueue = supportPage.waitForResponse((response) => response.url().includes("/api/admin/editor-feedback?view=resolved") && response.request().method() === "GET");
    await supportPage.getByRole("button", { name: "Selesai", exact: true }).click();
    const resolvedResult = await resolvedQueue;
    expect(resolvedResult.status()).toBe(200);
    expect((await resolvedResult.json()).feedback.some((item: { message: string }) => item.message === message)).toBe(true);
    await expect(supportPage.getByText(message, { exact: true })).toBeVisible();
    await expect(supportPage.locator(".admin-feedback-card").filter({ hasText: message }).locator(".status-pill")).toHaveText("Selesai");
  } finally {
    await supportPage.close();
  }
});
