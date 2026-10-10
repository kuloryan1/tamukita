import { expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { getRequestAddress } from "@/lib/rate-limit";

test("uses the final proxy-appended IPv4 address, not a client-supplied first hop", () => {
  const request = new Request("https://example.test/api", {
    headers: {
      "x-forwarded-for": "203.0.113.80, 198.51.100.42",
      "x-real-ip": "192.0.2.200",
    },
  });

  expect(getRequestAddress(request)).toBe("198.51.100.42");
});

test("accepts IPv6 from the final forwarded hop", () => {
  const request = new Request("https://example.test/api", {
    headers: { "x-forwarded-for": "203.0.113.80, 2001:db8::42" },
  });

  expect(getRequestAddress(request)).toBe("2001:db8::42");
});

test("does not trust x-real-ip or an invalid final forwarded hop", () => {
  const withoutForwardedFor = new Request("https://example.test/api", {
    headers: { "x-real-ip": "198.51.100.42" },
  });
  const invalidForwardedFor = new Request("https://example.test/api", {
    headers: {
      "x-forwarded-for": "198.51.100.42, attacker-controlled",
      "x-real-ip": "203.0.113.80",
    },
  });

  expect(getRequestAddress(withoutForwardedFor)).toBe("unknown");
  expect(getRequestAddress(invalidForwardedFor)).toBe("unknown");
});
