import { describe, expect, it } from "vitest";
import { isCustomerRegistrationOpen } from "@/lib/registration-policy";

describe("customer registration policy", () => {
  it("closes registration on the production host", () => {
    expect(isCustomerRegistrationOpen("https://tamukita.io", "production")).toBe(false);
    expect(isCustomerRegistrationOpen("https://www.tamukita.io", "production")).toBe(false);
  });

  it("keeps staging and local registration available", () => {
    expect(isCustomerRegistrationOpen("https://staging.tamukita.io", "production")).toBe(true);
    expect(isCustomerRegistrationOpen("http://127.0.0.1:3000", "development")).toBe(true);
  });

  it("fails closed when a production origin is missing or malformed", () => {
    expect(isCustomerRegistrationOpen(undefined, "production")).toBe(false);
    expect(isCustomerRegistrationOpen("not a url", "production")).toBe(false);
  });
});
