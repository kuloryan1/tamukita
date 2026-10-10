import { expect, test } from "vitest";
import { createReporterFingerprint } from "@/lib/content-reports";

test("creates a stable keyed fingerprint without storing the reporter address", () => {
  const address = "203.0.113.8";
  const fingerprint = createReporterFingerprint("entry-1", address, "test-secret");

  expect(fingerprint).toMatch(/^[a-f0-9]{64}$/);
  expect(fingerprint).not.toContain(address);
  expect(createReporterFingerprint("entry-1", address, "test-secret")).toBe(fingerprint);
});

test("scopes report deduplication to the entry, address, and secret", () => {
  const fingerprint = createReporterFingerprint("entry-1", "203.0.113.8", "test-secret");

  expect(createReporterFingerprint("entry-2", "203.0.113.8", "test-secret")).not.toBe(fingerprint);
  expect(createReporterFingerprint("entry-1", "203.0.113.9", "test-secret")).not.toBe(fingerprint);
  expect(createReporterFingerprint("entry-1", "203.0.113.8", "rotated-secret")).not.toBe(fingerprint);
});
