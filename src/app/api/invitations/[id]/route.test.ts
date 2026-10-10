import { beforeEach, expect, test, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  auth: vi.fn(),
  findFirst: vi.fn(),
  ensureTemplateVersion: vi.fn(),
  safeParse: vi.fn(),
  readJsonBody: vi.fn(),
}));

vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ getPrismaClient: () => ({ invitation: { findFirst: mocks.findFirst } }) }));
vi.mock("@/lib/invitation-server", () => ({
  ensureTemplateVersion: mocks.ensureTemplateVersion,
  eventStartsAt: vi.fn(),
  invitationDraftSchema: { omit: () => ({ safeParse: mocks.safeParse }) },
  invitationTitle: vi.fn(),
  ownsInvitationCoverPhoto: vi.fn(),
  ownsInvitationGalleryPhotos: vi.fn(),
  ownsInvitationMusic: vi.fn(),
}));
vi.mock("@/lib/request-json", () => ({ readJsonBody: mocks.readJsonBody }));

import { PATCH } from "./route";

beforeEach(() => {
  mocks.auth.mockReset().mockResolvedValue({ user: { id: "customer-user" } });
  mocks.findFirst.mockReset().mockResolvedValue(null);
  mocks.ensureTemplateVersion.mockReset();
  mocks.safeParse.mockReset().mockReturnValue({ success: true, data: { templateId: "new-template-version" } });
  mocks.readJsonBody.mockReset().mockResolvedValue({ ok: true, value: {} });
});

test("does not sync a template when the user does not own the invitation", async () => {
  const response = await PATCH(new Request("http://localhost/api/invitations/00000000-0000-4000-8000-000000000001", { method: "PATCH" }), {
    params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
  });

  expect(response.status).toBe(404);
  expect(mocks.ensureTemplateVersion).not.toHaveBeenCalled();
});

test("does not read invitation or sync a template for unauthenticated requests", async () => {
  mocks.auth.mockResolvedValueOnce(null);

  const response = await PATCH(new Request("http://localhost/api/invitations/00000000-0000-4000-8000-000000000001", { method: "PATCH" }), {
    params: Promise.resolve({ id: "00000000-0000-4000-8000-000000000001" }),
  });

  expect(response.status).toBe(401);
  expect(mocks.findFirst).not.toHaveBeenCalled();
  expect(mocks.ensureTemplateVersion).not.toHaveBeenCalled();
});
