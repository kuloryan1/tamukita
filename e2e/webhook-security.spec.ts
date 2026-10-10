import { expect, test } from "@playwright/test";

test("Xendit webhook validates its callback token and safely ignores unknown events", async ({ request }) => {
  const token = process.env.E2E_XENDIT_WEBHOOK_TOKEN;
  if (!token) {
    test.skip(true, "Requires the disposable E2E webhook token.");
    return;
  }

  const invalidTokenResponse = await request.post("/api/webhooks/xendit", {
    headers: { "x-callback-token": "invalid-e2e-token" },
    data: { event: "unknown.event", data: {} },
  });
  expect(invalidTokenResponse.status()).toBe(401);

  const unknownEventResponse = await request.post("/api/webhooks/xendit", {
    headers: { "x-callback-token": token },
    data: { event: "unknown.event", data: {} },
  });
  expect(unknownEventResponse.status()).toBe(200);
  expect(await unknownEventResponse.json()).toEqual({ received: true, ignored: true });
});
