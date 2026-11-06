import { expect, test, type Page } from "@playwright/test";

const templateSlugs = [
  "royal-gold", "elegant-cream", "modern-sage", "blush-serenade",
  "ivory-heritage", "wisteria-senja", "destinasi-cinta", "taman-abadi",
] as const;
const openingAssets: Record<typeof templateSlugs[number], { video: string; poster: string }> = {
  "royal-gold": { video: "/templates/reference-prototypes/ivory-envelope.mp4", poster: "/templates/reference-prototypes/royal-envelope-frame.png" },
  "elegant-cream": { video: "/templates/reference-prototypes/cream-envelope.mp4", poster: "/templates/reference-prototypes/cream-envelope-poster.jpg" },
  "modern-sage": { video: "/templates/reference-prototypes/cream-envelope.mp4", poster: "/templates/reference-prototypes/cream-envelope-poster.jpg" },
  "blush-serenade": { video: "/templates/reference-prototypes/blush-envelope.mp4", poster: "/templates/reference-prototypes/blush-envelope-poster.jpg" },
  "ivory-heritage": { video: "/templates/reference-prototypes/ivory-envelope.mp4", poster: "/templates/reference-prototypes/ivory-poster.jpg" },
  "wisteria-senja": { video: "/templates/reference-prototypes/wisteria-envelope.mp4", poster: "/templates/reference-prototypes/wisteria-envelope-poster.jpg" },
  "destinasi-cinta": { video: "/templates/reference-prototypes/boarding-envelope.mp4", poster: "/templates/reference-prototypes/boarding-passport-cover-id.png" },
  "taman-abadi": { video: "/templates/taman-abadi-envelope-opening.mp4", poster: "/templates/taman-abadi-envelope-cover.png" },
};
const introVariants = ["royal-gold", "taman-abadi"] as const;
const invitationMessage = "Dengan penuh syukur, kami mengundang Anda untuk merayakan hari istimewa ini bersama.";
const storageKey = "tamukita:stationery-demo:rsvp:v1:royal-gold";

function stationery(page: Page) {
  return page.locator('.stationery-demo[data-invitation-publication="demo"]');
}

async function expectNoHorizontalScrolling(page: Page) {
  await expect.poll(() => page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ))).toBeLessThanOrEqual(1);
}

async function controlOpeningPlayback(page: Page) {
  // Record the real intro's play request without advancing the clip. Tests
  // deliver its terminal event so assertions do not race the video duration.
  await page.addInitScript(() => {
    const playback = Object.assign(window, { __stationeryPlayRequests: [] as string[], __stationeryRejectPlayback: false });
    HTMLMediaElement.prototype.play = function (this: HTMLMediaElement) {
      playback.__stationeryPlayRequests.push(this.getAttribute("src") ?? "");
      if (playback.__stationeryRejectPlayback) return Promise.reject(new DOMException("Playback blocked for this regression test.", "NotAllowedError"));
      this.dispatchEvent(new Event("playing"));
      return Promise.resolve();
    };
  });
}

async function openingPlayRequests(page: Page) {
  return page.evaluate(() => Reflect.get(window, "__stationeryPlayRequests") as string[]);
}

async function blockAndRecordWrites(page: Page) {
  const attempts: string[] = [];
  // A regression must fail without actually posting a tester's data anywhere.
  await page.route("**/*", async (route) => {
    const request = route.request();
    if (["POST", "PUT", "PATCH", "DELETE"].includes(request.method())) {
      attempts.push(`${request.method()} ${new URL(request.url()).pathname}`);
      await route.fulfill({
        status: 409,
        contentType: "application/json",
        body: JSON.stringify({ error: "A demo test attempted a server write." }),
      });
      return;
    }
    await route.continue();
  });
  return attempts;
}

test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});

