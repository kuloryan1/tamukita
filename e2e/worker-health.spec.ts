import { expect, test } from "@playwright/test";

test("health check includes the running background worker", async ({ request }) => {
  await expect.poll(async () => {
    const response = await request.get("/api/health");
    return response.status();
  }).toBe(200);

  const response = await request.get("/api/health");
  expect(await response.json()).toEqual({
    status: "ok",
    dependencies: { database: "ok", redis: "ok", worker: "ok" },
  });
});
