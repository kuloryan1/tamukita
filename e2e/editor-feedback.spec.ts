import { randomUUID } from "node:crypto";
import { expect, test, type Page, type Route } from "@playwright/test";
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
    const rejectReview = async (route: Route) => {
      if (route.request().method() === "PATCH") {
        await route.fulfill({ status: 503, json: { error: "Perubahan uji belum dapat disimpan." } });
        return;
      }
      await route.continue();
    };
    await supportPage.route("**/api/admin/editor-feedback/*", rejectReview);
    try {
      const rejectedUpdate = supportPage.waitForResponse((response) => response.url().includes("/api/admin/editor-feedback/") && response.request().method() === "PATCH");
      await feedbackCard.getByRole("button", { name: "Tandai ditinjau" }).click();
      expect((await rejectedUpdate).status()).toBe(503);
      await expect(supportPage.getByRole("region", { name: "Laporan aktif", exact: true }).getByRole("alert")).toContainText("Perubahan uji belum dapat disimpan.");
      await expect(feedbackCard.locator(".status-pill")).toHaveText("Baru");
      await expect(feedbackCard.getByRole("button", { name: "Tandai ditinjau" })).toBeEnabled();
    } finally {
      await supportPage.unroute("**/api/admin/editor-feedback/*", rejectReview);
    }
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

