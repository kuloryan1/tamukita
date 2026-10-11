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
  }, { timeout: 30_000 }).toMatch(/^http:\/\/127\.0\.0\.1:3138\/public\/invitations\//);
  await expect(page.locator(".editor-save-state")).toHaveText("Tersimpan otomatis", { timeout: 15_000 });
  await page.locator(".editor-stepper button").nth(0).click();
  await expect(page.getByLabel("Nama pertama")).toHaveValue(firstName);
  await expect(page.getByLabel("Nama kedua")).toHaveValue(secondName);

  const storedResponse = await page.request.get(`/api/invitations/drafts?id=${invitationId}`);
  expect(storedResponse.status()).toBe(200);
  const stored = await storedResponse.json() as { draft?: { coverPhoto?: string; hostOne?: string; hostTwo?: string } };
  expect(stored.draft).toMatchObject({ hostOne: firstName, hostTwo: secondName });
  expect(stored.draft?.coverPhoto).toMatch(/^http:\/\/127\.0\.0\.1:3138\/public\/invitations\//);

  const originalCoverUrl = stored.draft?.coverPhoto;
  if (!originalCoverUrl) throw new Error("The processed cover photo was not saved to the draft.");
  await expectWebp(page, originalCoverUrl);

  const savedCropResponse = await page.request.get(`/api/media/cover-edit?invitationId=${invitationId}`);
  expect(savedCropResponse.status()).toBe(200);
  const savedCrop = await savedCropResponse.json() as { cropData?: { zoom?: number; rotation?: number } | null };
  expect(savedCrop.cropData).toMatchObject({ zoom: 1, rotation: 90 });

  await page.reload();
  await expect(page.getByLabel("Nama pertama")).toHaveValue(firstName);
  await advanceToStep(page, 2);
  await page.getByRole("button", { name: "Edit foto" }).click();
  await expect(page.getByRole("dialog").getByRole("heading", { name: "Sesuaikan fotomu" })).toBeVisible();
  await expect(page.getByLabel("Perbesar foto")).toHaveValue("1");
  await page.locator(".photo-crop-rotate button").nth(1).click();
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
  const editedCrop = await editedCropResponse.json() as { cropData?: { zoom?: number; rotation?: number } | null };
  expect(editedCrop.cropData?.zoom).toBeCloseTo(1, 4);
  expect(editedCrop.cropData?.rotation).toBe(180);
});
