import { access, readFile, rm } from "node:fs/promises";
import path from "node:path";
import { paparazziFilePath } from "../src/lib/paparazzi-server-files";
import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chromium, expect, test, type APIRequestContext, type Page } from "@playwright/test";
import { Pool } from "pg";
import sharp from "sharp";
import jsQR from "jsqr";
import { createInitialDraft } from "../src/lib/invitations";

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login"); await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password); await page.getByRole("button", { name: "Masuk", exact: true }).click();
  await page.waitForURL(/\/(?:dashboard|admin)(?:\/|$)/);
}

test("event QR opens the camera, stores validated photos, and immediately publishes an owner-controlled gallery", async ({ page, browser, request }, testInfo) => {
  test.setTimeout(300_000);
  test.skip(testInfo.project.name !== "desktop-chromium", "The persisted upload scenario runs once per disposable database.");
  const databaseUrl = process.env.DATABASE_URL;
  const email = process.env.E2E_PAPARAZZI_CUSTOMER_EMAIL; const password = process.env.E2E_PAPARAZZI_CUSTOMER_PASSWORD;
  const otherEmail = process.env.E2E_OTHER_CUSTOMER_EMAIL; const otherPassword = process.env.E2E_OTHER_CUSTOMER_PASSWORD;
  if (!databaseUrl || !email || !password || !otherEmail || !otherPassword) { test.skip(true, "Requires disposable database and dedicated photo fixture account."); return; }
  const dbUrl = new URL(databaseUrl); dbUrl.searchParams.delete("schema");
  const local = ["localhost", "127.0.0.1"].includes(dbUrl.hostname) && dbUrl.pathname === "/tamukita_paparazzi_e2e" && process.env.E2E_ALLOW_DESTRUCTIVE === "1";
  const ci = process.env.CI === "true" && dbUrl.hostname === "postgres" && dbUrl.pathname === "/tamukita";
  if (!local && !ci) throw new Error("Photo E2E requires the explicitly allowed disposable database.");
  const pool = new Pool({ connectionString: dbUrl.toString() });
  const otherContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const reviewerContext = await browser.newContext({ baseURL: testInfo.project.use.baseURL });
  const cameraBrowser = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"], ...(process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : {}) });
  const guestContext = await cameraBrowser.newContext({ baseURL: testInfo.project.use.baseURL, permissions: ["camera"], viewport: { width: 390, height: 844 } });
  const guest = await guestContext.newPage(); const other = await otherContext.newPage();
  const clientErrors: string[] = [];
  page.on("pageerror", error => clientErrors.push(error.message)); guest.on("pageerror", error => clientErrors.push(error.message));
  async function capture(name: string, target: Page) {
    const path = testInfo.outputPath(`${name}.png`); await target.evaluate(() => window.scrollTo(0, 0)); await target.screenshot({ path, fullPage: true });
    await testInfo.attach(name, { path, contentType: "image/png" });
  }
  let invitationId: string | undefined;
  try {
    await signIn(page, email, password); await signIn(other, otherEmail, otherPassword);
    const { id: _id, updatedAt: _updatedAt, ...initialDraft } = createInitialDraft();
    const draft = { ...initialDraft, slug: `paparazzi-${randomUUID().slice(0, 8)}`, hostOne: "Nara", hostTwo: "Raka", eventTitle: "Kenangan Acara QA", eventDate: new Date(Date.now() + 30 * 86_400_000).toISOString().slice(0, 10), eventTime: "10:00", venue: "Taman Pengujian", address: "Alamat fixture, bukan acara nyata" };
    const creation = await page.request.post("/api/invitations/drafts", { data: draft }); expect(creation.status()).toBe(201);
    const created = (await creation.json()).draft; invitationId = created.id;
    // Seed this account's published-event prerequisite only; billing is exercised in its own suites.
    const snapshot = JSON.stringify({ ...created, publishedAt: new Date().toISOString() });
    const seeded = await pool.query('UPDATE invitations SET status = \'PUBLISHED\', "publishedSnapshot" = $2::jsonb, "publishedAt" = now(), "startsAt" = now() + interval \'30 days\', "expiresAt" = now() + interval \'365 days\' WHERE id = $1 AND "ownerId" = (SELECT id FROM users WHERE email = $3) RETURNING id', [invitationId, snapshot, email]);
    expect(seeded.rowCount).toBe(1);
    await pool.query('INSERT INTO template_licenses (id, "organizationId", "invitationId", "templateId", "templateVersionId", "licenseSnapshot") SELECT $2, i."organizationId", i.id, v."templateId", v.id, $3::jsonb FROM invitations i JOIN template_versions v ON v.id = i."templateVersionId" WHERE i.id = $1', [invitationId, randomUUID(), JSON.stringify({ activationSource: "E2E_FIXTURE" })]);
    const ownerPath = `/api/invitations/${invitationId}/paparazzi`;
    expect((await request.get(ownerPath)).status()).toBe(401);
    expect((await other.request.get(ownerPath)).status()).toBe(404);
    expect((await other.request.patch(ownerPath, { data: { enabled: true } })).status()).toBe(404);
    await page.goto("/dashboard"); await page.getByRole("link", { name: "Paparazi", exact: true }).click();
    await page.waitForURL(new RegExp(`/dashboard/invitations/${invitationId}/paparazi$`));
    await page.getByRole("button", { name: "Siapkan QR & buka unggahan", exact: true }).click();
    await expect(page.getByText("Menerima foto dari tamu", { exact: true })).toBeVisible();
    const album = (await (await page.request.get(ownerPath)).json()).album;
    expect(album.maxPhotos).toBeNull();
    expect(new URL(album.shareUrl).origin).toBe(new URL(String(testInfo.project.use.baseURL)).origin);
    const token = new URL(album.shareUrl).pathname.split("/").at(-1) ?? "";
    expect(token).toMatch(/^[a-f0-9]{64}$/);
    const publicPath = `/api/public/paparazzi/${token}`;
    const galleryPath = `${publicPath}/gallery`;
    const qr = await page.request.get(`${ownerPath}/qr?format=png`); expect(qr.ok()).toBeTruthy();
    const pixels = await sharp(await qr.body()).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const decoded = jsQR(new Uint8ClampedArray(pixels.data), pixels.info.width, pixels.info.height);
    if (!decoded) throw new Error("Generated event QR could not be decoded.");
    expect(decoded?.data).toBe(album.shareUrl);
    expect((await request.get(`${ownerPath}/qr?format=png`)).status()).toBe(401);
    const entry = await guest.goto(decoded.data);
    expect(entry?.headers()["permissions-policy"]).toContain("camera=(self)");
    expect(entry?.headers()["x-robots-tag"]).toContain("noindex");
    expect((await request.get("/")).headers()["permissions-policy"]).toContain("camera=()");
    await expect(guest.getByRole("heading", { name: "Nara & Raka", exact: true })).toBeVisible();
    await expect(guest.getByText("Foto langsung masuk galeri publik acara", { exact: true })).toBeVisible();
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await capture("guest-mobile-entry", guest);
    await guest.getByRole("button", { name: "Buka kamera", exact: true }).click();
    await expect(guest.getByRole("button", { name: "Ambil foto", exact: true })).toBeEnabled();
    expect(await guest.locator("video").evaluate((video: HTMLVideoElement) => video.videoWidth)).toBeGreaterThan(0);
    await guest.getByRole("button", { name: "Ambil foto", exact: true }).click();
    await expect(guest.getByRole("heading", { name: "Siap dibagikan?" })).toBeVisible();
    await capture("guest-mobile-preview", guest);
    const send = guest.getByRole("button", { name: "Bagikan ke galeri acara", exact: true }); await expect(send).toBeDisabled();
    await guest.getByLabel(/^Saya berusia minimal 18 tahun/).check();
    const reservationResponse = guest.waitForResponse(response => response.url().endsWith(`${publicPath}/uploads`) && response.request().method() === "POST");
    await send.click(); const firstTicket = await (await reservationResponse).json();
    await expect(guest.getByRole("heading", { name: "Foto sudah diterima!" })).toBeVisible({ timeout: 90_000 });
    const photoPath = `${galleryPath}/${firstTicket.photoId}`; const ownerPhoto = `${ownerPath}/photos/${firstTicket.photoId}`;
    await expect.poll(async () => (await (await request.get(galleryPath)).json()).photos.map((photo: { id: string }) => photo.id)).toContain(firstTicket.photoId);
    await expect(guest.locator(".paparazzi-public-photo img")).toHaveCount(1);
    expect((await request.get(photoPath)).headers()["content-type"]).toBe("image/jpeg");
    expect((await request.get(photoPath)).headers()["cache-control"]).toContain("no-store");
    expect((await request.get(ownerPhoto)).status()).toBe(401);
    expect((await other.request.get(ownerPhoto)).status()).toBe(404);
    expect((await request.patch(ownerPhoto, { data: { visible: false } })).status()).toBe(401);
    expect((await other.request.delete(ownerPhoto)).status()).toBe(404);
    expect((await request.get(`${publicPath}/photos/${firstTicket.photoId}`, { headers: { "x-paparazzi-receipt": "b".repeat(64) } })).status()).toBe(404);
    expect((await request.post(`${publicPath}/photos/${firstTicket.photoId}`, { data: { receipt: firstTicket.receipt } })).ok()).toBeTruthy();
    expect(Number((await pool.query('SELECT count(*) FROM notification_jobs WHERE "jobKey" = $1', [`paparazzi-process:${firstTicket.photoId}`])).rows[0].count)).toBe(1);
    await page.reload(); await expect(page.getByRole("button", { name: "Sembunyikan", exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Sembunyikan", exact: true }).click();
    await expect.poll(async () => (await request.get(photoPath)).status()).toBe(404);
    expect((await (await request.get(galleryPath)).json()).photos).toHaveLength(0);
    expect((await page.request.get(ownerPhoto)).ok()).toBeTruthy();
    await page.getByRole("button", { name: "Tampilkan", exact: true }).click();
    await expect.poll(async () => (await request.get(photoPath)).status()).toBe(200);

    async function reserve(client: APIRequestContext, bytes: Buffer, overrides: Record<string, unknown> = {}) {
      return client.post(`${publicPath}/uploads`, { data: { contentType: "image/jpeg", sizeBytes: bytes.length, consent: true, includesChildData: false, guardianConsent: false, ...overrides } });
    }
    const source = await sharp({ create: { width: 96, height: 64, channels: 3, background: "#8aa385" } }).withMetadata({ orientation: 6, exif: { IFD0: { Artist: "Synthetic Paparazi QA" } } }).jpeg().toBuffer();
    expect((await sharp(source).metadata()).exif).toBeDefined();
    expect((await reserve(request, source, { consent: false })).status()).toBe(400);
    expect((await reserve(request, source, { includesChildData: true })).status()).toBe(400);
    expect((await reserve(request, source, { contentType: "image/svg+xml" })).status()).toBe(400);
    expect((await reserve(request, source, { sizeBytes: 10_000_001 })).status()).toBe(400);
    const second = await (await reserve(request, source, { includesChildData: true, guardianConsent: true })).json();
    expect((await request.get(`${galleryPath}/${second.photoId}`)).status()).toBe(404);
    expect((await request.put(second.uploadUrl, { data: source, headers: { "content-type": "image/jpeg" } })).status()).toBe(404);
    expect((await request.put(second.uploadUrl, { data: source, headers: { "content-type": "image/png", ...second.uploadHeaders } })).status()).toBe(400);
    expect((await request.put(second.uploadUrl, { data: source, headers: { "content-type": "image/jpeg", "content-length": String(source.length), ...second.uploadHeaders } })).ok()).toBeTruthy();
    expect((await request.put(second.uploadUrl, { data: source, headers: { "content-type": "image/jpeg", "content-length": String(source.length), ...second.uploadHeaders } })).ok()).toBeTruthy();
    expect((await request.post(`${publicPath}/photos/${second.photoId}`, { data: { receipt: second.receipt } })).ok()).toBeTruthy();
    await expect.poll(async () => (await request.get(`${galleryPath}/${second.photoId}`)).status(), { timeout: 90_000 }).toBe(200);
    const processed = await sharp(await (await request.get(`${galleryPath}/${second.photoId}`)).body()).metadata();
    expect(processed.format).toBe("jpeg"); expect(processed.width).toBe(64); expect(processed.height).toBe(96);
    expect(processed.exif).toBeUndefined(); expect(processed.orientation).toBeUndefined();
    const stored = (await pool.query('SELECT "sourceKey", "processedKey", "storageProvider", "consentVersion", "guardianConsentVersion" FROM paparazzi_photos WHERE id=$1', [second.photoId])).rows[0];
    expect(stored.consentVersion).toBe("paparazzi-public-2026-10-v1"); expect(stored.guardianConsentVersion).toBe("child-paparazzi-public-guardian-2026-10-v1");
    expect(stored.storageProvider).toBe("SERVER");
    const diskRoot = path.resolve(process.env.PAPARAZZI_STORAGE_DIR || ".local-storage/paparazzi-e2e");
    async function exists(key: string) { try { await access(paparazziFilePath(key, diskRoot)); return true; } catch { return false; } }
    await expect.poll(() => exists(stored.sourceKey)).toBe(false);
    expect(await readFile(paparazziFilePath(stored.processedKey, diskRoot))).toEqual(await (await request.get(`${galleryPath}/${second.photoId}`)).body());
    expect((await request.get(`http://127.0.0.1:3138/private/${stored.processedKey}`)).status()).toBe(404);
    expect((await request.get(`/${stored.processedKey}`)).status()).toBe(404);
    expect((await request.get(`http://127.0.0.1:3138/public/${stored.processedKey}`)).status()).toBe(404);
    await guest.reload(); await expect(guest.locator(".paparazzi-public-photo img")).toHaveCount(2);
    expect(await guest.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await capture("guest-mobile-public-gallery", guest);
    await page.reload(); await capture("owner-desktop-gallery", page);
    await page.setViewportSize({ width: 390, height: 844 }); expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await capture("owner-mobile-gallery", page);
    await page.setViewportSize({ width: 1280, height: 900 });
    await pool.query('UPDATE paparazzi_photos SET "consentVersion" = $2 WHERE id = $1', [second.photoId, "paparazzi-private-2026-10-v1"]);
    expect((await request.get(`${galleryPath}/${second.photoId}`)).status()).toBe(404);
    expect((await page.request.patch(`${ownerPath}/photos/${second.photoId}`, { data: { visible: true } })).status()).toBe(409);
    await pool.query('UPDATE paparazzi_photos SET "consentVersion" = $2 WHERE id = $1', [second.photoId, "paparazzi-public-2026-10-v1"]);
    const invalid = Buffer.from("This is not an image."); const bad = await (await reserve(request, invalid)).json();
    await request.put(bad.uploadUrl, { data: invalid, headers: { "content-type": "image/jpeg", "content-length": String(invalid.length), ...bad.uploadHeaders } });
    await request.post(`${publicPath}/photos/${bad.photoId}`, { data: { receipt: bad.receipt } });
    await expect.poll(async () => (await request.get(`${publicPath}/photos/${bad.photoId}`, { headers: { "x-paparazzi-receipt": bad.receipt } })).status(), { timeout: 90_000 }).toBe(422);
    expect((await request.get(`${galleryPath}/${bad.photoId}`)).status()).toBe(404);
    const badKey = (await pool.query('SELECT "sourceKey" FROM paparazzi_photos WHERE id=$1', [bad.photoId])).rows[0].sourceKey;
    await expect.poll(() => exists(badKey)).toBe(false);
    await page.request.patch(ownerPath, { data: { enabled: false } });
    expect((await reserve(request, source)).status()).toBe(410);
    expect((await request.get(photoPath)).ok()).toBeTruthy();
    await guest.reload(); await expect(guest.getByRole("button", { name: "Buka kamera", exact: true })).toHaveCount(0);
    await expect(guest.locator(".paparazzi-public-photo img")).toHaveCount(2);
    await page.request.patch(ownerPath, { data: { enabled: true } });
    await pool.query('UPDATE paparazzi_albums SET "maxPhotos" = (SELECT count(*) + 1 FROM paparazzi_photos WHERE "albumId" = paparazzi_albums.id AND "deletedAt" IS NULL) WHERE "invitationId"=$1', [invitationId]);
    const reservations = await Promise.all([reserve(request, source), reserve(request, source)]);
    expect(reservations.filter(response => response.ok())).toHaveLength(1); expect(reservations.filter(response => response.status() === 409)).toHaveLength(1);
    await pool.query('UPDATE paparazzi_albums SET "maxPhotos"=NULL WHERE "invitationId"=$1', [invitationId]);
    await pool.query('UPDATE invitations SET status=\'SUSPENDED\' WHERE id=$1', [invitationId]);
    expect((await request.get(photoPath)).status()).toBe(404); expect((await request.get(galleryPath)).status()).toBe(404);
    await pool.query('UPDATE invitations SET status=\'PUBLISHED\', "expiresAt"=now()-interval \'1 second\' WHERE id=$1', [invitationId]);
    expect((await request.get(photoPath)).status()).toBe(404); expect((await reserve(request, source)).status()).toBe(410);
    await pool.query('UPDATE invitations SET "expiresAt"=now()+interval \'365 days\' WHERE id=$1', [invitationId]);
    const firstKey = (await pool.query('SELECT "processedKey" FROM paparazzi_photos WHERE id=$1', [firstTicket.photoId])).rows[0].processedKey;
    await page.request.delete(ownerPhoto); expect((await request.get(photoPath)).status()).toBe(404); expect((await page.request.get(ownerPhoto)).status()).toBe(404);
    await expect.poll(() => exists(firstKey), { timeout: 90_000 }).toBe(false);
    const rotated = await page.request.patch(ownerPath, { data: { rotateQr: true } }); expect(rotated.ok()).toBeTruthy();
    expect((await request.get(publicPath)).status()).toBe(404); expect((await request.get(`${galleryPath}/${second.photoId}`)).status()).toBe(404);
    const newShare = (await rotated.json()).album.shareUrl; expect(newShare).not.toBe(album.shareUrl);
    expect((await request.get(`/api/public/paparazzi/${new URL(newShare).pathname.split("/").at(-1)}/gallery/${second.photoId}`)).ok()).toBeTruthy();
    await guest.getByRole("button", { name: "Laporkan konten acara", exact: true }).click();
    await guest.getByLabel("Alasan laporan").selectOption("SPAM");
    await guest.getByRole("button", { name: "Kirim laporan", exact: true }).click();
    await expect(guest.getByText("Laporan diterima untuk ditinjau.", { exact: true })).toBeVisible({ timeout: 15_000 });
    expect((await other.request.get("/api/admin/invitation-reports")).status()).toBe(403);
    await pool.query('UPDATE users SET "platformRole"=\'CONTENT_REVIEWER\' WHERE email=$1', [email]);
    const reviewer = await reviewerContext.newPage(); reviewer.on("pageerror", error => clientErrors.push(error.message));
    await signIn(reviewer, email, password); await reviewer.goto("/admin/moderation");
    await expect(reviewer.getByRole("link", { name: "Tinjau galeri acara", exact: true })).toHaveAttribute("href", new URL(newShare).pathname);
    await guest.goto(newShare);
    const activeToken = new URL(newShare).pathname.split("/").at(-1) ?? "";
    const activePublic = `/api/public/paparazzi/${activeToken}`;
    const legacyId = randomUUID(); const legacyReceipt = randomBytes(32).toString("hex");
    const legacy = (await pool.query('SELECT a.id, i."organizationId" FROM paparazzi_albums a JOIN invitations i ON i.id=a."invitationId" WHERE i.id=$1', [invitationId])).rows[0];
    const legacyPrefix = `${legacy.organizationId}/${invitationId}/${legacyId}`;
    const legacySource = `private/pending/paparazzi/${legacyPrefix}/source`; const legacyOutput = `private/paparazzi/${legacyPrefix}.jpg`;
    await pool.query(`INSERT INTO paparazzi_photos (id,"albumId","sourceKey","processedKey","storageProvider","mimeType","sizeBytes","receiptHash","consentAt","consentVersion","includesChildData","retentionAt") VALUES ($1,$2,$3,$4,'R2','image/jpeg',$5,$6,now(),'paparazzi-public-2026-10-v1',false,now()+interval '90 days')`, [legacyId,legacy.id,legacySource,legacyOutput,source.length,createHash("sha256").update(legacyReceipt).digest("hex")]);
    expect((await request.put(`http://127.0.0.1:3138/private/${legacySource}`, { data: source, headers: { "content-type": "image/jpeg" } })).ok()).toBeTruthy();
    expect((await request.post(`${activePublic}/photos/${legacyId}`, { data: { receipt: legacyReceipt } })).ok()).toBeTruthy();
    await expect.poll(async () => (await request.get(`${activePublic}/gallery/${legacyId}`)).status(), { timeout: 90_000 }).toBe(200);
    expect(await exists(legacyOutput)).toBe(false);

    // Native camera-sized synthetic photos, with enough detail to exercise JPEG processing.
    const burstSource = await sharp(randomBytes(1920 * 1280 * 3), { raw: { width: 1920, height: 1280, channels: 3 } }).blur(0.8).jpeg({ quality: 90 }).toBuffer();
    // Model the event estimate: 60 guests reserve, upload, and submit at once.
    const burstResults = await Promise.allSettled(Array.from({ length: 60 }, async () => {
      const reservation = await request.post(`${activePublic}/uploads`, { data: { contentType: "image/jpeg", sizeBytes: burstSource.length, consent: true, includesChildData: false, guardianConsent: false } });
      expect(reservation.status()).toBe(201); const ticket = await reservation.json();
      expect(ticket.uploadUrl).toMatch(/\/file$/);
      expect((await request.put(ticket.uploadUrl, { data: burstSource, headers: { "content-type": "image/jpeg", ...ticket.uploadHeaders } })).status()).toBe(201);
      expect((await request.post(`${activePublic}/photos/${ticket.photoId}`, { data: { receipt: ticket.receipt } })).ok()).toBeTruthy();
      return ticket.photoId as string;
    }));
    for (const result of burstResults) if (result.status === "rejected") throw result.reason;
    const burst = burstResults.flatMap(result => result.status === "fulfilled" ? [result.value] : []);
    await expect.poll(async () => Number((await pool.query(`SELECT count(*) FROM paparazzi_photos WHERE id=ANY($1::uuid[]) AND status='READY' AND "storageProvider"='SERVER'`, [burst])).rows[0].count), { timeout: 90_000 }).toBe(60);
    expect((await request.get(`${activePublic}/gallery/${burst[59]}`)).status()).toBe(200);
    await testInfo.attach("server-upload-burst", { body: JSON.stringify({ simultaneousGuests: 60, processed: 60, provider: "SERVER", inputWidth: 1920, inputHeight: 1280, bytesPerPhoto: burstSource.length }), contentType: "application/json" });
    const refreshedGallery = await (await request.get(`${activePublic}/gallery`)).json();
    expect(refreshedGallery.photos.length).toBeGreaterThan(2);
    await expect(guest.locator(".paparazzi-public-photo img")).toHaveCount(refreshedGallery.photos.length, { timeout: 15_000 });
    // A legacy limit of 200 must no longer cap new event reservations.
    await pool.query(`INSERT INTO paparazzi_photos (id,"albumId","sourceKey","processedKey","storageProvider","mimeType","sizeBytes","receiptHash","consentAt","consentVersion","includesChildData","retentionAt") SELECT g.id,$1,'private/pending/paparazzi/'||$2||'/'||$3||'/'||g.id||'/source','private/paparazzi/'||$2||'/'||$3||'/'||g.id||'.jpg','SERVER','image/jpeg',$4,$5,now(),'paparazzi-public-2026-10-v1',false,now()+interval '90 days' FROM (SELECT gen_random_uuid() AS id FROM generate_series(1,200)) g`, [legacy.id,legacy.organizationId,invitationId,source.length,createHash("sha256").update(legacyReceipt).digest("hex")]);
    expect((await request.post(`${activePublic}/uploads`, { data: { contentType: "image/jpeg", sizeBytes: source.length, consent: true, includesChildData: false, guardianConsent: false } })).status()).toBe(201);
    expect(clientErrors).toEqual([]);
  } finally {
    await pool.query('UPDATE users SET "platformRole"=\'CUSTOMER\' WHERE email=$1', [email]);
    if (invitationId) {
      const owned = (await pool.query('DELETE FROM invitations WHERE id=$1 AND "ownerId"=(SELECT id FROM users WHERE email=$2) RETURNING "organizationId"', [invitationId, email])).rows[0];
      if (owned) {
        const diskRoot = path.resolve(process.env.PAPARAZZI_STORAGE_DIR || ".local-storage/paparazzi-e2e");
        for (const prefix of ["private/pending/paparazzi", "private/paparazzi"]) await rm(path.join(diskRoot, prefix, owned.organizationId, invitationId), { recursive: true, force: true });
      }
    }
    await pool.end(); await reviewerContext.close(); await otherContext.close(); await guestContext.close(); await cameraBrowser.close();
  }
});
