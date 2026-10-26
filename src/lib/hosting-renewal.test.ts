import { expect, test } from "vitest";
import { canRenewHosting, hostingRenewalDeadline } from "@/lib/hosting-renewal";

const now = new Date("2026-10-26T00:00:00.000Z");

test("opens hosting renewal 30 days before expiry", () => {
  expect(canRenewHosting(new Date("2026-11-25T00:00:00.000Z"), now)).toBe(true);
  expect(canRenewHosting(new Date("2026-11-25T00:00:00.001Z"), now)).toBe(false);
});

test("keeps hosting renewal open for 30 days after expiry", () => {
  expect(canRenewHosting(new Date("2026-10-01T00:00:00.000Z"), now)).toBe(true);
  expect(canRenewHosting(new Date("2026-09-26T00:00:00.000Z"), now)).toBe(false);
});

test("closes hosting renewal at its retention deadline", () => {
  const expiry = new Date("2026-10-01T00:00:00.000Z");
  const deadline = hostingRenewalDeadline(expiry);

  expect(deadline.toISOString()).toBe("2026-10-31T00:00:00.000Z");
  expect(canRenewHosting(expiry, new Date("2026-10-30T23:59:59.999Z"))).toBe(true);
  expect(canRenewHosting(expiry, deadline)).toBe(false);
});
