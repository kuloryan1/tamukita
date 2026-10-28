import { describe, expect, it } from "vitest";
import { getSafePostLoginPath, withPostLoginCallback } from "@/lib/auth-redirect";

describe("getSafePostLoginPath", () => {
  it("preserves an internal editor destination and its selected template", () => {
    const path = "/dashboard/invitations/new/edit?new=1&template=royal-gold";
    expect(getSafePostLoginPath(path)).toBe(path);
  });

  it("adds a safe callback to account actions", () => {
    const callbackUrl = "/dashboard/invitations/new/edit?new=1&template=royal-gold";
    expect(withPostLoginCallback("/register", callbackUrl)).toBe(`/register?callbackUrl=${encodeURIComponent(callbackUrl)}`);
    expect(withPostLoginCallback("/forgot-password", callbackUrl)).toBe(`/forgot-password?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  });

  it("leaves direct account actions free of a fallback callback", () => {
    expect(withPostLoginCallback("/register", undefined)).toBe("/register");
  });

  it.each([
    "https://example.com/steal-session",
    "//example.com/steal-session",
    "/\\\\example.com/steal-session",
    "/%2f%2fexample.com/steal-session",
    "/bad%encoding",
    "",
    undefined,
    ["/dashboard"],
  ])("falls back to the dashboard for unsafe callback %j", (value) => {
    expect(getSafePostLoginPath(value)).toBe("/dashboard");
  });
});
