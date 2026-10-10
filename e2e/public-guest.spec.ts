import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const invitationId = "10000000-0000-4000-8000-000000000001";
const invitationSlug = "e2e-public-invite";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard(?:\/|$)/);
}

test("guest can RSVP, report an approved message, and content reviewers can moderate it", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const customerEmail = process.env.E2E_CUSTOMER_EMAIL;
  const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;
  const reviewerEmail = process.env.E2E_CONTENT_REVIEWER_EMAIL;
  const reviewerPassword = process.env.E2E_CONTENT_REVIEWER_PASSWORD;
  if (!customerEmail || !customerPassword || !reviewerEmail || !reviewerPassword) {
    test.skip(true, "Requires the disposable PostgreSQL fixture and seeded customer/content reviewer accounts.");
    return;
  }

  await signIn(page, customerEmail, customerPassword);
  const guestName = `Tamu ${randomUUID().slice(0, 8)}`;
  const guestResponse = await page.request.post(`/api/invitations/${invitationId}/guests`, { data: { names: [guestName] } });
  expect(guestResponse.status()).toBe(201);
  const guestBody = await guestResponse.json() as { guests: Array<{ token: string }> };
  const guestToken = guestBody.guests[0]?.token;
  if (!guestToken) throw new Error("The guest fixture did not receive a private RSVP token.");

  const response = await page.goto(`/${invitationSlug}?g=${encodeURIComponent(guestToken)}`);
  expect(response?.status()).toBe(200);
  await expect(page.locator(".public-hero-names")).toContainText("E2E Mempelai");
  const initialRsvpCountText = await page.locator(".rsvp-count").innerText();
  const initialRsvpCount = Number(initialRsvpCountText.match(/^\d+/)?.[0] ?? 0);
  const expectedRsvpCountText = `${initialRsvpCount + 1} tamu telah mengirim RSVP`;

  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${1 + Math.floor(Math.random() * 253)}` });
  await page.getByRole("button", { name: "Konfirmasi kehadiran" }).click();
  await expect(page.getByLabel("Undangan untuk")).toHaveValue(guestName);
  await page.getByLabel("Jumlah tamu yang hadir").selectOption("2");
  const rsvpResponsePromise = page.waitForResponse((candidate) =>
    candidate.url().endsWith(`/api/public/invitations/${invitationSlug}/rsvp`) && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Kirim konfirmasi" }).click();
  const firstRsvpResponse = await rsvpResponsePromise;
  expect(firstRsvpResponse.status()).toBe(201);
  expect(await firstRsvpResponse.json()).toMatchObject({ saved: true, created: true });
  await expect(page.getByRole("heading", { name: `Terima kasih, ${guestName}!` })).toBeVisible();
  await expect(page.locator(".rsvp-count")).toContainText(expectedRsvpCountText);
  await page.getByRole("button", { name: "Selesai" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Konfirmasi kehadiran" }).click();
  await page.getByRole("button", { name: "Mohon maaf berhalangan" }).click();
  const repeatedRsvpPromise = page.waitForResponse((candidate) =>
    candidate.url().endsWith(`/api/public/invitations/${invitationSlug}/rsvp`) && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Kirim konfirmasi" }).click();
  const repeatedRsvpResponse = await repeatedRsvpPromise;
  expect(repeatedRsvpResponse.status()).toBe(201);
  expect(await repeatedRsvpResponse.json()).toMatchObject({ saved: true, created: false });
  await expect(page.locator(".rsvp-count")).toContainText(expectedRsvpCountText);

  const guestbookMessage = `Semoga selalu bahagia ${randomUUID().slice(0, 8)}`;
  await page.getByLabel("Namamu").fill(guestName);
  await page.getByLabel("Ucapan", { exact: true }).fill(guestbookMessage);
  const guestbookResponsePromise = page.waitForResponse((candidate) =>
    candidate.url().endsWith(`/api/public/invitations/${invitationSlug}/guestbook`) && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Kirim ucapan" }).click();
  expect((await guestbookResponsePromise).status()).toBe(201);
  await expect(page.getByRole("status")).toContainText("menunggu persetujuan");

  await page.goto(`/dashboard/invitations/${invitationId}/guestbook`);
  const entry = page.locator(".guestbook-admin-entry").filter({ hasText: guestbookMessage });
  await expect(entry).toBeVisible();
  expect(await entry.locator(".status-pill").innerText()).toContain("Menunggu");

  const approvalResponsePromise = page.waitForResponse((candidate) =>
    candidate.url().includes(`/api/invitations/${invitationId}/guestbook/`) && candidate.request().method() === "PATCH",
  );
  await entry.getByRole("button", { name: "Setujui" }).click();
  expect((await approvalResponsePromise).status()).toBe(200);
  await expect(entry.locator(".status-pill")).toHaveText("Tampil");

  await page.goto(`/${invitationSlug}`);
  await expect(page.locator(".guestbook-entry").filter({ hasText: guestbookMessage })).toBeVisible();

  const messageEntry = page.locator(".guestbook-entry").filter({ hasText: guestbookMessage });
  await messageEntry.getByRole("button", { name: "Laporkan ucapan" }).click();
  await page.getByLabel("Alasan laporan").selectOption("PERSONAL_INFORMATION");
  const firstReportResponsePromise = page.waitForResponse((candidate) =>
    candidate.url().includes(`/api/public/invitations/${invitationSlug}/guestbook/`) && candidate.url().endsWith("/reports") && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Kirim laporan" }).click();
  expect((await firstReportResponsePromise).status()).toBe(201);
  await expect(messageEntry.getByRole("status")).toContainText("Laporan diterima");
  expect((await page.request.get("/api/admin/content-reports")).status()).toBe(403);

  const reviewerContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  try {
    const reviewerPage = await reviewerContext.newPage();
    await signIn(reviewerPage, reviewerEmail, reviewerPassword);
    await reviewerPage.goto("/admin/moderation");
    await expect(reviewerPage.getByRole("heading", { name: "Moderasi konten" })).toBeVisible();
    const reportsResponse = await reviewerPage.request.get("/api/admin/content-reports");
    expect(reportsResponse.status()).toBe(200);
    const reportsBody = await reportsResponse.json() as { reports: Array<Record<string, unknown>> };
    expect(reportsBody.reports.some((report) => JSON.stringify(report).includes(guestbookMessage))).toBe(true);
    expect(JSON.stringify(reportsBody)).not.toContain("reporterFingerprint");

    const reportCard = reviewerPage.locator(".admin-report-card").filter({ hasText: guestbookMessage });
    await expect(reportCard).toBeVisible();
    const hideResponsePromise = reviewerPage.waitForResponse((candidate) =>
      candidate.url().includes("/api/admin/content-reports/") && candidate.request().method() === "PATCH",
    );
    await reportCard.getByRole("button", { name: "Sembunyikan ucapan" }).click();
    expect((await hideResponsePromise).status()).toBe(200);
    await page.goto(`/${invitationSlug}`);
    await expect(page.locator(".guestbook-entry").filter({ hasText: guestbookMessage })).toHaveCount(0);
    await page.goto(`/dashboard/invitations/${invitationId}/guestbook`);
    const hiddenOwnerEntry = page.locator(".guestbook-admin-entry").filter({ hasText: guestbookMessage });
    await expect(hiddenOwnerEntry.locator(".status-pill")).toContainText("Disembunyikan admin");
    await expect(hiddenOwnerEntry.getByRole("button", { name: "Setujui" })).toHaveCount(0);
    const hiddenEntryId = await hiddenOwnerEntry.getAttribute("data-entry-id");
    if (!hiddenEntryId) throw new Error("The hidden guestbook entry did not expose its fixture ID.");
    const ownerReapproval = await page.request.patch(`/api/invitations/${invitationId}/guestbook/${hiddenEntryId}`, { data: { status: "APPROVED" } });
    expect(ownerReapproval.status()).toBe(409);

    await reviewerPage.getByRole("button", { name: "Riwayat 30 hari" }).click();
    const historyCard = reviewerPage.locator(".admin-report-card").filter({ hasText: guestbookMessage });
    await expect(historyCard).toBeVisible();
    const restoreResponsePromise = reviewerPage.waitForResponse((candidate) =>
      candidate.url().includes("/api/admin/content-reports/") && candidate.request().method() === "PATCH",
    );
    await historyCard.getByRole("button", { name: "Pulihkan ucapan" }).click();
    expect((await restoreResponsePromise).status()).toBe(200);
    await page.goto(`/${invitationSlug}`);
    await expect(page.locator(".guestbook-entry").filter({ hasText: guestbookMessage })).toBeVisible();

    const restoredEntry = page.locator(".guestbook-entry").filter({ hasText: guestbookMessage });
    await restoredEntry.getByRole("button", { name: "Laporkan ucapan" }).click();
    await page.getByLabel("Alasan laporan").selectOption("OTHER");
    const secondReportResponsePromise = page.waitForResponse((candidate) =>
      candidate.url().includes(`/api/public/invitations/${invitationSlug}/guestbook/`) && candidate.url().endsWith("/reports") && candidate.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    expect((await secondReportResponsePromise).status()).toBe(201);
    await reviewerPage.getByRole("button", { name: "Perlu ditinjau" }).click();
    const repeatedReportCard = reviewerPage.locator(".admin-report-card").filter({ hasText: guestbookMessage });
    const dismissResponsePromise = reviewerPage.waitForResponse((candidate) =>
      candidate.url().includes("/api/admin/content-reports/") && candidate.request().method() === "PATCH",
    );
    await repeatedReportCard.getByRole("button", { name: "Abaikan laporan" }).click();
    expect((await dismissResponsePromise).status()).toBe(200);
    await page.reload();
    await expect(page.locator(".guestbook-entry").filter({ hasText: guestbookMessage })).toBeVisible();
  } finally {
    await reviewerContext.close();
  }
});
