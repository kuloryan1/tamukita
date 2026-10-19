import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const stagingOrigin = "https://staging.tamukita.io";
const mediaOrigin = "https://media-staging.tamukita.io";
const stagingQaEmail = "media-qa@tamukita.invalid";

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

test("staging browser uploads to private R2 and worker publishes a WebP to media R2", async ({ page }) => {
  const configuredOrigin = new URL(process.env.STAGING_BASE_URL ?? "").origin;
  expect(configuredOrigin).toBe(stagingOrigin);

  const email = process.env.STAGING_MEDIA_QA_EMAIL?.trim().toLowerCase();
  const password = process.env.STAGING_MEDIA_QA_PASSWORD;
  expect(email, "The staging media test requires its reserved synthetic .invalid account.").toBe(stagingQaEmail);
  expect(password, "Set STAGING_MEDIA_QA_PASSWORD in GitHub Environment staging.").toBeTruthy();
  if (email !== stagingQaEmail || !password) throw new Error("Provision the dedicated staging-only media QA account first.");

  const suffix = randomUUID().slice(0, 8);
  const firstName = `QA Media ${suffix}`;
  const secondName = `TamuKita ${suffix}`;

  await signIn(page, email, password);

  const creationResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/invitations/drafts") && response.request().method() === "POST",
  );
  await page.goto("/dashboard/invitations/new/edit?new=1");
  const creationResponse = await creationResponsePromise;
  expect(creationResponse.status()).toBe(201);
  const creation = await creationResponse.json() as { draft?: { id?: string } };
  const invitationId = creation.draft?.id;
  expect(invitationId).toMatch(/^[0-9a-f-]{36}$/i);
  if (!invitationId) throw new Error("The staging draft response did not include an invitation ID.");

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
  await page.locator('.photo-upload-prompt input[type="file"]').setInputFiles({
    name: `qa-media-${suffix}.png`,
    mimeType: "image/png",
    buffer: pngBuffer,
  });

  await expect(page.getByRole("dialog").getByRole("heading", { name: "Sesuaikan fotomu" })).toBeVisible();
  const usePhotoButton = page.getByRole("button", { name: /Gunakan foto/ });
  await expect(usePhotoButton).toBeEnabled();
  await usePhotoButton.click();
  await expect(page.locator(".photo-uploaded-label")).toContainText("terpilih", { timeout: 90_000 });

  let coverPhoto: string | null = null;
  await expect.poll(async () => {
    const response = await page.request.get(`/api/invitations/drafts?id=${invitationId}`);
    if (!response.ok()) return null;
    const result = await response.json() as { draft?: { coverPhoto?: string } };
    coverPhoto = result.draft?.coverPhoto ?? null;
    return coverPhoto;
  }, { timeout: 60_000 }).toMatch(/^https:\/\/media-staging\.tamukita\.io\/invitations\//);

  if (!coverPhoto) throw new Error("The staging draft did not save a public R2 cover URL.");
  const webp = await page.request.get(coverPhoto);
  expect(webp.status()).toBe(200);
  expect(webp.headers()["content-type"]).toContain("image/webp");
  expect((await webp.body()).subarray(8, 12).toString("ascii")).toBe("WEBP");

  const coverUrl = new URL(coverPhoto);
  expect(coverUrl.origin).toBe(mediaOrigin);
  expect(coverUrl.pathname).toContain(`/invitations/${invitationId}/`);
});
