import { afterEach, beforeEach, expect, test, vi } from "vitest";

const prismaMock = vi.hoisted(() => ({ membership: { findFirst: vi.fn() }, user: { findUnique: vi.fn() } }));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/prisma", () => ({ getPrismaClient: () => prismaMock }));

import { createInitialDraft } from "@/lib/invitations";
import { invitationCopy } from "@/lib/invitation-copy";
import { getWritableOrganizationId, invitationDraftSchema, normalizeStoredInvitationDraft, parseInvitationDraft } from "@/lib/invitation-server";

beforeEach(() => {
  prismaMock.membership.findFirst.mockReset().mockResolvedValue({ organizationId: "customer-workspace" });
  prismaMock.user.findUnique.mockReset().mockResolvedValue({ platformRole: "CUSTOMER" });
});
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

test("preserves host parent names and canonicalizes the seal monogram through save and publish", () => {
  const apiSchema = invitationDraftSchema.omit({ id: true, updatedAt: true, publishedAt: true, isPublished: true, qaFixture: true });
  const saved = apiSchema.parse({ ...createInitialDraft(), sealMonogram: " nr ", hostOneParents: " Bapak Ali dan Ibu Sari " });
  expect(saved.sealMonogram).toBe("NR");
  expect(saved.hostOneParents).toBe("Bapak Ali dan Ibu Sari");
  expect(saved.hostTwoParents).toBe("");
  const published = JSON.parse(JSON.stringify({ ...saved, id: "73ea210e-c986-4e31-8b44-603812b5b1ac" }));
  expect(parseInvitationDraft(published)?.sealMonogram).toBe("NR");
  expect(parseInvitationDraft(published)?.hostOneParents).toBe("Bapak Ali dan Ibu Sari");
});

test("retains editable copy fields beyond the legacy 32-field normalization limit", () => {
  const customFields = Object.fromEntries(Array.from({ length: 40 }, (_, index) => [`field${index + 1}`, `value${index + 1}`]));
  customFields.scheduleSectionHeading = "Rundown acara";
  customFields.closingNames = "";
  const normalized = normalizeStoredInvitationDraft({ ...createInitialDraft(), customFields }, {
    id: "73ea210e-c986-4e31-8b44-603812b5b1ac",
    slug: "wulan-dan-ryan",
    updatedAt: "2026-11-08T05:17:25.187Z",
    isPublished: true,
  });

  expect(normalized?.customFields.field40).toBe("value40");
  expect(normalized?.customFields.scheduleSectionHeading).toBe("Rundown acara");
  expect(normalized?.customFields.closingNames).toBe("");
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

  expect(parseInvitationDraft(fixture) !== null).toBe(true);
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

test("normalizes a legacy sample draft so cleared cover and invitation copy stays empty publicly", () => {
  vi.stubEnv("NEXT_PUBLIC_APP_URL", "https://tamukita.io");
  const legacyDraft = {
    ...createInitialDraft(),
    slug: undefined,
    id: undefined,
    templateId: "elegant-cream",
    coverPhoto: "/templates/elegant-cream/wulan-dan-ryan-couple.webp",
    story: "",
    customFields: {
      recipientGreeting: "Kepada Yth.",
      coverMessage: "",
      invitationHeadline: "",
    },
    familyDetails: undefined,
    hostOneParents: undefined,
    hostTwoParents: undefined,
    hostOnePhoto: undefined,
    hostTwoPhoto: undefined,
    coverPositionX: undefined,
    galleryPhotos: undefined,
    eventSchedule: undefined,
    giftMessage: undefined,
    musicUrl: undefined,
    musicTitle: undefined,
  };
  const normalizedDraft = normalizeStoredInvitationDraft(legacyDraft, {
    id: "aa342692-9bc0-4a73-87b0-8540e8adc36f",
    slug: "wulan-dan-ryan",
    updatedAt: "2026-11-08T05:17:25.187Z",
    isPublished: true,
  });
  const parsedDraft = normalizedDraft ? parseInvitationDraft(normalizedDraft) : null;

  expect(parsedDraft).not.toBeNull();
  expect(parsedDraft?.story).toBe("");
  expect(parsedDraft && invitationCopy(parsedDraft, "invitationHeadline", "Dengan penuh sukacita, kami mengundang Anda.")).toBe("");
  expect(parsedDraft && invitationCopy(parsedDraft, "coverMessage", "Dengan penuh sukacita, kami mengundang Anda.")).toBe("");
});