for (const slug of templateSlugs) {
  test(`${slug} keeps its original opening animation and the supplied wedding details`, async ({ page }) => {
    await page.emulateMedia({ reducedMotion: "no-preference" });
    await controlOpeningPlayback(page);
    const response = await page.goto(`/templates/${slug}/demo`);
    expect(response?.status()).toBe(200);
    const demo = stationery(page);
    await expect(demo).toHaveAttribute("data-template", slug);
    await expect(demo.locator(".cover-names")).toContainText("Ryan Pratam");
    await expect(demo.locator(".cover-names")).toContainText("Dwi Wulan Maulida");
    await expect(demo.locator(".cover-date")).toContainText("Sabtu, 21 November 2026");
    await expect(demo.locator(".recipient strong")).toHaveText("Anda");

    await demo.getByRole("button", { name: "Buka undangan", exact: true }).click();
    const intro = page.getByRole("dialog", { name: "Sampul undangan", exact: true });
    await expect(intro).toBeVisible();
    await expect(intro.locator("video")).toHaveAttribute("src", openingAssets[slug].video);
    await expect(intro.locator("video")).toHaveAttribute("poster", openingAssets[slug].poster);
    await expect.poll(() => openingPlayRequests(page)).toEqual([openingAssets[slug].video]);
    await intro.getByRole("button", { name: "Lewati animasi", exact: true }).click();
    await expect(intro).toHaveCount(0);
    await expect(demo.getByRole("heading", {
      level: 1, name: /Dengan penuh sukacita,\s*kami mengundang Anda\./,
    })).toBeVisible();
    await expect(demo.locator(".hero-names")).toContainText("Ryan Pratam");
    await expect(demo.locator(".hero-names")).toContainText("Dwi Wulan Maulida");
    await expect(demo.locator(".invitation-message")).toHaveText(invitationMessage);
    await expect(demo.locator(".hero-date")).toContainText("Sabtu, 21 November 2026");
    await expect(demo.locator(".hero-date")).toContainText("18:00 WIB");

    await demo.getByRole("link", { name: "LIHAT DETAIL ACARA" }).click();
    await expect(page).toHaveURL(/#detail-acara$/);
    const details = demo.locator("#detail-acara");
    await expect(details).toBeInViewport({ ratio: 0.1 });
    await expect(details.getByRole("heading", { name: "Gedung Pariwisata Surabaya" })).toBeVisible();
    await expect(details).toContainText("Surabaya, Jawa Timur");
    await expect(details).toContainText("18:00 WIB");
    await expect(demo.locator('#konfirmasi[data-demo-rsvp="local-only"]')).toBeAttached();
    await expectNoHorizontalScrolling(page);
  });
}

test("Royal and Garden opening videos start and reveal the invitation within twelve seconds", async ({ page, browserName }) => {
  test.setTimeout(40_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  // Observe native media events only: no play override, synthetic event,
  // response interception, or fake clock is used by this delivery smoke test.
  await page.addInitScript(() => {
    const playback = { src: "", currentTime: 0, readyState: 0, advanced: false, ended: false, error: null as { code: number; message: string } | null };
    Object.assign(window, { __stationeryRealPlayback: playback });
    const observe = (event: Event) => {
      const video = event.target;
      if (!event.isTrusted || !(video instanceof HTMLVideoElement)) return;
      playback.src = video.getAttribute("src") ?? "";
      playback.currentTime = Math.max(playback.currentTime, video.currentTime);
      playback.readyState = video.readyState;
      if (event.type === "timeupdate" && !video.ended && video.currentTime > 0.1) playback.advanced = true;
      if (video.error) playback.error = { code: video.error.code, message: video.error.message };
      if (event.type === "ended") playback.ended = true;
    };
    for (const event of ["playing", "timeupdate", "ended", "error"]) document.addEventListener(event, observe, true);
  });

  for (const slug of introVariants) {
    await test.step(`${slug}: native playback or stall recovery completes before the fallback deadline`, async () => {
      await page.goto(`/templates/${slug}/demo`);
      const demo = stationery(page);
      const startedAt = Date.now();
      const remaining = () => Math.max(1, 12_000 - (Date.now() - startedAt));
      await demo.getByRole("button", { name: "Buka undangan", exact: true }).click();
      // Chromium normally delivers the native ended event. On WebKit some
      // valid MP4 decoders start playback but stall without error; the
      // six-second progress watchdog should then finish the normal crossfade.
      await expect.poll(() => page.evaluate(() => {
        return Reflect.get(window, "__stationeryRealPlayback") as { src: string; currentTime: number; readyState: number; advanced: boolean; ended: boolean; error: { code: number; message: string } | null };
      }), { timeout: remaining(), message: `${slug} must start its real opening video` }).toMatchObject({
        src: openingAssets[slug].video, advanced: true, error: null,
        ...(browserName === "webkit" ? {} : { ended: true }),
      });
      await expect(page.getByRole("dialog", { name: "Sampul undangan", exact: true })).toHaveCount(0, { timeout: remaining() });
      await expect(demo.locator(".opened-invitation")).toBeFocused({ timeout: remaining() });
      expect(Date.now() - startedAt, "Opening must finish before the 14–15 second safety fallback").toBeLessThanOrEqual(12_000);
    });
  }
});

test("both opening variants complete, replay, and recover from media errors or stalled playback", async ({ page }) => {
  test.setTimeout(90_000);
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await controlOpeningPlayback(page);
  await page.clock.install();

  for (const slug of introVariants) {
    for (const completion of ["ended", "error", "timeout", "reduced-motion", "rejected"] as const) {
      await page.emulateMedia({ reducedMotion: "no-preference" });
      await page.goto(`/templates/${slug}/demo`);
      const demo = stationery(page);
      const initialOverflow = await page.evaluate(() => document.documentElement.style.overflow);
      if (completion === "rejected") {
        await page.evaluate(() => Reflect.set(window, "__stationeryRejectPlayback", true));
      }
      await demo.getByRole("button", { name: "Buka undangan", exact: true }).click();
      const intro = page.getByRole("dialog", { name: "Sampul undangan", exact: true });
      await expect.poll(() => openingPlayRequests(page)).toEqual([openingAssets[slug].video]);
      if (completion !== "rejected") {
        const skip = intro.getByRole("button", { name: "Lewati animasi", exact: true });
        await expect(skip).toBeVisible();
        await expect(skip).toBeFocused();
        await page.keyboard.press("Tab");
        await expect(skip).toBeFocused();
      }

      if (completion === "timeout") {
        // The video has emitted playing, but never ends: its deadline must
        // remain active so a stalled network cannot trap guests on the cover.
        await page.clock.fastForward(20_000);
      } else if (completion === "reduced-motion") {
        await page.emulateMedia({ reducedMotion: "reduce" });
      } else if (completion !== "rejected") {
        await intro.locator("video").dispatchEvent(completion);
      }
      await expect(intro).toHaveCount(0);
      await expect(demo.locator(".opened-invitation")).toBeFocused();
      await expect(demo.locator(".hero-names")).toContainText("Ryan Pratam");
      await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe(initialOverflow);

      if (completion === "ended") {
        await demo.getByRole("button", { name: "Lihat sampul", exact: true }).click();
        await demo.getByRole("button", { name: "Buka undangan", exact: true }).click();
        await expect(intro).toBeVisible();
        await expect.poll(() => openingPlayRequests(page)).toEqual([openingAssets[slug].video, openingAssets[slug].video]);
        await page.keyboard.press("Escape");
        await expect(intro).toHaveCount(0);
        await expect(demo.locator(".opened-invitation")).toBeFocused();
        await expect.poll(() => page.evaluate(() => document.documentElement.style.overflow)).toBe(initialOverflow);
      }
    }
  }
});

test("reduced motion opens both default intro variants without starting media", async ({ page }) => {
  await controlOpeningPlayback(page);
  for (const slug of introVariants) {
    await page.goto(`/templates/${slug}/demo`);
    const demo = stationery(page);
    await demo.getByRole("button", { name: "Buka undangan", exact: true }).click();
    await expect(demo.locator(".opened-invitation")).toBeFocused();
    await expect(page.getByRole("dialog", { name: "Sampul undangan", exact: true })).toHaveCount(0);
    expect(await openingPlayRequests(page)).toEqual([]);
  }
});

test("direct section links and browser Back reveal their targets after reopening the cover", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "no-preference" });
  await page.goto("/templates/modern-sage/demo#detail-acara");
  const demo = stationery(page);
  await expect(demo.locator("#detail-acara")).toBeInViewport({ ratio: 0.1 });
  await expect(demo.getByRole("button", { name: "Buka undangan", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Sampul undangan", exact: true })).toHaveCount(0);

  const navigation = demo.getByRole("navigation", { name: "Navigasi undangan" });
  await navigation.getByRole("link", { name: "Undangan", exact: true }).click();
  await navigation.getByRole("link", { name: "Acara", exact: true }).click();
  await navigation.getByRole("link", { name: "Kehadiran", exact: true }).click();
  await expect(page).toHaveURL(/#konfirmasi$/);
  await demo.getByRole("button", { name: "Lihat sampul", exact: true }).click();
  await expect(demo.getByRole("button", { name: "Buka undangan", exact: true })).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/#detail-acara$/);
  await expect(demo.locator("#detail-acara")).toBeInViewport({ ratio: 0.1 });
  await expect(demo.getByRole("button", { name: "Buka undangan", exact: true })).toHaveCount(0);
  await expect(page.getByRole("dialog", { name: "Sampul undangan", exact: true })).toHaveCount(0);
});

test("recipient text stays literal and survives sharing and switching templates with Unicode", async ({ page }) => {
  const recipient = "Ayu <b>Istimewa</b> & Budi 💌";
  await page.goto(`/templates/royal-gold/demo?to=${encodeURIComponent(recipient)}`);
  await expect(stationery(page).locator(".recipient strong")).toHaveText(recipient);
  await expect(stationery(page).locator(".recipient strong b")).toHaveCount(0);

  await stationery(page).getByRole("button", { name: "Bagikan undangan", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  const originalShareUrl = new URL(await dialog.getByLabel("Tautan demo undangan").inputValue());
  expect(originalShareUrl.searchParams.get("to")).toBe(recipient);

  const boundaryName = `${"A".repeat(99)}💌`;
  await dialog.getByLabel("Nama penerima", { exact: true }).fill(boundaryName);
  await expect.poll(async () => new URL(await dialog.getByLabel("Tautan demo undangan").inputValue()).searchParams.get("to")).toBe(boundaryName);
  const personalizedUrl = await dialog.getByLabel("Tautan demo undangan").inputValue();
  expect(new URL(personalizedUrl).searchParams.get("to")).toBe(boundaryName);
  await page.goto(personalizedUrl);
  await expect(stationery(page).locator(".recipient strong")).toHaveText(boundaryName);

  const catalogHref = await stationery(page).getByRole("link", { name: "Semua template" }).getAttribute("href");
  expect(new URL(catalogHref ?? "", page.url()).searchParams.get("to")).toBe(boundaryName);
  await stationery(page).getByRole("combobox", { name: "Pilih template undangan" }).selectOption("wisteria-senja");
  await expect(stationery(page)).toHaveAttribute("data-template", "wisteria-senja");
  expect(new URL(page.url()).searchParams.get("to")).toBe(boundaryName);
  await expect(stationery(page).locator(".recipient strong")).toHaveText(boundaryName);

  await page.setViewportSize({ width: 320, height: 740 });
  await expectNoHorizontalScrolling(page);
});

test("the marketplace demo action uses the default stationery route", async ({ page }) => {
  await page.goto("/templates/royal-gold");
  const link = page.getByRole("link", { name: "Buka demo undangan", exact: true });
  const destination = new URL((await link.getAttribute("href")) ?? "", page.url());
  expect(destination.pathname).toBe("/templates/royal-gold/demo");
  expect(destination.searchParams.has("design")).toBe(false);
  await link.click();
  await expect(stationery(page)).toHaveAttribute("data-template", "royal-gold");
  await expect(stationery(page).getByRole("button", { name: "Buka undangan", exact: true })).toBeVisible();
});

test("an unknown template returns 404 instead of silently rendering another demo", async ({ page }) => {
  const response = await page.goto("/templates/stationery-nonexistent-template/demo");
  expect(response?.status()).toBe(404);
  await expect(stationery(page)).toHaveCount(0);
});

test("the map points to the supplied venue and the calendar link serves the correct event", async ({ page }) => {
  await page.goto("/templates/royal-gold/demo#detail-acara");
  const details = stationery(page).locator("#detail-acara");
  const map = details.getByRole("link", { name: "Buka peta" });
  const mapUrl = new URL((await map.getAttribute("href")) ?? "");
  expect(mapUrl.protocol).toBe("https:");
  expect(mapUrl.hostname).toBe("www.google.com");
  expect(mapUrl.searchParams.get("query")).toBe("Gedung Pariwisata Surabaya, Surabaya, Jawa Timur");

  const calendarLink = details.getByRole("link", { name: "Simpan ke kalender" });
  await expect(calendarLink).toHaveAttribute("download", "Ryan-Dwi-21-November-2026.ics");
  const calendarHref = await calendarLink.getAttribute("href");
  expect(calendarHref).toBeTruthy();
  const calendar = await page.request.get(new URL(calendarHref as string, page.url()).toString());
  expect(calendar.status()).toBe(200);
  expect(calendar.headers()["content-type"]).toMatch(/^text\/calendar\b/);
  expect(calendar.headers()["content-disposition"]).toContain("Ryan-Dwi-21-November-2026.ics");
  const content = await calendar.text();
  expect(content).toContain("DTSTART:20261121T110000Z\r\n");
  expect(content).toContain("SUMMARY:Pernikahan Ryan Pratam & Dwi Wulan Maulida\r\n");
});

test("demo RSVP validates, saves, reloads, edits and deletes only within its template and tab", async ({ page }) => {
  test.setTimeout(45_000);
  const writeAttempts = await blockAndRecordWrites(page);
  await page.goto("/templates/royal-gold/demo#konfirmasi");
  const rsvp = stationery(page).locator("#konfirmasi");
  await expect(rsvp.getByRole("textbox", { name: "Nama Anda", exact: true })).toBeVisible();
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBeNull();
  await expect(rsvp.locator(".rsvp-demo-note")).toContainText("Konfirmasi dan ucapan tidak dikirim kepada mempelai.");

  await rsvp.getByRole("button", { name: "Simpan jawaban di tab ini", exact: true }).click();
  await expect(rsvp.getByRole("alert")).toContainText("Periksa kembali kolom yang ditandai.");
  await expect(rsvp.getByRole("textbox", { name: "Nama Anda", exact: true })).toHaveAttribute("aria-invalid", "true");
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBeNull();

  await rsvp.getByRole("textbox", { name: "Nama Anda", exact: true }).fill("Tester Demo 💌");
  await rsvp.getByRole("radio", { name: "Akan hadir", exact: true }).check();
  await rsvp.getByRole("combobox", { name: /Jumlah tamu/ }).selectOption("3");
  await rsvp.getByRole("textbox", { name: /Ucapan & doa/ }).fill("Ucapan percobaan untuk Ryan dan Dwi.");
  await rsvp.getByRole("button", { name: "Simpan jawaban di tab ini", exact: true }).click();
  await expect(rsvp.getByRole("heading", { name: "Jawaban Anda tersimpan.", exact: true })).toBeVisible();
  await expect(rsvp.locator(".rsvp-summary")).toContainText("Tester Demo 💌");
  await expect(rsvp.locator(".rsvp-summary")).toContainText("3 orang");

  await page.reload();
  await expect(rsvp.getByRole("heading", { name: "Jawaban Anda tersimpan.", exact: true })).toBeVisible();
  await expect(rsvp.locator(".rsvp-saved-message")).toContainText("Ucapan percobaan untuk Ryan dan Dwi.");
  await rsvp.getByRole("button", { name: "Ubah jawaban", exact: true }).click();
  await expect(rsvp.getByRole("textbox", { name: "Nama Anda", exact: true })).toHaveValue("Tester Demo 💌");
  await rsvp.getByRole("radio", { name: "Berhalangan", exact: true }).check();
  await expect(rsvp.getByRole("combobox", { name: /Jumlah tamu/ })).toHaveCount(0);
  await rsvp.getByRole("textbox", { name: /Ucapan & doa/ }).fill("Perubahan jawaban percobaan.");
  await rsvp.getByRole("button", { name: "Simpan perubahan di tab ini", exact: true }).click();
  await expect(rsvp.locator(".rsvp-summary")).toContainText("Berhalangan");
  const updated = await page.evaluate((key) => JSON.parse(sessionStorage.getItem(key) ?? "null"), storageKey);
  expect(updated).toMatchObject({ attendance: "no", guests: 0, message: "Perubahan jawaban percobaan." });

  await page.goto("/templates/modern-sage/demo#konfirmasi");
  await expect(stationery(page).locator("#konfirmasi").getByRole("textbox", { name: "Nama Anda", exact: true })).toHaveValue("");
  await expect(stationery(page).getByRole("heading", { name: "Jawaban Anda tersimpan.", exact: true })).toHaveCount(0);
  await page.goto("/templates/royal-gold/demo#konfirmasi");
  await expect(rsvp.locator(".rsvp-summary")).toContainText("Berhalangan");
  await expect(rsvp.locator(".rsvp-saved-message")).toContainText("Perubahan jawaban percobaan.");

  await rsvp.getByRole("button", { name: "Hapus jawaban", exact: true }).click();
  await rsvp.getByRole("group", { name: "Konfirmasi hapus jawaban" }).getByRole("button", { name: "Ya, hapus", exact: true }).click();
  await expect(rsvp.getByRole("textbox", { name: "Nama Anda", exact: true })).toHaveValue("");
  expect(await page.evaluate((key) => sessionStorage.getItem(key), storageKey)).toBeNull();
  await page.reload();
  await expect(rsvp.getByRole("textbox", { name: "Nama Anda", exact: true })).toBeVisible();
  await expect(rsvp.getByRole("heading", { name: "Jawaban Anda tersimpan.", exact: true })).toHaveCount(0);
  expect(writeAttempts, "Demo interactions must never call a production write endpoint").toEqual([]);
});

test("legacy reference and custom Taman Abadi links remain available explicitly", async ({ page }) => {
  await page.goto("/templates/royal-gold/demo?design=reference");
  await expect(page.locator('.reference-invitation[data-template="royal-gold"]')).toBeAttached();
  await expect(stationery(page)).toHaveCount(0);

  await page.goto("/templates/taman-abadi/demo?hostOne=Ayu&hostTwo=Budi");
  await expect(stationery(page)).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Putar animasi dan buka undangan Ayu dan Budi", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Buka langsung", exact: true }).click();
  await expect(page.locator(".garden-closing-section")).toContainText("Ayu & Budi");
});
