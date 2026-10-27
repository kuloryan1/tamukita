import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";

const invitationId = "10000000-0000-4000-8000-000000000001";
const invitationSlug = "e2e-public-invite";
const analyticsPool = process.env.DATABASE_URL ? (() => {
  const databaseUrl = new URL(process.env.DATABASE_URL);
  databaseUrl.searchParams.delete("schema");
  return new Pool({ connectionString: databaseUrl.toString() });
})() : null;

async function readInvitationViewCount(date: string) {
  if (!analyticsPool) throw new Error("The disposable E2E database is required.");
  const result = await analyticsPool.query<{ value: string }>(
    `SELECT COALESCE((
      SELECT "metricValue"
      FROM analytics_daily
      WHERE "organizationId" = (SELECT "organizationId" FROM invitations WHERE slug = $1)
        AND date = $2::date
        AND "metricKey" = 'invitation_views'
    ), 0)::text AS value`,
    [invitationSlug, date],
  );
  return Number(result.rows[0]?.value ?? "0");
}

async function readPlatformViewCount(metricKey: "template_catalog_views" | "template_detail_views" | "template_catalog_unique_visitors", date: string) {
  if (!analyticsPool) throw new Error("The disposable E2E database is required.");
  const result = await analyticsPool.query<{ value: string }>(
    `SELECT COALESCE((
      SELECT "metricValue"
      FROM platform_analytics_daily
      WHERE date = $1::date AND "metricKey" = $2
    ), 0)::text AS value`,
    [date, metricKey],
  );
  return Number(result.rows[0]?.value ?? "0");
}

async function readGuestbookModerationAuditActions(targetId: string) {
  if (!analyticsPool) throw new Error("The disposable E2E database is required.");
  const result = await analyticsPool.query<{ action: string }>(
    `SELECT action FROM audit_logs
     WHERE "targetType" = 'GuestbookEntry'
       AND "targetId" = $1
       AND action IN ('admin.content_report.hidden', 'admin.content_report.restored')
     ORDER BY "createdAt"`,
    [targetId],
  );
  return result.rows.map((row) => row.action);
}

async function readInvitationModerationAuditActions(targetId: string) {
  if (!analyticsPool) throw new Error("The disposable E2E database is required.");
  const result = await analyticsPool.query<{ action: string }>(
    `SELECT action FROM audit_logs
     WHERE "targetType" = 'Invitation'
       AND "targetId" = $1
       AND action IN ('admin.invitation_report.hidden', 'admin.invitation_report.restored')
     ORDER BY "createdAt"`,
    [targetId],
  );
  return result.rows.map((row) => row.action);
}

test.afterAll(async () => {
  await analyticsPool?.end();
});

test("RSVP dialog supports keyboard dismissal and keeps focus inside", async ({ page }) => {
  const response = await page.goto(`/${invitationSlug}`);
  expect(response?.status()).toBe(200);
  const trigger = page.getByRole("button", { name: "Konfirmasi kehadiran" });
  await trigger.focus();
  await page.keyboard.press("Enter");

  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page.getByLabel("Nama lengkap")).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Tutup" })).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(page.getByRole("button", { name: "Kirim konfirmasi" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Tutup" })).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard(?:\/|$)/);
}

