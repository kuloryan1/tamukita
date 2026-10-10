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

test("editor supports undo, redo, responsive preview, and saved personalization", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const { email: customerEmail, password: customerPassword } = getCustomerCredentials(testInfo);
  if (!customerEmail || !customerPassword) {
    test.skip(true, "Requires the disposable PostgreSQL customer fixture.");
    return;
  }

  await signIn(page, customerEmail, customerPassword);
  const customDomainMenuItem = page.locator(".dashboard-menu .sidebar-link--disabled");
  await expect(customDomainMenuItem).toContainText("Custom Domain");
  await expect(customDomainMenuItem).toContainText("Coming Soon");
  await expect(customDomainMenuItem).not.toHaveAttribute("href");
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

  const updatedName = `Undo Alya ${randomUUID().slice(0, 8)}`;
  const firstName = page.getByLabel("Nama pertama");
  await firstName.fill(updatedName);
  if (testInfo.project.name === "mobile-webkit") {
    await page.getByRole("button", { name: "Urungkan perubahan" }).focus();
    await page.keyboard.press("Control+z");
  } else {
    await page.getByRole("button", { name: "Urungkan perubahan" }).click();
  }
  await expect(firstName).toHaveValue("Nara");
  if (testInfo.project.name === "mobile-webkit") {
    await page.getByRole("button", { name: "Ulangi perubahan" }).focus();
    await page.keyboard.press("Control+Shift+z");
  } else {
    await page.getByRole("button", { name: "Ulangi perubahan" }).click();
  }
  await expect(firstName).toHaveValue(updatedName);

  await advanceToStep(page, 3);
  await page.getByRole("button", { name: "Rose" }).click();
  await page.locator(".personalization-control").nth(1).getByRole("button", { name: "Aa Modern" }).click();
  await page.getByRole("button", { name: "Info acara dulu" }).click();
  await page.getByRole("button", { name: "Desktop" }).click();
  await expect(page.getByRole("button", { name: "Desktop" })).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".preview-phone")).toHaveClass(/is-desktop/);
  await page.getByRole("button", { name: "Ponsel" }).click();
  await expect(page.locator(".preview-phone")).not.toHaveClass(/is-desktop/);

  await expect.poll(async () => {
    const response = await page.request.get(`/api/invitations/drafts?id=${invitationId}`);
    if (!response.ok()) return null;
    const result = await response.json() as { draft?: Record<string, unknown> };
    return result.draft;
  }).toMatchObject({ hostOne: updatedName, themeColor: "rose", themeFont: "modern", sectionOrder: "details-first" });
});

test("editor serializes overlapping autosaves without restoring an older draft", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const { email: customerEmail, password: customerPassword } = getCustomerCredentials(testInfo);
  if (!customerEmail || !customerPassword) {
    test.skip(true, "Requires the disposable PostgreSQL customer fixture.");
    return;
  }

  let releaseFirstPatch!: () => void;
  let notifyFirstPatch!: () => void;
  const firstPatchGate = new Promise<void>((resolve) => { releaseFirstPatch = resolve; });
  const firstPatchStarted = new Promise<void>((resolve) => { notifyFirstPatch = resolve; });
  let patchCount = 0;
  let invitationId: string | undefined;
  await page.route("**/api/invitations/*", async (route) => {
    if (route.request().method() !== "PATCH") {
      await route.continue();
      return;
    }

    patchCount += 1;
    if (patchCount === 1) {
      notifyFirstPatch();
      await firstPatchGate;
    }
    const response = await route.fetch();
    await route.fulfill({ response });
  });

  try {
    await signIn(page, customerEmail, customerPassword);
    const creationResponsePromise = page.waitForResponse((response) =>
      response.url().endsWith("/api/invitations/drafts") && response.request().method() === "POST",
    );
    await page.goto("/dashboard/invitations/new/edit?new=1");
    const creationResponse = await creationResponsePromise;
    expect(creationResponse.status()).toBe(201);
    const creation = await creationResponse.json() as { draft?: { id?: string } };
    invitationId = creation.draft?.id;
    expect(invitationId).toMatch(/^[0-9a-f-]{36}$/i);
    if (!invitationId) throw new Error("The customer draft response did not include an invitation ID.");
    await expect(page).toHaveURL(new RegExp(`/dashboard/invitations/${invitationId}/edit$`));

    await firstPatchStarted;
    const updatedName = `Autosave Latest ${randomUUID().slice(0, 8)}`;
    await page.getByLabel("Nama pertama").fill(updatedName);
    await page.waitForTimeout(800);
    expect(patchCount).toBe(1);
  } finally {
    releaseFirstPatch();
  }

  if (!invitationId) throw new Error("The customer draft response did not include an invitation ID.");
  await expect.poll(async () => {
    const response = await page.request.get(`/api/invitations/drafts?id=${invitationId}`);
    if (!response.ok()) return null;
    const result = await response.json() as { draft?: Record<string, unknown> };
    return result.draft;
  }).toMatchObject({ hostOne: expect.stringMatching(/^Autosave Latest /) });
});
