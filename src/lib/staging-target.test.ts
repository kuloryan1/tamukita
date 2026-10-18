import { describe, expect, it, vi } from "vitest";
import { createStagingInvitationTarget, verifyPublishedStagingInvitation } from "../../tests/load/staging-target.js";

const publishedHtml = '<main data-invitation-publication="published"></main>';

describe("staging invitation target validation", () => {
  it("builds a same-origin URL for a published invitation path", () => {
    const target = createStagingInvitationTarget({
      baseUrl: "https://staging.tamukita.io",
      invitationPath: "/qa-blueprint-fixture",
    });

    expect(target.origin).toBe("https://staging.tamukita.io");
    expect(target.invitationUrl.href).toBe("https://staging.tamukita.io/qa-blueprint-fixture");
  });

  it("requires an HTTPS origin without a path or credentials", () => {
    expect(() => createStagingInvitationTarget({
      baseUrl: "http://staging.tamukita.io",
      invitationPath: "/qa-blueprint-fixture",
    })).toThrow(/HTTPS origin/);

    expect(() => createStagingInvitationTarget({
      baseUrl: "https://user:password@staging.tamukita.io",
      invitationPath: "/qa-blueprint-fixture",
    })).toThrow(/without credentials/);
  });

  it("blocks the configured production hostnames", () => {
    expect(() => createStagingInvitationTarget({
      baseUrl: "https://staging.tamukita.io",
      invitationPath: "/qa-blueprint-fixture",
      productionHostnames: "staging.tamukita.io",
    })).toThrow(/production host/);
  });

  it("rejects invitation paths that can escape the staging origin", () => {
    expect(() => createStagingInvitationTarget({
      baseUrl: "https://staging.tamukita.io",
      invitationPath: "//tamukita.io/ryan",
    })).toThrow(/same-origin published invitation path/);
  });

  it("accepts only a direct HTTP 200 with a server-rendered published marker", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(publishedHtml, { status: 200 }));

    await expect(verifyPublishedStagingInvitation({
      baseUrl: "https://staging.tamukita.io",
      invitationPath: "/qa-blueprint-fixture",
      fetchImpl,
    })).resolves.toEqual(new URL("https://staging.tamukita.io/qa-blueprint-fixture"));

    expect(fetchImpl).toHaveBeenCalledWith(new URL("https://staging.tamukita.io/qa-blueprint-fixture"), expect.objectContaining({ redirect: "manual" }));
  });

  it("rejects redirects, built-in demos, and missing publication markers", async () => {
    const target = { baseUrl: "https://staging.tamukita.io", invitationPath: "/qa-blueprint-fixture" };

    await expect(verifyPublishedStagingInvitation({
      ...target,
      fetchImpl: vi.fn().mockResolvedValue(new Response("redirect", { status: 302 })),
    })).rejects.toThrow(/HTTP 200 without redirects/);

    await expect(verifyPublishedStagingInvitation({
      ...target,
      fetchImpl: vi.fn().mockResolvedValue(new Response('<main data-invitation-publication="demo"></main>', { status: 200 })),
    })).rejects.toThrow(/built-in demo/);

    await expect(verifyPublishedStagingInvitation({
      ...target,
      fetchImpl: vi.fn().mockResolvedValue(new Response("<main>unmarked page</main>", { status: 200 })),
    })).rejects.toThrow(/server-rendered published invitation/);
  });
});
