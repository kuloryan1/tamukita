import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

test("customer registers, verifies email, and recovers access while keeping the selected template", async ({ page, browser }) => {
  test.setTimeout(90_000);
  const suffix = randomUUID().replaceAll("-", "").slice(0, 16);
  const email = `new-customer-${suffix}@tamukita.test`;
  const password = `TamuKita-${randomUUID().slice(0, 12)}`;
  const callbackUrl = "/dashboard/invitations/new/edit?new=1&template=royal-gold";
  await page.setExtraHTTPHeaders({ "x-forwarded-for": `203.0.113.${1 + Math.floor(Math.random() * 253)}` });

  const underageRegistration = await page.request.post("/api/auth/register", {
    data: { name: "Pelanggan Di Bawah Umur", email, password, adultAttested: false },
  });
  expect(underageRegistration.status()).toBe(400);

  await page.goto("/templates/royal-gold");
  await page.getByRole("link", { name: "Gunakan template ini" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("callbackUrl") === callbackUrl);
  let loginRequests = 0;
  await page.route("**/api/auth/callback/credentials", async (route) => {
    loginRequests += 1;
    await route.continue();
  });
  await page.getByRole("button", { name: "Masuk" }).click();
  await expect(page.locator('.editor-error[role="alert"]')).toHaveText("Alamat email wajib diisi.");
  expect(loginRequests).toBe(0);
  await page.getByRole("link", { name: "Daftar" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/register" && url.searchParams.get("callbackUrl") === callbackUrl);
  let registrationRequests = 0;
  await page.route("**/api/auth/register", async (route) => {
    registrationRequests += 1;
    await route.continue();
  });
  await page.getByRole("button", { name: "Buat akun" }).click();
  await expect(page.locator('.editor-error[role="alert"]')).toHaveText("Nama lengkap wajib diisi.");
  expect(registrationRequests).toBe(0);

  await page.getByLabel("Nama lengkap").fill("Pelanggan E2E Baru");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("checkbox", { name: "Saya menyatakan berusia 18 tahun ke atas dan membuat akun ini untuk digunakan sendiri." }).check();
  const registrationResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/register") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Buat akun" }).click();
  const registrationResponse = await registrationResponsePromise;
  expect(registrationResponse.status()).toBe(201);
  expect(await registrationResponse.json()).toMatchObject({ created: true, emailSent: true });
  await expect(page).toHaveURL((url) => url.pathname === "/verify-email" && url.searchParams.get("sent") === "1" && url.searchParams.get("callbackUrl") === callbackUrl);
  await expect(page.getByRole("status")).toContainText("Tautan verifikasi sudah dikirim");

  const emailResponse = await page.request.get(`http://127.0.0.1:3140/messages?to=${encodeURIComponent(email)}`);
  expect(emailResponse.status()).toBe(200);
  const emailBody = await emailResponse.json() as { messages: Array<{ subject: string; text: string }> };
  const verificationMessage = emailBody.messages.find((message) => message.subject === "Konfirmasi email TamuKita");
  expect(verificationMessage).toBeDefined();
  const verificationUrl = verificationMessage?.text.match(/http:\/\/127\.0\.0\.1:\d+\/verify-email\?[^\s]+/)?.[0];
  expect(verificationUrl).toBeDefined();
  if (!verificationUrl) throw new Error("The local email mock did not capture the verification link.");
  const parsedVerificationUrl = new URL(verificationUrl);
  expect(parsedVerificationUrl.searchParams.get("token")).toMatch(/^[A-Za-z0-9_-]{43}$/);
  expect(parsedVerificationUrl.searchParams.get("callbackUrl")).toBe(callbackUrl);

  await page.goto(verificationUrl);
  const confirmationResponsePromise = page.waitForResponse((response) =>
    response.url().endsWith("/api/auth/verify-email/confirm") && response.request().method() === "POST",
  );
  await page.getByRole("button", { name: "Konfirmasi email" }).click();
  const confirmationResponse = await confirmationResponsePromise;
  expect(confirmationResponse.status()).toBe(200);
  expect(await confirmationResponse.json()).toEqual({ verified: true });
  await expect(page.getByRole("status")).toContainText("Alamat email berhasil dikonfirmasi");

  await expect(page.getByRole("link", { name: "Masuk ke akun" })).toHaveAttribute("href", `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  await page.getByRole("link", { name: "Masuk ke akun" }).click();
  await expect(page).toHaveURL((url) => url.pathname === "/login" && url.searchParams.get("callbackUrl") === callbackUrl);
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL((url) => url.pathname === "/dashboard/invitations/new/edit" && url.searchParams.get("new") === "1" && url.searchParams.get("template") === "royal-gold");
  await expect(page.getByRole("heading", { name: "Buat undanganmu" })).toBeVisible();

  const recoveryContext = await browser.newContext({ baseURL: new URL(page.url()).origin });
  const recoveryPage = await recoveryContext.newPage();
  try {
    await recoveryPage.goto(`/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    await recoveryPage.getByRole("link", { name: "Lupa kata sandi?" }).click();
    await expect(recoveryPage).toHaveURL((url) => url.pathname === "/forgot-password" && url.searchParams.get("callbackUrl") === callbackUrl);
    let forgotPasswordRequests = 0;
    await recoveryPage.route("**/api/auth/password/forgot", async (route) => {
      forgotPasswordRequests += 1;
      await route.continue();
    });
    await recoveryPage.getByRole("button", { name: "Kirim tautan pemulihan" }).click();
    await expect(recoveryPage.locator('.editor-error[role="alert"]')).toHaveText("Alamat email wajib diisi.");
    expect(forgotPasswordRequests).toBe(0);
    await recoveryPage.getByLabel("Alamat email").fill(email);
    await recoveryPage.getByRole("button", { name: "Kirim tautan pemulihan" }).click();
    await expect(recoveryPage.getByRole("status")).toContainText("Jika email itu terdaftar, tautan pemulihan akan dikirim");

    const recoveryEmailResponse = await recoveryPage.request.get(`http://127.0.0.1:3140/messages?to=${encodeURIComponent(email)}`);
    expect(recoveryEmailResponse.status()).toBe(200);
    const recoveryEmailBody = await recoveryEmailResponse.json() as { messages: Array<{ subject: string; text: string }> };
    const recoveryMessage = recoveryEmailBody.messages.find((message) => message.subject === "Atur kata sandi TamuKita");
    const recoveryUrl = recoveryMessage?.text.match(/http:\/\/127\.0\.0\.1:\d+\/reset-password\?[^\s]+/)?.[0];
    expect(recoveryUrl).toBeDefined();
    if (!recoveryUrl) throw new Error("The local email mock did not capture the recovery link.");
    expect(new URL(recoveryUrl).searchParams.get("callbackUrl")).toBe(callbackUrl);

    await recoveryPage.goto(recoveryUrl);
    let resetPasswordRequests = 0;
    await recoveryPage.route("**/api/auth/password/reset", async (route) => {
      resetPasswordRequests += 1;
      await route.continue();
    });
    await recoveryPage.getByRole("button", { name: "Simpan kata sandi" }).click();
    await expect(recoveryPage.locator('.editor-error[role="alert"]')).toHaveText("Kata sandi baru wajib diisi.");
    expect(resetPasswordRequests).toBe(0);
    await recoveryPage.getByLabel("Kata sandi baru").fill("TamuKita-Recovery-Password-123");
    await recoveryPage.getByLabel("Ulangi kata sandi").fill("TamuKita-Recovery-Password-123");
    await recoveryPage.getByRole("checkbox", { name: "Saya menyatakan berusia 18 tahun ke atas dan membuat akun ini untuk digunakan sendiri." }).check();
    const resetResponsePromise = recoveryPage.waitForResponse((response) => response.url().endsWith("/api/auth/password/reset") && response.request().method() === "POST");
    await recoveryPage.getByRole("button", { name: "Simpan kata sandi" }).click();
    const resetResponse = await resetResponsePromise;
    expect(resetPasswordRequests).toBe(1);
    expect(resetResponse.status()).toBe(200);
    await expect(recoveryPage.getByRole("status")).toContainText("Kata sandi berhasil diubah");
    await expect(recoveryPage.getByRole("link", { name: "Masuk ke akun" })).toHaveAttribute("href", `/login?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    await recoveryPage.getByRole("link", { name: "Masuk ke akun" }).click();
    await recoveryPage.getByLabel("Alamat email").fill(email);
    await recoveryPage.getByLabel("Kata sandi").fill("TamuKita-Recovery-Password-123");
    await recoveryPage.getByRole("button", { name: "Masuk" }).click();
    await recoveryPage.waitForURL((url) => url.pathname === "/dashboard/invitations/new/edit" && url.searchParams.get("new") === "1" && url.searchParams.get("template") === "royal-gold");
    await expect(recoveryPage.getByRole("heading", { name: "Buat undanganmu" })).toBeVisible();
  } finally {
    await recoveryContext.close();
  }
});
