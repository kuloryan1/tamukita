import { describe, expect, it } from "vitest";
import { getSafePostLoginPath } from "@/lib/auth-redirect";

describe("getSafePostLoginPath", () => {
  it("preserves an internal editor destination and its selected template", () => {
    const path = "/dashboard/invitations/new/edit?new=1&template=royal-gold";
    expect(getSafePostLoginPath(path)).toBe(path);
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