test("feedback filters fit on phones and queue changes ignore stale or failed responses", async ({ page }) => {
  test.setTimeout(75_000);
  const email = process.env.E2E_SUPPORT_EMAIL;
  const password = process.env.E2E_SUPPORT_PASSWORD;
  if (!email || !password) {
    test.skip(true, "Requires the disposable Support account; queue data is mocked locally.");
    return;
  }

  await signIn(page, email, password);
  const timestamp = new Date().toISOString();
  const activeFeedback = [
    {
      id: "20000000-0000-4000-8000-000000000001",
      category: "AUTOSAVE",
      message: `autosave-regresi: Draft belum tersimpan. ${"LaporanTanpaSpasi".repeat(20)}`,
      status: "OPEN",
      createdAt: timestamp,
      updatedAt: timestamp,
      user: {
        name: "Alyandranusantarakusumaningrumpratamawidjaja",
        email: "pelanggan.dengan.alamat.email.panjang@pengujian.example",
      },
      invitation: {
        title: "Alyandra Nusantara Kusumaningrum & Bimantara Kresna Adiputra Pramudita",
        slug: `undangan${"a".repeat(38)}`,
      },
    },
    {
      id: "20000000-0000-4000-8000-000000000002",
      category: "PHOTO",
      message: "Foto pengujian belum tampil pada pratinjau undangan.",
      status: "IN_REVIEW",
      createdAt: timestamp,
      updatedAt: timestamp,
      user: { name: "Pelanggan Pengujian", email: "foto@pengujian.example" },
      invitation: null,
    },
  ];
  const resolvedFeedback = [{
    ...activeFeedback[1],
    id: "20000000-0000-4000-8000-000000000003",
    message: "Laporan pengujian yang sudah selesai ditangani.",
    status: "RESOLVED",
  }];
  let resolvedMode: "hold" | "fail" | "success" = "hold";
  let releaseResolved: () => void = () => {};
  let signalResolvedStarted: () => void = () => {};
  let signalResolvedFinished: () => void = () => {};
  const resolvedGate = new Promise<void>((resolve) => { releaseResolved = resolve; });
  const resolvedStarted = new Promise<void>((resolve) => { signalResolvedStarted = resolve; });
  const resolvedFinished = new Promise<void>((resolve) => { signalResolvedFinished = resolve; });
  const queuePattern = "**/api/admin/editor-feedback?*";
  const queueRoute = async (route: Route) => {
    const request = route.request();
    if (request.method() !== "GET") {
      await route.continue();
      return;
    }
    if (new URL(request.url()).searchParams.get("view") !== "resolved") {
      await route.fulfill({ json: { feedback: activeFeedback } });
      return;
    }
    if (resolvedMode === "hold") {
      signalResolvedStarted();
      await resolvedGate;
      try {
        // An AbortController may cancel this request when the tab changes;
        // either cancellation or ignoring its late result must preserve active.
        await route.fulfill({ json: { feedback: resolvedFeedback } }).catch(() => undefined);
        const response = await request.response();
        await response?.finished();
      } finally {
        signalResolvedFinished();
      }
      return;
    }
    if (resolvedMode === "fail") {
      await route.fulfill({ status: 503, json: { error: "Antrean uji sementara tidak tersedia." } });
      return;
    }
    await route.fulfill({ json: { feedback: resolvedFeedback } });
  };

  await page.route(queuePattern, queueRoute);
  try {
    await page.goto("/admin/editor-feedback");
    await page.getByRole("button", { name: "Muat ulang laporan", exact: true }).click();
    const cards = page.locator(".admin-feedback-card");
    await expect(cards).toHaveCount(2);
    const search = page.getByLabel("Cari laporan", { exact: true });
    const category = page.getByLabel("Kategori laporan", { exact: true });
    await search.fill("autosave-regresi");
    await category.selectOption("AUTOSAVE");
    await expect(cards).toHaveCount(1);
    await expect(cards).toContainText(activeFeedback[0].message);
    await category.selectOption("PHOTO");
    await expect(cards).toHaveCount(0);
    await page.getByRole("button", { name: "Reset filter", exact: true }).click();
    await expect(search).toHaveValue("");
    await expect(category).toHaveValue("all");
    await expect(cards).toHaveCount(2);

    for (const width of [320, 390]) {
      await page.setViewportSize({ width, height: 844 });
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1);
      const firstCard = cards.filter({ hasText: "autosave-regresi" });
      for (const label of ["Tandai ditinjau", "Tandai selesai"]) {
        const action = firstCard.getByRole("button", { name: label, exact: true });
        await action.scrollIntoViewIfNeeded();
        const bounds = await action.boundingBox();
        if (!bounds) throw new Error("The feedback action must be visible.");
        expect(bounds.x).toBeGreaterThanOrEqual(-1);
        expect(bounds.x + bounds.width).toBeLessThanOrEqual(width + 1);
        await action.click({ trial: true });
      }
    }

    const activeTab = page.getByRole("button", { name: "Belum selesai", exact: true });
    const resolvedTab = page.getByRole("button", { name: "Selesai", exact: true });
    await resolvedTab.click();
    await resolvedStarted;
    await expect(page.getByRole("status").filter({ hasText: "Memuat antrean laporan…" })).toBeVisible();
    await expect(cards).toHaveCount(0);
    await activeTab.click();
    await expect(cards).toHaveCount(2);
    releaseResolved();
    await resolvedFinished;
    // Let any state update from the late response paint before checking that
    // the currently selected queue has kept its own records.
    await page.evaluate(() => new Promise<void>((resolve) => {
      requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
    }));
    await expect(activeTab).toHaveAttribute("aria-pressed", "true");
    await expect(cards).toHaveCount(2);
    await expect(page.getByText(resolvedFeedback[0].message, { exact: true })).toHaveCount(0);

    resolvedMode = "fail";
    await resolvedTab.click();
    await expect(page.getByRole("region", { name: "Riwayat selesai", exact: true }).getByRole("alert")).toContainText("Antrean uji sementara tidak tersedia.");
    await expect(cards).toHaveCount(0);
    await expect(resolvedTab).toHaveAttribute("aria-pressed", "true");
    resolvedMode = "success";
    await page.getByRole("button", { name: "Coba muat lagi", exact: true }).click();
    await expect(cards).toHaveCount(1);
    await expect(cards.locator(".status-pill")).toHaveText("Selesai");
    await expect(page.getByText(resolvedFeedback[0].message, { exact: true })).toBeVisible();
  } finally {
    releaseResolved();
    await page.unroute(queuePattern, queueRoute);
  }
});
