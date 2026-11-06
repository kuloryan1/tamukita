import { randomUUID } from "node:crypto";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { dashboardFixture, getDashboardFixtureCredentials } from "./dashboard-fixture";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL(/\/dashboard(?:\/|$)/);
}

async function expectNoHorizontalScrolling(page: Page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ))).toBeLessThanOrEqual(1);
}

async function expectActionFits(page: Page, action: Locator) {
  await expect(action).toBeVisible();
  await action.scrollIntoViewIfNeeded();
  const bounds = await action.boundingBox();
  const viewport = page.viewportSize();
  if (!bounds || !viewport) throw new Error("The invitation action must have visible bounds.");
  expect(bounds.x).toBeGreaterThanOrEqual(-1);
  expect(bounds.x + bounds.width).toBeLessThanOrEqual(viewport.width + 1);
  // Check that a real pointer can reach the action without following the link.
  await action.click({ trial: true });
}

test("dashboard searches and paginates owned invitations without clipping long mobile cards", async ({ page }) => {
  test.setTimeout(90_000);
  const customer = getDashboardFixtureCredentials();
  if (!customer.email || !customer.password || !process.env.DATABASE_URL || process.env.PLAYWRIGHT_TEST_BASE_URL) {
    test.skip(true, "Creates fixtures only against the local disposable E2E server.");
    return;
  }

  await signIn(page, customer.email, customer.password);
  const marker = `ui-${randomUUID().slice(0, 8)}`;
  const longHost = `${marker} Alyandranusantarakusumaningrumpratamawidjaja`;
  const partner = "Bimantara Kresna Adiputra Pramudita";
  let longInvitationId = "";

  // Thirteen matching records exercise a real second page, independently of
  // invitations created by other suites or the customer's seeded records.
  for (let index = 0; index < 13; index += 1) {
    const response = await page.request.post("/api/invitations/drafts", {
      data: {
        slug: `${marker}-${index}`,
        eventKind: "Pernikahan",
        eventTitle: "Undangan pengujian dashboard",
        hostOne: index === 12 ? longHost : `${marker} Mempelai ${index + 1}`,
        hostTwo: partner,
        eventDate: "2030-11-21",
        eventTime: "18:00",
        venue: "Gedung Pengujian Dashboard",
        address: "Jalan Pengujian Nomor 1, Surabaya, Jawa Timur",
        mapsUrl: "",
        story: "Undangan percobaan untuk memeriksa tata letak dashboard.",
        templateId: "royal-gold",
        templateVersion: "1.0.0",
        coverPhoto: "",
        coverPosition: 50,
      },
    });
    expect(response.status()).toBe(201);
    const result = await response.json() as { draft?: { id?: string } };
    expect(result.draft?.id).toMatch(/^[0-9a-f-]{36}$/i);
    if (index === 12) longInvitationId = result.draft?.id ?? "";
  }

  await page.goto("/dashboard#invitations");
  const invitations = page.locator("#invitations");
  const search = invitations.getByLabel("Cari undangan", { exact: true });
  const status = invitations.getByLabel("Status undangan", { exact: true });
  const apply = invitations.getByRole("button", { name: "Terapkan filter", exact: true });
  await search.fill(marker);
  await expect(status).toBeVisible();
  await status.selectOption("draft");
  await apply.click();
  await expect(invitations.locator(".invitation-row")).toHaveCount(12);
  await expect(search).toHaveValue(marker);
  await expect(status).toHaveValue("draft");
  expect(new URL(page.url()).hash).toBe("#invitations");
  const titles = await invitations.locator(".invitation-row").getByRole("heading").allTextContents();
  expect(titles.every((title) => title.includes(marker))).toBe(true);

  const longCard = invitations.locator(".invitation-row").filter({ hasText: longHost });
  await expect(longCard).toHaveCount(1);
  await expect(longCard.getByRole("heading")).toHaveText(`${longHost} & ${partner}`);
  const continueLink = longCard.getByRole("link", { name: "Lanjutkan", exact: true });
  const paparazziLink = longCard.getByRole("link", { name: "Paparazi", exact: true });
  await expect(continueLink).toHaveAttribute("href", `/dashboard/invitations/${longInvitationId}/edit`);
  await expect(paparazziLink).toHaveAttribute("href", `/dashboard/invitations/${longInvitationId}/paparazi`);
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoHorizontalScrolling(page);
    const titleOverflow = await longCard.getByRole("heading").evaluate((heading) => ({
      horizontal: heading.scrollWidth - heading.clientWidth,
      vertical: heading.scrollHeight - heading.clientHeight,
    }));
    expect(titleOverflow.horizontal).toBeLessThanOrEqual(1);
    expect(titleOverflow.vertical).toBeLessThanOrEqual(1);
    await expectActionFits(page, continueLink);
    await expectActionFits(page, paparazziLink);
    await expectActionFits(page, apply);
  }

  await invitations.getByRole("link", { name: "Halaman berikutnya", exact: true }).click();
  await expect(invitations.locator(".invitation-row")).toHaveCount(1);
  const secondPage = new URL(page.url());
  expect(secondPage.searchParams.get("q")).toBe(marker);
  expect(secondPage.searchParams.get("status")).toBe("draft");
  expect(secondPage.searchParams.get("page")).toBe("2");
  await expect(invitations.locator(".invitation-row")).toContainText(marker);
  await invitations.getByRole("link", { name: "Halaman sebelumnya", exact: true }).click();
  await expect(invitations.locator(".invitation-row")).toHaveCount(12);

  await status.selectOption("published");
  await apply.click();
  await expect(invitations.locator(".invitation-row")).toHaveCount(0);
  await expect(search).toHaveValue(marker);
  await invitations.locator("form").getByRole("link", { name: "Reset filter", exact: true }).click();
  await expect(search).toHaveValue("");
  await expect(status).toHaveValue("all");
  await expect(longCard).toBeVisible();
  expect(new URL(page.url()).searchParams.has("q")).toBe(false);
  expect(new URL(page.url()).searchParams.has("status")).toBe(false);
});

test("published invitation actions remain reachable at narrow phone widths", async ({ page }) => {
  const { email, password } = getDashboardFixtureCredentials();
  if (!email || !password) {
    test.skip(true, "Requires the dedicated dashboard customer and published invitation fixture.");
    return;
  }

  await signIn(page, email, password);
  await page.goto(`/dashboard?q=${dashboardFixture.slug}&status=published#invitations`);
  const card = page.locator("#invitations .invitation-row").filter({ hasText: dashboardFixture.slug });
  await expect(card).toHaveCount(1);
  await expect(card.locator(".status-pill")).toHaveText("Aktif");
  const invitationId = dashboardFixture.invitationId;
  const actions = [
    { label: "Edit", href: `/dashboard/invitations/${invitationId}/edit` },
    { label: "Lihat undangan", href: `/${dashboardFixture.slug}` },
    { label: "Tamu", href: `/dashboard/invitations/${invitationId}/guests` },
    { label: "Ucapan", href: `/dashboard/invitations/${invitationId}/guestbook` },
    { label: "Paparazi", href: `/dashboard/invitations/${invitationId}/paparazi` },
  ];
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 844 });
    await expectNoHorizontalScrolling(page);
    for (const { label, href } of actions) {
      const action = card.getByRole("link", { name: label, exact: true });
      await expect(action).toHaveAttribute("href", href);
      await expectActionFits(page, action);
    }
  }
});
