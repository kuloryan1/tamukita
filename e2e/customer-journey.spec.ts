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

test("customer creates, autosaves, and restores a draft without exposing it to another account", async ({ page, browser }, testInfo) => {
  test.setTimeout(90_000);
  const { email: customerEmail, password: customerPassword } = getCustomerCredentials(testInfo);
  const otherCustomerEmail = process.env.E2E_OTHER_CUSTOMER_EMAIL;
  const otherCustomerPassword = process.env.E2E_OTHER_CUSTOMER_PASSWORD;
  if (!customerEmail || !customerPassword || !otherCustomerEmail || !otherCustomerPassword) {
    test.skip(true, "Requires the disposable PostgreSQL customer fixtures.");
    return;
  }

  await signIn(page, customerEmail, customerPassword);
  const initialSaveResponsePromise = page.waitForResponse((response) =>
    /\/api\/invitations\/[0-9a-f-]{36}$/i.test(new URL(response.url()).pathname) && response.request().method() === "PATCH",
  );
  const creationResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/invitations/drafts") && response.request().method() === "POST",
  );
  await page.goto("/dashboard/invitations/new/edit?new=1");
  const creationResponse = await creationResponsePromise;
  expect(creationResponse.status()).toBe(201);
  expect((await initialSaveResponsePromise).status()).toBe(200);
  const creationResult = await creationResponse.json() as { draft?: { id?: string } };
  const invitationId = creationResult.draft?.id;
  expect(invitationId).toMatch(/^[0-9a-f-]{36}$/i);
  if (!invitationId) throw new Error("The customer draft response did not include an invitation ID.");

  const firstName = `Alya ${randomUUID().slice(0, 8)}`;
  const secondName = `Bima ${randomUUID().slice(0, 8)}`;
  await expect(page.getByRole("heading", { name: "Buat undanganmu" })).toBeVisible();
  const saveResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith(`/api/invitations/${invitationId}`) && response.request().method() === "PATCH",
  );
  await page.getByLabel("Nama pertama").fill(firstName);
  await page.getByLabel("Nama kedua").fill(secondName);
  const saveResponse = await saveResponsePromise;
  expect(saveResponse.status()).toBe(200);
  await expect.poll(async () => {
    const response = await page.request.get(`/api/invitations/drafts?id=${invitationId}`);
    if (!response.ok()) return null;
    const result = await response.json() as { draft?: Record<string, unknown> | null };
    return result.draft;
  }, { timeout: 15_000 }).toMatchObject({ id: invitationId, hostOne: firstName, hostTwo: secondName });

  await page.goto(`/dashboard/invitations/${invitationId}/edit`);
  await expect(page.getByLabel("Nama pertama")).toHaveValue(firstName);
  await expect(page.getByLabel("Nama kedua")).toHaveValue(secondName);

  const ownerRead = await page.request.get(`/api/invitations/drafts?id=${invitationId}`);
  expect(ownerRead.status()).toBe(200);
  const ownerReadResult = await ownerRead.json() as { draft?: Record<string, unknown> | null };
  expect(ownerReadResult.draft).toMatchObject({ id: invitationId, hostOne: firstName, hostTwo: secondName });

  const otherContext = await browser.newContext({ baseURL: new URL(page.url()).origin, viewport: page.viewportSize() ?? undefined });
  try {
    const otherPage = await otherContext.newPage();
    await signIn(otherPage, otherCustomerEmail, otherCustomerPassword);

    const otherRead = await otherPage.request.get(`/api/invitations/drafts?id=${invitationId}`);
    expect(otherRead.status()).toBe(200);
    expect(await otherRead.json()).toEqual({ draft: null });

    const otherUpdate = await otherPage.request.patch(`/api/invitations/${invitationId}`, { data: ownerReadResult.draft });
    expect(otherUpdate.status()).toBe(404);
  } finally {
    await otherContext.close();
  }
});
