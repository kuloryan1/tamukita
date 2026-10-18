import { describe, expect, it } from "vitest";
import { getProductionHostnames, normalizeHostname } from "../../tests/load/production-hostnames.js";

describe("production hostname guard", () => {
  it("always blocks the blueprint production apex and www host", () => {
    const hosts = getProductionHostnames();

    expect(hosts.has("tamukita.io")).toBe(true);
    expect(hosts.has("www.tamukita.io")).toBe(true);
  });

  it("adds configured bare hostnames after normalizing case and trailing dots", () => {
    const hosts = getProductionHostnames(" PROD.TAMUKITA.IO , api.tamukita.io. ");

    expect(hosts.has("prod.tamukita.io")).toBe(true);
    expect(hosts.has("api.tamukita.io")).toBe(true);
    expect(normalizeHostname("TAMUKITA.IO...")).toBe("tamukita.io");
  });

  it("rejects URLs, ports, and wildcard entries", () => {
    expect(() => getProductionHostnames("https://tamukita.io")).toThrow(/bare DNS hostnames/);
    expect(() => getProductionHostnames("tamukita.io:443")).toThrow(/bare DNS hostnames/);
    expect(() => getProductionHostnames("*.tamukita.io")).toThrow(/bare DNS hostnames/);
  });
});