test("public guest flows and marketplace page view metrics work, and content reviewers can moderate reports", async ({ page, browser, baseURL }) => {
  test.setTimeout(90_000);
  const customerEmail = process.env.E2E_CUSTOMER_EMAIL;
  const customerPassword = process.env.E2E_CUSTOMER_PASSWORD;
  const reviewerEmail = process.env.E2E_CONTENT_REVIEWER_EMAIL;
  const reviewerPassword = process.env.E2E_CONTENT_REVIEWER_PASSWORD;
  if (!customerEmail || !customerPassword || !reviewerEmail || !reviewerPassword || !analyticsPool) {
    test.skip(true, "Requires the disposable PostgreSQL fixture and seeded customer/content reviewer accounts.");
    return;
  }

  await signIn(page, customerEmail, customerPassword);
  const guestName = `Tamu ${randomUUID().slice(0, 8)}`;
  const guestResponse = await page.request.post(`/api/invitations/${invitationId}/guests`, { data: { names: [guestName] } });
  expect(guestResponse.status()).toBe(201);
  expect(guestResponse.headers()["cache-control"]).toBe("no-store");
  const guestBody = await guestResponse.json() as { guests: Array<{ token: string }> };
  const guestToken = guestBody.guests[0]?.token;
  if (!guestToken) throw new Error("The guest fixture did not receive a private RSVP token.");

  const metricDate = new Date().toISOString().slice(0, 10);
  const previousViewCount = await readInvitationViewCount(metricDate);
  const response = await page.goto(`/${invitationSlug}?g=${encodeURIComponent(guestToken)}`);
  expect(response?.status()).toBe(200);
  if (!baseURL) throw new Error("The E2E base URL is required to verify the invitation share link.");
  expect(response?.headers()["referrer-policy"]).toBe("no-referrer");
  expect(await page.locator('meta[property="og:url"]').getAttribute("content")).toBe(new URL(`/${invitationSlug}`, baseURL).toString());
  const pageMetadata = await page.locator("head").innerHTML();
  expect(pageMetadata).not.toContain(guestToken);
  expect(pageMetadata).not.toContain(guestName);
  const shareLink = await page.getByRole("link", { name: "Bagikan undangan ini" }).getAttribute("href");
  expect(shareLink).toBeTruthy();
  const shareText = new URL(shareLink as string).searchParams.get("text");
  expect(shareText).toContain(new URL(`/${invitationSlug}`, baseURL).toString());
  await expect.poll(() => readInvitationViewCount(metricDate), { timeout: 5_000 }).toBe(previousViewCount + 1);

  const previousMarketplaceVisitors = await readPlatformViewCount("template_catalog_unique_visitors", metricDate);
  const crossOriginVisit = await page.request.post("/api/analytics/marketplace-visit", {
    headers: { origin: "https://outside.example" },
    data: {},
  });
  expect(crossOriginVisit.status()).toBe(403);
  await expect.poll(() => readPlatformViewCount("template_catalog_unique_visitors", metricDate), { timeout: 5_000 }).toBe(previousMarketplaceVisitors);

  const previousCatalogViews = await readPlatformViewCount("template_catalog_views", metricDate);
  const uniqueVisitorResponsePromise = page.waitForResponse((candidate) =>
    candidate.url().endsWith("/api/analytics/marketplace-visit") && candidate.request().method() === "POST",
  );
  const catalogResponse = await page.goto("/templates");
  expect(catalogResponse?.status()).toBe(200);
  const uniqueVisitorResponse = await uniqueVisitorResponsePromise;
  expect(uniqueVisitorResponse.status()).toBe(204);
  const setCookieHeader = (await uniqueVisitorResponse.allHeaders())["set-cookie"]?.toLowerCase() ?? "";
  expect(setCookieHeader).toContain("httponly");
  expect(setCookieHeader).toContain("samesite=lax");
  expect(setCookieHeader).toContain("path=/api/analytics/marketplace-visit");
  await expect.poll(() => readPlatformViewCount("template_catalog_unique_visitors", metricDate), { timeout: 5_000 }).toBe(previousMarketplaceVisitors + 1);
  await expect.poll(() => readPlatformViewCount("template_catalog_views", metricDate), { timeout: 5_000 }).toBe(previousCatalogViews + 1);
  const visitorCookie = (await page.context().cookies()).find((cookie) => cookie.name === "tk_marketplace_seen_day");
  expect(visitorCookie).toMatchObject({ httpOnly: true, path: "/api/analytics/marketplace-visit" });
  const repeatedUniqueVisitorResponsePromise = page.waitForResponse((candidate) =>
    candidate.url().endsWith("/api/analytics/marketplace-visit") && candidate.request().method() === "POST",
  );
  await page.reload();
  expect((await repeatedUniqueVisitorResponsePromise).status()).toBe(204);
  await expect.poll(() => readPlatformViewCount("template_catalog_unique_visitors", metricDate), { timeout: 5_000 }).toBe(previousMarketplaceVisitors + 1);

  const templateDetailPath = await page.locator(".template-card-art").first().getAttribute("href");
  if (!templateDetailPath?.startsWith("/templates/")) throw new Error("The published catalog did not render a template detail link.");
  const previousTemplateDetailViews = await readPlatformViewCount("template_detail_views", metricDate);
  const templateDetailResponse = await page.goto(templateDetailPath);
  expect(templateDetailResponse?.status()).toBe(200);
  await expect.poll(() => readPlatformViewCount("template_detail_views", metricDate), { timeout: 5_000 }).toBe(previousTemplateDetailViews + 1);

  await page.goto(`/${invitationSlug}?g=${encodeURIComponent(guestToken)}`);
  await expect(page.locator(".public-hero-names")).toContainText("E2E Mempelai");
  const initialRsvpCountText = await page.locator(".rsvp-count").innerText();
  const initialRsvpCount = Number(initialRsvpCountText.match(/^\d+/)?.[0] ?? 0);
  const expectedRsvpCountText = `${initialRsvpCount + 1} tamu telah mengirim RSVP`;

  await page.setExtraHTTPHeaders({ "x-forwarded-for": `198.51.100.${1 + Math.floor(Math.random() * 253)}` });
  const childRsvpWithoutGuardianConsent = await page.request.post(`/api/public/invitations/${invitationSlug}/rsvp`, {
    data: { guestToken, attendance: "ATTENDING", attendeeCount: 1, includesChildData: true },
  });
  expect(childRsvpWithoutGuardianConsent.status()).toBe(400);
  await page.getByRole("button", { name: "Konfirmasi kehadiran" }).click();
  await expect(page.locator(".rsvp-modal-intro")).toContainText("diterima oleh pemilik undangan");
  await expect(page.getByRole("group", { name: "Pilih kehadiran" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Dengan senang hati hadir" })).toHaveAttribute("aria-pressed", "true");
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
  await expect(page.locator(".rsvp-confirmation p")).toHaveText("Jawabanmu sudah dicatat untuk undangan ini. Terima kasih sudah memberi kabar.");
  await expect(page.locator(".rsvp-count")).toContainText(expectedRsvpCountText);
  await page.getByRole("button", { name: "Selesai" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.getByRole("button", { name: "Konfirmasi kehadiran" }).click();
  await page.getByRole("button", { name: "Mohon maaf berhalangan" }).click();
  await expect(page.getByRole("button", { name: "Mohon maaf berhalangan" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("button", { name: "Dengan senang hati hadir" })).toHaveAttribute("aria-pressed", "false");
  await expect(page.getByText("TERIMA KASIH SUDAH MEMBERI KABAR", { exact: true })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Kami mengerti kamu berhalangan hadir" })).toBeVisible();
  await expect(page.getByLabel("Jumlah tamu yang hadir")).toHaveCount(0);
  let childRsvpBrowserRequests = 0;
  await page.route(`**/api/public/invitations/${invitationSlug}/rsvp`, async (route) => {
    childRsvpBrowserRequests += 1;
    await route.continue();
  });
  await page.getByRole("checkbox", { name: "RSVP ini mencantumkan nama atau informasi anak." }).check();
  await page.getByRole("button", { name: "Kirim konfirmasi" }).click();
  await expect(page.locator('.editor-error[role="alert"]')).toHaveText("Persetujuan orang tua/wali wajib sebelum mengirim data anak.");
  expect(childRsvpBrowserRequests).toBe(0);
  await page.getByRole("checkbox", { name: /Saya orang tua\/wali yang berwenang/ }).check();
  const repeatedRsvpPromise = page.waitForResponse((candidate) =>
    candidate.url().endsWith(`/api/public/invitations/${invitationSlug}/rsvp`) && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Kirim konfirmasi" }).click();
  const repeatedRsvpResponse = await repeatedRsvpPromise;
  expect(childRsvpBrowserRequests).toBe(1);
  expect(repeatedRsvpResponse.status()).toBe(201);
  expect(await repeatedRsvpResponse.json()).toMatchObject({ saved: true, created: false });
  await expect(page.locator(".rsvp-confirmation p")).toHaveText("Jawabanmu sudah dicatat untuk undangan ini. Terima kasih sudah memberi kabar.");
  const rsvpConsent = await analyticsPool.query<{ includesChildData: boolean; guardianConsentAt: Date | null; guardianConsentVersion: string | null }>(
    'SELECT "includesChildData", "guardianConsentAt", "guardianConsentVersion" FROM rsvps WHERE "invitationId" = $1 AND "displayName" = $2',
    [invitationId, guestName],
  );
  expect(rsvpConsent.rows).toHaveLength(1);
  expect(rsvpConsent.rows[0]).toMatchObject({ includesChildData: true, guardianConsentVersion: "child-rsvp-guardian-2026-10-v1" });
  expect(rsvpConsent.rows[0]?.guardianConsentAt).toBeInstanceOf(Date);
  await expect(page.locator(".rsvp-count")).toContainText(expectedRsvpCountText);
  await page.getByRole("button", { name: "Selesai" }).click();
  await expect(page.getByRole("dialog")).toBeHidden();

  await page.goto(`/dashboard/invitations/${invitationId}/guests`);
  const guestRow = page.locator(".guest-list-card").first().locator(".guest-list-row").filter({ hasText: guestName });
  await expect(guestRow).toContainText("Berhalangan");
  page.once("dialog", (dialog) => dialog.accept());
  const revokeResponsePromise = page.waitForResponse((candidate) =>
    candidate.url().includes(`/api/invitations/${invitationId}/guests/`) && candidate.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: `Cabut tautan untuk ${guestName}` }).click();
  const revokeResponse = await revokeResponsePromise;
  expect(revokeResponse.status()).toBe(200);
  await expect(guestRow).toContainText("Tautan dicabut");
  await expect(guestRow).toContainText("Berhalangan");

  const revokedLinkResponse = await page.goto(`/${invitationSlug}?g=${encodeURIComponent(guestToken)}`);
  expect(revokedLinkResponse?.status()).toBe(200);
  await expect(page.locator(".public-hero-side h1")).toContainText("Anda");
  const revokedTokenRsvp = await page.request.post(`/api/public/invitations/${invitationSlug}/rsvp`, {
    data: { guestToken, attendance: "ATTENDING", attendeeCount: 1 },
  });
  expect(revokedTokenRsvp.status()).toBe(403);

  await page.goto(`/dashboard/invitations/${invitationId}/guests`);
  const rotateResponsePromise = page.waitForResponse((candidate) =>
    candidate.url().includes(`/api/invitations/${invitationId}/guests/`) && candidate.request().method() === "PATCH",
  );
  await page.getByRole("button", { name: `Buat tautan baru untuk ${guestName}` }).click();
  const rotateResponse = await rotateResponsePromise;
  expect(rotateResponse.status()).toBe(200);
  expect(rotateResponse.headers()["cache-control"]).toBe("no-store");
  const rotatedBody = await rotateResponse.json() as { token: string };
  expect(rotatedBody.token).toBeTruthy();
  expect(rotatedBody.token).not.toBe(guestToken);
  await expect(page.locator(".guest-list-card").first().locator(".guest-list-row").filter({ hasText: guestName })).toContainText("Tautan aktif");
  await page.goto(`/${invitationSlug}?g=${encodeURIComponent(rotatedBody.token)}`);
  await expect(page.locator(".public-hero-side h1")).toContainText(guestName);

  const guestbookMessage = `Semoga selalu bahagia ${randomUUID().slice(0, 8)}`;
  const childGuestbookWithoutGuardianConsent = await page.request.post(`/api/public/invitations/${invitationSlug}/guestbook`, {
    data: { name: guestName, message: guestbookMessage, includesChildData: true },
  });
  expect(childGuestbookWithoutGuardianConsent.status()).toBe(400);
  await expect(page.locator(".guestbook-heading")).toContainText("diterima oleh pemilik undangan");
  let guestbookBrowserRequests = 0;
  await page.route(`**/api/public/invitations/${invitationSlug}/guestbook`, async (route) => {
    guestbookBrowserRequests += 1;
    await route.continue();
  });
  await page.getByRole("button", { name: "Kirim ucapan" }).click();
  await expect(page.locator('.editor-error[role="alert"]')).toHaveText("Namamu wajib diisi.");
  expect(guestbookBrowserRequests).toBe(0);
  await page.getByLabel("Namamu").fill(guestName);
  await page.getByLabel("Ucapan", { exact: true }).fill(guestbookMessage);
  await page.getByRole("checkbox", { name: "Ucapan ini mencantumkan nama atau informasi anak." }).check();
  await page.getByRole("button", { name: "Kirim ucapan" }).click();
  await expect(page.locator('.editor-error[role="alert"]')).toHaveText("Persetujuan orang tua/wali wajib sebelum mengirim data anak.");
  expect(guestbookBrowserRequests).toBe(0);
  await page.getByRole("checkbox", { name: /Saya orang tua\/wali yang berwenang/ }).check();
  const guestbookResponsePromise = page.waitForResponse((candidate) =>
    candidate.url().endsWith(`/api/public/invitations/${invitationSlug}/guestbook`) && candidate.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Kirim ucapan" }).click();
  expect((await guestbookResponsePromise).status()).toBe(201);
  expect(guestbookBrowserRequests).toBe(1);
  const guestbookConsent = await analyticsPool.query<{ includesChildData: boolean; guardianConsentAt: Date | null; guardianConsentVersion: string | null }>(
    'SELECT "includesChildData", "guardianConsentAt", "guardianConsentVersion" FROM guestbook WHERE "invitationId" = $1 AND message = $2',
    [invitationId, guestbookMessage],
  );
  expect(guestbookConsent.rows).toHaveLength(1);
  expect(guestbookConsent.rows[0]).toMatchObject({ includesChildData: true, guardianConsentVersion: "child-guestbook-guardian-2026-10-v1" });
  expect(guestbookConsent.rows[0]?.guardianConsentAt).toBeInstanceOf(Date);
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
    expect(await readGuestbookModerationAuditActions(hiddenEntryId)).toContain("admin.content_report.hidden");
    const ownerReapproval = await page.request.patch(`/api/invitations/${invitationId}/guestbook/${hiddenEntryId}`, { data: { status: "APPROVED" } });
    expect(ownerReapproval.status()).toBe(409);

    const guestbookModeration = reviewerPage.locator(".admin-content-moderation").first();
    await guestbookModeration.getByRole("button", { name: "Riwayat 30 hari" }).click();
    const historyCard = reviewerPage.locator(".admin-report-card").filter({ hasText: guestbookMessage });
    await expect(historyCard).toBeVisible();
    const restoreResponsePromise = reviewerPage.waitForResponse((candidate) =>
      candidate.url().includes("/api/admin/content-reports/") && candidate.request().method() === "PATCH",
    );
    await historyCard.getByRole("button", { name: "Pulihkan ucapan" }).click();
    expect((await restoreResponsePromise).status()).toBe(200);
    expect(await readGuestbookModerationAuditActions(hiddenEntryId)).toContain("admin.content_report.restored");
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
    await guestbookModeration.getByRole("button", { name: "Perlu ditinjau" }).click();
    const repeatedReportCard = reviewerPage.locator(".admin-report-card").filter({ hasText: guestbookMessage });
    const dismissResponsePromise = reviewerPage.waitForResponse((candidate) =>
      candidate.url().includes("/api/admin/content-reports/") && candidate.request().method() === "PATCH",
    );
    await repeatedReportCard.getByRole("button", { name: "Abaikan laporan" }).click();
    expect((await dismissResponsePromise).status()).toBe(200);
    await page.reload();
    await expect(page.locator(".guestbook-entry").filter({ hasText: guestbookMessage })).toBeVisible();

    await page.getByRole("button", { name: "Laporkan undangan" }).click();
    const publicReportForm = page.locator(".public-invitation-report-form");
    await expect(publicReportForm).toBeVisible();
    await page.getByLabel("Alasan laporan").selectOption("PERSONAL_INFORMATION");
    await page.getByRole("button", { name: "Batal" }).click();
    await expect(publicReportForm).toBeHidden();
    await page.getByRole("button", { name: "Laporkan undangan" }).click();
    await expect(page.getByLabel("Alasan laporan")).toHaveValue("PERSONAL_INFORMATION");
    const invitationReportPromise = page.waitForResponse((candidate) =>
      candidate.url().endsWith(`/api/public/invitations/${invitationSlug}/reports`) && candidate.request().method() === "POST",
    );
    await page.getByRole("button", { name: "Kirim laporan" }).click();
    expect((await invitationReportPromise).status()).toBe(201);
    await expect(page.locator(".public-invitation-report [role='status']")).toContainText("Laporan diterima untuk ditinjau");
    expect((await page.request.get("/api/admin/invitation-reports")).status()).toBe(403);

    const invitationReportsResponse = await reviewerPage.request.get("/api/admin/invitation-reports");
    expect(invitationReportsResponse.status()).toBe(200);
    const invitationReportsBody = await invitationReportsResponse.json() as { reports: Array<Record<string, unknown>> };
    expect(invitationReportsBody.reports.some((report) => JSON.stringify(report).includes(invitationSlug))).toBe(true);
    expect(JSON.stringify(invitationReportsBody)).not.toContain("reporterFingerprint");
    const invitationModeration = reviewerPage.locator(".admin-content-moderation").nth(1);
    await invitationModeration.getByRole("button", { name: "Perlu ditinjau" }).click();
    const invitationReportCard = reviewerPage.locator(".admin-report-card").filter({ hasText: invitationSlug });
    await expect(invitationReportCard).toBeVisible();
    const suspendResponsePromise = reviewerPage.waitForResponse((candidate) =>
      candidate.url().includes("/api/admin/invitation-reports/") && candidate.request().method() === "PATCH",
    );
    reviewerPage.once("dialog", (dialog) => dialog.accept());
    await invitationReportCard.getByRole("button", { name: "Tangguhkan halaman" }).click();
    expect((await suspendResponsePromise).status()).toBe(200);
    expect(await readInvitationModerationAuditActions(invitationId)).toContain("admin.invitation_report.hidden");
    expect((await page.goto(`/${invitationSlug}`))?.status()).toBe(404);

    await invitationModeration.getByRole("button", { name: "Riwayat 30 hari" }).click();
    const hiddenInvitationCard = invitationModeration.locator(".admin-report-card").filter({ hasText: invitationSlug });
    await expect(hiddenInvitationCard).toContainText("Halaman ditangguhkan");
    const restoreInvitationPromise = reviewerPage.waitForResponse((candidate) =>
      candidate.url().includes("/api/admin/invitation-reports/") && candidate.request().method() === "PATCH",
    );
    await hiddenInvitationCard.getByRole("button", { name: "Pulihkan undangan" }).click();
    expect((await restoreInvitationPromise).status()).toBe(200);
    expect(await readInvitationModerationAuditActions(invitationId)).toContain("admin.invitation_report.restored");
    expect((await page.goto(`/${invitationSlug}`))?.status()).toBe(200);
  } finally {
    await reviewerContext.close();
  }
});
