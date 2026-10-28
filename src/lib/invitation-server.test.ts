import { afterEach, beforeEach, expect, test, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ membership: { findFirst: vi.fn() } }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ getPrismaClient: () => prismaMock }));

import { createInitialDraft } from "@/lib/invitations";
import { getWritableOrganizationId, invitationDraftSchema, parseInvitationDraft } from "@/lib/invitation-server";

beforeEach(() => prismaMock.membership.findFirst.mockReset().mockResolvedValue({ organizationId: "customer-workspace" }));
afterEach(() => vi.unstubAllEnvs());

test("selects an active personal workspace for a customer's self-service draft", async () => {
  await expect(getWritableOrganizationId("customer-user")).resolves.toBe("customer-workspace");

  expect(prismaMock.membership.findFirst).toHaveBeenCalledWith({
    where: {
      userId: "customer-user",
      role: { in: ["OWNER", "ADMIN", "EDITOR"] },
      organization: { type: "PERSONAL", status: "ACTIVE" },
    },
    orderBy: { createdAt: "asc" },
    select: { organizationId: true },
  });
});

test("does not create a self-service draft in a reseller workspace", async () => {
  prismaMock.membership.findFirst.mockResolvedValue(null);

  await expect(getWritableOrganizationId("reseller-only-user")).resolves.toBeNull();
  expect(prismaMock.membership.findFirst.mock.calls[0]?.[0]?.where.organization).toEqual({ type: "PERSONAL", status: "ACTIVE" });
});

test("preserves and canonicalizes the seal monogram through the draft API payload and published snapshot", () => {
  const apiSchema = invitationDraftSchema.omit({ id: true, updatedAt: true, publishedAt: true, isPublished: true, qaFixture: true });
  const saved = apiSchema.parse({ ...createInitialDraft(), sealMonogram: " nr " });
  expect(saved.sealMonogram).toBe("NR");
  const published = JSON.parse(JSON.stringify({ ...saved, id: "73ea210e-c986-4e31-8b44-603812b5b1ac" }));
  expect(parseInvitationDraft(published)?.sealMonogram).toBe("NR");
});

test("keeps older snapshots compatible with automatic initials and rejects unsupported seal letters", () => {
  const snapshot = { ...createInitialDraft(), id: "73ea210e-c986-4e31-8b44-603812b5b1ac", sealMonogram: undefined };
  expect(parseInvitationDraft(snapshot)?.sealMonogram).toBe("");
  for (const sealMonogram of ["ABCD", "N1", "N&R", "<N>"]) {
    expect(invitationDraftSchema.safeParse({ ...snapshot, sealMonogram }).success).toBe(false);
  }
});

test("parses the synthetic cover only for the marked staging QA invitation", () => {
  const fixture = {
    ...createInitialDraft(),
    id: "73ea210e-c986-4e31-8b44-603812b5b1ac",
    slug: "qa-blueprint-fixture",
    coverPhoto: "https://staging.tamukita.io/qa-fixtures/couple-cover.webp",
    qaFixture: true,
  };
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://staging.tamukita.io");

  expect(parseInvitationDraft(fixture)).not.toBeNull();
  expect(parseInvitationDraft({ ...fixture, slug: "another-invitation" })).toBeNull();
  expect(parseInvitationDraft({ ...fixture, qaFixture: false })).toBeNull();
});

test("rejects the staging QA cover in non-staging environments", () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://tamukita.io");
  const fixture = {
    ...createInitialDraft(),
    id: "73ea210e-c986-4e31-8b44-603812b5b1ac",
    slug: "qa-blueprint-fixture",
    coverPhoto: "https://staging.tamukita.io/qa-fixtures/couple-cover.webp",
    qaFixture: true,
  };

  expect(parseInvitationDraft(fixture)).toBeNull();
});
