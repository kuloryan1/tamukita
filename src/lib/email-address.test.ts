import { afterEach, expect, test, vi } from "vitest";
import { isReservedNonDeliverableEmailAddress } from "@/lib/email-address";

vi.mock("server-only", () => ({}));

import { sendTransactionalEmail } from "@/lib/email";

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

test("recognizes fixture recipients on the reserved .invalid domain", () => {
  expect(isReservedNonDeliverableEmailAddress("qa-fixture@tamukita.invalid")).toBe(true);
  expect(isReservedNonDeliverableEmailAddress("qa-fixture@EXAMPLE.INVALID")).toBe(true);
  expect(isReservedNonDeliverableEmailAddress("qa-fixture@sub.example.invalid")).toBe(true);
});

test("does not reject deliverable domains that only contain invalid as a label", () => {
  expect(isReservedNonDeliverableEmailAddress("qa@example.com")).toBe(false);
  expect(isReservedNonDeliverableEmailAddress("qa@invalid.example.com")).toBe(false);
  expect(isReservedNonDeliverableEmailAddress("qa@example.invalid.evil.com")).toBe(false);
});

test("does not call the email provider for reserved fixture recipients", async () => {
  vi.stubEnv("RESEND_API_KEY", "local-test-key");
  vi.stubEnv("EMAIL_FROM", "TamuKita test <qa@example.com>");
  const fetchSpy = vi.spyOn(globalThis, "fetch");

  await expect(sendTransactionalEmail({
    to: "qa-fixture@tamukita.invalid",
    subject: "Fixture RSVP",
    text: "Test only",
    html: "<p>Test only</p>",
  })).resolves.toBe(false);

  expect(fetchSpy).not.toHaveBeenCalled();
});
