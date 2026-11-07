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

async function advanceToStep(page: Page, targetStep: number) {
  for (let step = 0; step < targetStep; step += 1) {
    await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  }
}

async function expectWebp(page: Page, url: string) {
  const mediaUrl = new URL(url);
  expect(mediaUrl.origin).toBe(new URL(page.url()).origin);
  expect(mediaUrl.pathname).toMatch(/^\/api\/media\/files\/invitations\//);
  const response = await page.request.get(url);
  expect(response.status()).toBe(200);
  expect(response.headers()["content-type"]).toContain("image/webp");
  const body = await response.body();
  expect(body.subarray(8, 12).toString("ascii")).toBe("WEBP");
}

test("customer crops and processes a cover photo without losing draft details", async ({ page }, testInfo) => {
  test.setTimeout(90_000);
  const { email: customerEmail, password: customerPassword } = getCustomerCredentials(testInfo);
  if (!customerEmail || !customerPassword) {
    test.skip(true, "Requires the disposable PostgreSQL customer fixture, Redis, and the local R2 mock.");
    return;
  }

  await signIn(page, customerEmail, customerPassword);
  const creationResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/invitations/drafts") && response.request().method() === "POST",
  );
  await page.goto("/dashboard/invitations/new/edit?new=1");
  const creationResponse = await creationResponsePromise;
  expect(creationResponse.status()).toBe(201);
  const creation = await creationResponse.json() as { draft?: { id?: string } };
  const invitationId = creation.draft?.id;
  expect(invitationId).toMatch(/^[0-9a-f-]{36}$/i);
  if (!invitationId) throw new Error("The customer draft response did not include an invitation ID.");
  await expect(page).toHaveURL(new RegExp(`/dashboard/invitations/${invitationId}/edit$`));

  const suffix = randomUUID().slice(0, 8);
  const firstName = `Media Alya ${suffix}`;
  const secondName = `Media Bima ${suffix}`;
  await page.getByLabel("Nama pertama").fill(firstName);
  await page.getByLabel("Nama kedua").fill(secondName);
  await advanceToStep(page, 2);

  const pngDataUrl = await page.evaluate(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 120;
    canvas.height = 160;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas is unavailable in this browser.");
    context.fillStyle = "#c58c77";
    context.fillRect(0, 0, 120, 160);
    context.fillStyle = "#e5d6b9";
    context.fillRect(15, 18, 90, 124);
    context.fillStyle = "#596f62";
    context.beginPath();
    context.arc(60, 61, 25, 0, Math.PI * 2);
    context.fill();
    return canvas.toDataURL("image/png");
  });
  const pngBuffer = Buffer.from(pngDataUrl.slice(pngDataUrl.indexOf(",") + 1), "base64");
  await page.locator('.photo-upload-prompt input[type="file"]').setInputFiles({ name: "cover.png", mimeType: "image/png", buffer: pngBuffer });
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Sesuaikan fotomu" })).toBeVisible();
  const zoomControl = page.getByLabel("Perbesar foto");
  await zoomControl.focus();
  await zoomControl.press("End");
  await expect(zoomControl).toHaveValue("3");

  const cropStage = page.locator(".photo-crop-stage .reactEasyCrop_Container");
  const cropBounds = await cropStage.boundingBox();
  expect(cropBounds).not.toBeNull();
  if (!cropBounds) throw new Error("The photo crop stage is not visible.");
  const cropCenterX = cropBounds.x + cropBounds.width / 2;
  const cropCenterY = cropBounds.y + cropBounds.height / 2;
  await page.mouse.move(cropCenterX, cropCenterY);
  await page.mouse.down();
  await page.mouse.move(cropCenterX + 32, cropCenterY + 18, { steps: 4 });
  await page.mouse.up();
  await page.locator(".photo-crop-rotate button").nth(1).click();
  const usePhotoButton = page.getByRole("button", { name: /Gunakan foto/ });
  await expect(usePhotoButton).toBeEnabled();
  await usePhotoButton.click();

  await expect(page.locator(".photo-uploaded-label")).toContainText("terpilih", { timeout: 45_000 });
  await expect.poll(async () => {
    const response = await page.request.get(`/api/invitations/drafts?id=${invitationId}`);
    if (!response.ok()) return null;
    const result = await response.json() as { draft?: { coverPhoto?: string } };
    return result.draft?.coverPhoto ?? null;
  }, { timeout: 30_000 }).toMatch(/\/api\/media\/files\/invitations\//);
  await expect(page.locator(".editor-save-state")).toHaveText("Tersimpan otomatis", { timeout: 15_000 });
  await page.locator(".editor-stepper button").nth(0).click();
  await expect(page.getByLabel("Nama pertama")).toHaveValue(firstName);
  await expect(page.getByLabel("Nama kedua")).toHaveValue(secondName);

  const storedResponse = await page.request.get(`/api/invitations/drafts?id=${invitationId}`);
  expect(storedResponse.status()).toBe(200);
  const stored = await storedResponse.json() as { draft?: { coverPhoto?: string; hostOne?: string; hostTwo?: string } };
  expect(stored.draft).toMatchObject({ hostOne: firstName, hostTwo: secondName });
  expect(stored.draft?.coverPhoto).toMatch(/\/api\/media\/files\/invitations\//);

  const originalCoverUrl = stored.draft?.coverPhoto;
  if (!originalCoverUrl) throw new Error("The processed cover photo was not saved to the draft.");
  await expectWebp(page, originalCoverUrl);

  const savedCropResponse = await page.request.get(`/api/media/cover-edit?invitationId=${invitationId}`);
  expect(savedCropResponse.status()).toBe(200);
  const savedCrop = await savedCropResponse.json() as { cropData?: { zoom?: number; rotation?: number; cropOffset?: { x?: number; y?: number } } | null };
  expect(savedCrop.cropData).toMatchObject({ zoom: 3, rotation: 90 });
  expect(savedCrop.cropData?.cropOffset?.x).not.toBe(0);
  expect(savedCrop.cropData?.cropOffset?.y).not.toBe(0);

  await page.reload();
  await expect(page.getByLabel("Nama pertama")).toHaveValue(firstName);
  await advanceToStep(page, 2);
  await page.getByRole("button", { name: "Edit foto" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Sesuaikan fotomu" })).toBeVisible();
  await expect(zoomControl).toHaveValue("3");
  await page.locator(".photo-crop-rotate button").nth(1).click();
  await page.getByRole("button", { name: "Atur ulang" }).click();
  await expect(zoomControl).toHaveValue("1");
  await page.getByRole("button", { name: /Gunakan foto/ }).click();
  await expect(page.locator(".photo-uploaded-label")).toContainText("terpilih", { timeout: 45_000 });
  await expect(page.locator(".editor-save-state")).toHaveText("Tersimpan otomatis", { timeout: 15_000 });

  await expect.poll(async () => {
    const response = await page.request.get(`/api/invitations/drafts?id=${invitationId}`);
    if (!response.ok()) return null;
    const result = await response.json() as { draft?: { coverPhoto?: string } };
    return result.draft?.coverPhoto;
  }).not.toBe(originalCoverUrl);

  const editedDraftResponse = await page.request.get(`/api/invitations/drafts?id=${invitationId}`);
  const editedDraft = await editedDraftResponse.json() as { draft?: { coverPhoto?: string } };
  const editedCoverUrl = editedDraft.draft?.coverPhoto;
  if (!editedCoverUrl) throw new Error("The edited cover photo was not saved to the draft.");
  await expectWebp(page, editedCoverUrl);

  const editedCropResponse = await page.request.get(`/api/media/cover-edit?invitationId=${invitationId}`);
  expect(editedCropResponse.status()).toBe(200);
  const editedCrop = await editedCropResponse.json() as { cropData?: { zoom?: number; rotation?: number; cropOffset?: { x?: number; y?: number } } | null };
  expect(editedCrop.cropData?.zoom).toBeCloseTo(1, 4);
  expect(editedCrop.cropData?.rotation).toBe(0);
  expect(editedCrop.cropData?.cropOffset).toMatchObject({ x: 0, y: 0 });
});

test("super admin uploads separate portraits and sees them in their own invitation frames", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "desktop-chromium", "Run this full testable-sample publication flow once in desktop Chromium.");
  test.setTimeout(120_000);
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (!adminEmail || !adminPassword) {
    test.skip(true, "Requires the disposable PostgreSQL Super Admin fixture and local media worker.");
    return;
  }

  await signIn(page, adminEmail, adminPassword);
  const creationResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/invitations/drafts") && response.request().method() === "POST",
  );
  await page.goto("/dashboard/invitations/new/edit?new=1");
  const creationResponse = await creationResponsePromise;
  expect(creationResponse.status()).toBe(201);
  const creation = await creationResponse.json() as { draft?: { id?: string } };
  const invitationId = creation.draft?.id;
  expect(invitationId).toMatch(/^[0-9a-f-]{36}$/i);
  if (!invitationId) throw new Error("The Super Admin draft response did not include an invitation ID.");

  const suffix = randomUUID().slice(0, 8);
  const groomName = `Frame Groom ${suffix}`;
  const brideName = `Frame Bride ${suffix}`;
  await page.getByLabel("Nama pertama").fill(groomName);
  await page.getByLabel("Nama kedua").fill(brideName);
  await advanceToStep(page, 2);

  const makePortrait = async (color: string) => {
    const dataUrl = await page.evaluate((background) => {
      const canvas = document.createElement("canvas");
      canvas.width = 180;
      canvas.height = 230;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("Canvas is unavailable in this browser.");
      context.fillStyle = background;
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.fillStyle = "#f8efe4";
      context.beginPath();
      context.arc(90, 80, 42, 0, Math.PI * 2);
      context.fill();
      context.fillRect(38, 132, 104, 80);
      return canvas.toDataURL("image/png");
    }, color);
    return Buffer.from(dataUrl.slice(dataUrl.indexOf(",") + 1), "base64");
  };
  const brideBuffer = await makePortrait("#bd637d");
  const groomBuffer = await makePortrait("#557b68");
  const portraitInputs = page.locator(".portrait-upload-card input[type=\"file\"]");
  await expect(portraitInputs).toHaveCount(2);
  await portraitInputs.nth(0).setInputFiles({ name: "bride.png", mimeType: "image/png", buffer: brideBuffer });
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Sesuaikan fotomu" })).toBeVisible();
  await page.getByRole("button", { name: /Gunakan foto/ }).click();
  await expect(page.locator(".portrait-upload-card").nth(0)).toContainText("Foto terpilih", { timeout: 45_000 });

  await portraitInputs.nth(1).setInputFiles({ name: "groom.png", mimeType: "image/png", buffer: groomBuffer });
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Sesuaikan fotomu" })).toBeVisible();
  await page.getByRole("button", { name: /Gunakan foto/ }).click();
  await expect(page.locator(".portrait-upload-card").nth(1)).toContainText("Foto terpilih", { timeout: 45_000 });
  await expect(page.locator(".editor-save-state")).toHaveText("Tersimpan otomatis", { timeout: 15_000 });

  const portraitResponse = await page.request.get(`/api/invitations/drafts?id=${invitationId}`);
  expect(portraitResponse.status()).toBe(200);
  const portraitResult = await portraitResponse.json() as { draft?: { hostOnePhoto?: string; hostTwoPhoto?: string; slug?: string } };
  const groomPhotoUrl = portraitResult.draft?.hostOnePhoto;
  const bridePhotoUrl = portraitResult.draft?.hostTwoPhoto;
  const slug = portraitResult.draft?.slug;
  expect(groomPhotoUrl).toMatch(/\/api\/media\/files\/invitations\//);
  expect(bridePhotoUrl).toMatch(/\/api\/media\/files\/invitations\//);
  expect(groomPhotoUrl).not.toBe(bridePhotoUrl);
  if (!groomPhotoUrl || !bridePhotoUrl || !slug) throw new Error("Both portrait slots and a public invitation slug must be saved.");
  await expectWebp(page, groomPhotoUrl);
  await expectWebp(page, bridePhotoUrl);

  await page.getByRole("button", { name: "Lanjutkan", exact: true }).click();
  await page.getByRole("button", { name: "Lihat preview", exact: true }).click();
  await page.getByRole("button", { name: "Terbitkan contoh gratis", exact: true }).click();
  await page.waitForURL((url) => url.pathname === `/${slug}`, { timeout: 30_000 });
  await page.getByRole("button", { name: /Buka undangan/ }).click();

  await expect(page.locator(".cover-photo-tile--host-one .cover-photo-image")).toHaveAttribute("src", groomPhotoUrl, { timeout: 15_000 });
  await expect(page.locator(".cover-photo-tile--host-two .cover-photo-image")).toHaveAttribute("src", bridePhotoUrl);
});
