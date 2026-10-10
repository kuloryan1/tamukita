import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("customer registers, verifies email, and signs in without sending mail externally", async ({ page }) => {
  test.setTimeout(60_000);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const email = `new-customer-${suffix}@tamukita.test`;
  const password = `TamuKita-${randomUUID().slice(0, 12)}`;
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `203.0.113.${1 + Math.floor(Math.random() * 253)}` });

  await page.goto("/register");
  await page.getByLabel("Nama lengkap").fill("Pelanggan E2E Baru");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  const registrationResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/register") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Buat akun" }).click();
  const registrationResponse = await registrationResponsePromise;
  expect(registrationResponse.status()).toBe(201);
  expect(await registrationResponse.json()).toMatchObject({ created: true, emailSent: true });
  await expect(page).toHaveURL(/\/verify-email\?sent=1$/);
  await expect(page.getByRole("status")).toContainText("Tautan verifikasi sudah dikirim");

  const emailResponse = await page.request.get(`http://127.0.0.1:3140/messages?to=${encodeURIComponent(email)}`);
  expect(emailResponse.status()).toBe(200);
  const emailBody = await emailResponse.json() as { messages: Array<{ subject: string; text: string }> };
  const verificationMessage = emailBody.messages.find((message) => message.subject === "Konfirmasi email TamuKita");
  expect(verificationMessage).toBeDefined();
  const verificationUrl = verificationMessage?.text.match(/http:\/\/127\.0\.0\.1:\d+\/verify-email\?token=[A-Za-z0-9_-]{43}/)?.[0];
  expect(verificationUrl).toBeDefined();
  if (!verificationUrl) throw new Error("The local email mock did not capture the verification link.");

  await page.goto(verificationUrl);
  const confirmationResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/verify-email/confirm") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Konfirmasi email" }).click();
  const confirmationResponse = await confirmationResponsePromise;
  expect(confirmationResponse.status()).toBe(200);
  expect(await confirmationResponse.json()).toEqual({ verified: true });
  await expect(page.getByRole("status")).toContainText("Alamat email berhasil dikonfirmasi");

  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard(?:\/|$)/);
  await expect(page.getByRole("heading", { name: /selamat datang, pelanggan e2e baru/i })).toBeVisible();
});
