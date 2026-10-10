import { randomUUID } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";
import { Pool } from "pg";
import { getCustomerCredentials } from "./customer-credentials";

const databasePool = process.env.DATABASE_URL ? (() => {
  const databaseUrl = new URL(process.env.DATABASE_URL);
  databaseUrl.searchParams.delete("schema");
  return new Pool({ connectionString: databaseUrl.toString() });
})() : null;

async function signIn(page: Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard(?:\/|$)/);
}

test.afterAll(async () => {
  await databasePool?.end();
});

test("a validated editor form is counted once before checkout", async ({ page }, testInfo) => {
  test.setTimeout(60_000);
  const customer = getCustomerCredentials(testInfo);
  if (!customer.email || !customer.password || !databasePool) {
    test.skip(true, "Requires a disposable PostgreSQL customer fixture.");
    return;
  }

  await signIn(page, customer.email, customer.password);
  const suffix = randomUUID().slice(0, 8);
  const draftResponse = await page.request.post("/api/invitations/drafts", {
    data: {
      slug: `e2e-form-${suffix}`,
      eventKind: "Pernikahan",
      eventTitle: "Undangan Pernikahan",
      hostOne: "Alya",
      hostTwo: "Bima",
      familyDetails: "",
      eventDate: "2027-10-24",
      eventTime: "10:00",
      venue: "The Garden House",
      address: "Jl. Kebun Raya No. 1, Jakarta",
      mapsUrl: "",
      story: "Dengan penuh kebahagiaan, kami mengundangmu.",
      templateId: "royal-gold",
      templateVersion: "1.0.0",
      themeColor: "default",
      themeFont: "classic",
      sectionOrder: "story-first",
      coverPhoto: "",
      coverPosition: 50,
      coverPositionX: 50,
      galleryPhotos: [],
      giftMessage: "",
      giftBankName: "",
      giftAccountName: "",
      giftAccountNumber: "",
      musicUrl: "",
      musicTitle: "",
    },
  });
  expect(draftResponse.status()).toBe(201);
  const draftResult = await draftResponse.json() as { draft?: Record<string, unknown> & { id?: string } };
  const createdDraft = draftResult.draft;
  const invitationId = createdDraft?.id;
  expect(invitationId).toMatch(/^[0-9a-f-]{36}$/i);
  if (!invitationId || !createdDraft) throw new Error("The draft API did not return its invitation details.");

  const saveResponse = await page.request.patch(`/api/invitations/${invitationId}`, { data: createdDraft });
  expect(saveResponse.status()).toBe(200);
  const completedBeforeCheckout = await databasePool.query<{ formCompletedAt: Date | null }>(
    'SELECT "formCompletedAt" FROM invitations WHERE id = $1',
    [invitationId],
  );
  const formCompletedAt = completedBeforeCheckout.rows[0]?.formCompletedAt;
  expect(formCompletedAt).toBeInstanceOf(Date);

  const publishResponse = await page.request.post(`/api/invitations/${invitationId}/publish`);
  expect(publishResponse.status()).toBe(200);
  expect(await publishResponse.json()).toMatchObject({ checkoutUrl: expect.stringMatching(/^https:\/\/checkout\.xendit\.co\/e2e\//) });

  const result = await databasePool.query<{ formCompletedAt: Date | null }>(
    'SELECT "formCompletedAt" FROM invitations WHERE id = $1',
    [invitationId],
  );
  expect(result.rows[0]?.formCompletedAt).toEqual(formCompletedAt);
});
