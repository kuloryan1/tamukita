import { randomUUID } from "node:crypto";
import { expect, test } from "@playwright/test";

function templateManifest(slug: string, version: string, name: string) {
  return {
    slug,
    version,
    schemaVersion: 1,
    activationSku: "BASIC_ACTIVATION",
    name,
    subtitle: "Uji alur review",
    description: "Template khusus untuk memastikan proses review dan publikasi marketplace berjalan.",
    category: "Pernikahan",
    price: 99000,
    style: "sage",
    tags: ["E2E", "Review"],
    features: ["cover", "gallery", "maps", "rsvp", "whatsapp-share"],
    schema: {
      schemaVersion: 1,
      sections: [
        {
          key: "identity",
          label: "Informasi acara",
          fields: [
            { key: "eventTitle", type: "text", label: "Judul acara", required: true },
            { key: "hostOne", type: "text", label: "Nama pertama" },
            { key: "hostTwo", type: "text", label: "Nama kedua" },
            { key: "story", type: "textarea", label: "Cerita singkat" },
          ],
        },
        {
          key: "schedule",
          label: "Tanggal dan tempat",
          fields: [
            { key: "eventDate", type: "datetime", label: "Tanggal acara", required: true },
            { key: "eventTime", type: "time", label: "Waktu acara", required: true },
            { key: "venue", type: "text", label: "Nama tempat", required: true },
            { key: "address", type: "textarea", label: "Alamat", required: true },
            { key: "mapsUrl", type: "url", label: "Tautan Google Maps" },
          ],
        },
        {
          key: "media",
          label: "Foto undangan",
          fields: [{ key: "coverPhoto", type: "image", label: "Foto sampul", aspectRatio: "3:4", editable: true }],
        },
      ],
    },
  };
}

async function signIn(page: import("@playwright/test").Page, email: string, password: string) {
  await page.goto("/login");
  await page.getByLabel("Alamat email").fill(email);
  await page.getByLabel("Kata sandi").fill(password);
  await page.getByRole("button", { name: "Masuk" }).click();
  await page.waitForURL(/\/dashboard(?:\/|$)/);
}

test("developer submits a template, admin publishes it, and old versions stay active until review", async ({ page, browser }, testInfo) => {
  const developerEmail = process.env.E2E_TEMPLATE_DEVELOPER_EMAIL;
  const developerPassword = process.env.E2E_TEMPLATE_DEVELOPER_PASSWORD;
  const adminEmail = process.env.E2E_ADMIN_EMAIL;
  const adminPassword = process.env.E2E_ADMIN_PASSWORD;
  if (!developerEmail || !developerPassword || !adminEmail || !adminPassword) {
    test.skip(true, "Requires disposable developer, admin, and PostgreSQL E2E fixtures.");
    return;
  }

  const suffix = randomUUID().slice(0, 8);
  const slug = `e2e-review-${suffix}`;
  const firstName = "E2E Review Template";
  const secondName = "E2E Review Template Baru";

  await signIn(page, developerEmail, developerPassword);
  const baseURL = new URL(page.url()).origin;
  const submissionResponse = await page.request.post("/api/developer/templates", {
    data: { manifest: templateManifest(slug, "1.0.0", firstName) },
  });
  expect(submissionResponse.status()).toBe(201);
  const submission = await submissionResponse.json() as { template?: { id: string; slug: string; status: string } };
  expect(submission.template).toMatchObject({ slug, status: "IN_REVIEW" });
  if (!submission.template) throw new Error("The developer submission did not return a template.");

  const isMobileProject = testInfo.project.name.startsWith("mobile-");
  const adminContext = await browser.newContext({
    baseURL,
    viewport: page.viewportSize() ?? undefined,
    ...(isMobileProject ? { isMobile: true, hasTouch: true } : {}),
  });
  try {
    const adminPage = await adminContext.newPage();
    const publicPage = await adminContext.newPage();
    await signIn(adminPage, adminEmail, adminPassword);
    await adminPage.goto("/admin/templates");
    const templateRow = adminPage.locator(".admin-template-row").filter({ hasText: slug });
    await expect(templateRow).toContainText("Menunggu review");

    const firstPublishResponse = adminPage.waitForResponse((response) =>
      response.url().endsWith(`/api/admin/templates/${submission.template?.id}`) && response.request().method() === "PATCH",
    );
    await templateRow.getByRole("button", { name: "Terbitkan" }).click();
    expect((await firstPublishResponse).status()).toBe(200);
    await expect(templateRow).toContainText("Terbit");

    await publicPage.goto(`/templates/${slug}`);
    await expect(publicPage.getByRole("heading", { level: 1, name: firstName })).toBeVisible();

    const updateResponse = await page.request.patch("/api/developer/templates", {
      data: { templateId: submission.template.id, manifest: templateManifest(slug, "1.1.0", secondName) },
    });
    expect(updateResponse.status()).toBe(200);
    expect(await updateResponse.json()).toMatchObject({ submitted: true, template: { status: "UPDATE_IN_REVIEW", version: "1.1.0" } });

    await adminPage.goto("/admin/templates");
    await expect(templateRow).toContainText("Versi baru menunggu review");
    await publicPage.goto(`/templates/${slug}`);
    await expect(publicPage.getByRole("heading", { level: 1, name: firstName })).toBeVisible();

    await adminPage.goto("/admin/templates");
    await expect(templateRow).toContainText("Versi baru menunggu review");
    const updatePublishResponse = adminPage.waitForResponse((response) =>
      response.url().endsWith(`/api/admin/templates/${submission.template?.id}`) && response.request().method() === "PATCH",
    );
    await templateRow.getByRole("button", { name: "Terapkan versi baru" }).click();
    expect((await updatePublishResponse).status()).toBe(200);
    await expect(templateRow).toContainText("v1.1.0");
    await publicPage.goto(`/templates/${slug}`);
    await expect(publicPage.getByRole("heading", { level: 1, name: secondName })).toBeVisible();

    const developerTemplatesResponse = await page.request.get("/api/developer/templates");
    expect(developerTemplatesResponse.status()).toBe(200);
    const developerTemplates = await developerTemplatesResponse.json() as { templates?: Array<{ slug: string; status: string; version: string }> };
    expect(developerTemplates.templates?.find((template) => template.slug === slug)).toMatchObject({ status: "PUBLISHED", version: "1.1.0" });
  } finally {
    await adminContext.close();
  }
});
