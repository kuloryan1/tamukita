import { expect, test } from "@playwright/test";
import { getCustomerCredentials } from "./customer-credentials";

type AccountExportPayload = {
  data: { account: { email: string | null }; invitations: unknown[] };
  exclusions: string[];
};

test("customer can request a private account data export", async ({ page }, testInfo) => {
  const { email, password } = getCustomerCredentials(testInfo);
  if (!email || !password) {
    test.skip(true, "Requires the disposable PostgreSQL customer fixture.");
    return;
  }

  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard(?:\/|$)/);
  await page.goto("/dashboard/privacy");
  await expect(page.getByRole("heading", { name: "Data & privasi" })).toBeVisible();

  const exportLink = page.getByRole("link", { name: "Unduh data akun (JSON)" });
  await expect(exportLink).toHaveAttribute("href", "/api/account/export");
  let payload: AccountExportPayload;
  if (testInfo.project.name === "mobile-webkit") {
    const response = await page.evaluate(async () => {
      const result = await fetch("/api/account/export");
      return {
        status: result.status,
        contentType: result.headers.get("content-type"),
        contentDisposition: result.headers.get("content-disposition"),
        payload: await result.json(),
      };
    });
    expect(response.status).toBe(200);
    expect(response.contentType).toContain("application/json");
    expect(response.contentDisposition).toMatch(/^attachment; filename="tamukita-account-data-\d{4}-\d{2}-\d{2}\.json"$/);
    payload = response.payload as AccountExportPayload;
  } else {
    const downloadPromise = page.waitForEvent("download");
    await exportLink.click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toMatch(/^tamukita-account-data-\d{4}-\d{2}-\d{2}\.json$/);
    const stream = await download.createReadStream();
    if (!stream) throw new Error("The account export download stream is unavailable.");
    const chunks: Buffer[] = [];
    for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    payload = JSON.parse(Buffer.concat(chunks).toString("utf8")) as AccountExportPayload;
  }
  expect(payload.data.account.email).toBe(email);
  expect(payload.data.invitations).toBeInstanceOf(Array);
  expect(payload.exclusions.join(" ")).toContain("Respons RSVP");
});
