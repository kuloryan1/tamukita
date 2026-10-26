import { beforeEach, describe, expect, it, vi } from "vitest";

const { authMock, allowRequestMock, prismaMock } = vi.hoisted(() => ({
  authMock: vi.fn(),
  allowRequestMock: vi.fn(),
  prismaMock: {
    user: { findUnique: vi.fn() },
    membership: { findMany: vi.fn() },
    invitation: { findMany: vi.fn() },
    order: { findMany: vi.fn() },
    refund: { findMany: vi.fn() },
    editorFeedback: { findMany: vi.fn() },
  },
}));

vi.mock("@/auth", () => ({ auth: authMock }));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: allowRequestMock }));
vi.mock("@/lib/prisma", () => ({ getPrismaClient: () => prismaMock }));

import { GET } from "./route";

describe("GET /api/account/export", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authMock.mockResolvedValue({ user: { id: "user-1" } });
    allowRequestMock.mockResolvedValue(true);
    prismaMock.user.findUnique.mockResolvedValue({
      name: "Ayu",
      email: "ayu@example.test",
      emailVerified: new Date("2026-01-02T00:00:00.000Z"),
      image: null,
      adultAttestedAt: new Date("2026-01-02T00:00:00.000Z"),
      adultAttestationVersion: "18plus-v1",
      createdAt: new Date("2026-01-01T00:00:00.000Z"),
      updatedAt: new Date("2026-01-02T00:00:00.000Z"),
      accounts: [{ type: "oauth", provider: "example", providerAccountId: "provider-user-1", access_token: "provider-token-must-not-export" }],
      passwordHash: "must-not-export",
    });
    prismaMock.membership.findMany.mockResolvedValue([]);
    prismaMock.invitation.findMany.mockResolvedValue([]);
    prismaMock.order.findMany.mockResolvedValue([]);
    prismaMock.refund.findMany.mockResolvedValue([]);
    prismaMock.editorFeedback.findMany.mockResolvedValue([]);
  });

  it("requires an authenticated account before reading user data", async () => {
    authMock.mockResolvedValue(null);

    const response = await GET();

    expect(response.status).toBe(401);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });

  it("returns a private download without authentication secrets or guest responses", async () => {
    const response = await GET();
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(response.headers.get("content-disposition")).toMatch(/attachment; filename="tamukita-account-data-\d{4}-\d{2}-\d{2}\.json"/);
    expect(body).toContain("ayu@example.test");
    expect(body).toContain("provider-user-1");
    expect(body).not.toContain("must-not-export");
    expect(body).not.toContain("provider-token-must-not-export");
    expect(body).not.toContain("access_token");
    expect(body).not.toContain("sessionToken");
    expect(body).not.toContain("guestbook");
    expect(body).not.toContain("rsvps");
  });

  it("rate limits repeated downloads", async () => {
    allowRequestMock.mockResolvedValue(false);

    const response = await GET();

    expect(response.status).toBe(429);
    expect(prismaMock.user.findUnique).not.toHaveBeenCalled();
  });
});
