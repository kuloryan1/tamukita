import { beforeEach, expect, test, vi } from "vitest";
import { WEDDING_GUEST_MESSAGE } from "@/lib/guest-whatsapp-message";

const mocks = vi.hoisted(() => ({ auth: vi.fn(), findFirst: vi.fn(), updateMany: vi.fn(), audit: vi.fn(), transaction: vi.fn(), allowRequest: vi.fn(), readJsonBody: vi.fn(), featureAccess: vi.fn() }));
vi.mock("@/auth", () => ({ auth: mocks.auth }));
vi.mock("@/lib/prisma", () => ({ getPrismaClient: () => ({ invitation: { findFirst: mocks.findFirst }, $transaction: mocks.transaction }) }));
vi.mock("@/lib/rate-limit", () => ({ allowRequest: mocks.allowRequest }));
vi.mock("@/lib/request-json", () => ({ readJsonBody: mocks.readJsonBody }));
vi.mock("@/lib/invitation-entitlements", () => ({ getInvitationFeatureAccess: mocks.featureAccess }));
import { GET, PATCH } from "./route";

const invitationId = "00000000-0000-4000-8000-000000000001";
const params = () => ({ params: Promise.resolve({ id: invitationId }) });
const request = (method = "GET") => new Request(`http://localhost/api/invitations/${invitationId}/guest-message`, { method });

beforeEach(() => {
  vi.resetAllMocks();
  mocks.auth.mockResolvedValue({ user: { id: "owner" } });
  mocks.findFirst.mockResolvedValue({ id: invitationId, organizationId: "organization", guestMessageTemplate: null, draftData: { eventKind: "Pernikahan" } });
  mocks.updateMany.mockResolvedValue({ count: 1 });
  mocks.audit.mockResolvedValue({});
  mocks.transaction.mockImplementation((callback) => callback({ invitation: { updateMany: mocks.updateMany }, auditLog: { create: mocks.audit } }));
  mocks.featureAccess.mockResolvedValue({ rsvp: true });
  mocks.allowRequest.mockResolvedValue(true);
  mocks.readJsonBody.mockResolvedValue({ ok: true, value: { messageTemplate: WEDDING_GUEST_MESSAGE } });
});

test.each([GET, PATCH])("requires authentication before reading settings", async (handler) => {
  mocks.auth.mockResolvedValue(null);
  const response = await handler(request(), params());
  expect(response.status).toBe(401);
  expect(mocks.findFirst).not.toHaveBeenCalled();
  expect(mocks.updateMany).not.toHaveBeenCalled();
});

test.each([GET, PATCH])("does not expose another invitation's settings", async (handler) => {
  mocks.findFirst.mockResolvedValue(null);
  const response = await handler(request(), params());
  expect(response.status).toBe(404);
  expect(mocks.findFirst).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ id: invitationId, ownerId: "owner", deletedAt: null, organization: { status: "ACTIVE", memberships: { some: { userId: "owner", role: { in: ["OWNER", "ADMIN", "EDITOR"] } } } } }) }));
  expect(mocks.updateMany).not.toHaveBeenCalled();
});

test("returns the example for existing invitations with no saved setting, without caching private content", async () => {
  const response = await GET(request(), params());
  expect(await response.json()).toEqual({ messageTemplate: WEDDING_GUEST_MESSAGE, defaultTemplate: WEDDING_GUEST_MESSAGE });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});

test("returns the saved per-invitation message", async () => {
  mocks.findFirst.mockResolvedValue({ id: invitationId, guestMessageTemplate: "Halo {nama_tamu}\n{link_undangan}", draftData: { eventKind: "Pernikahan" } });
  const response = await GET(request(), params());
  expect((await response.json()).messageTemplate).toBe("Halo {nama_tamu}\n{link_undangan}");
});

test("only persists the WA setting and records an audit without message content", async () => {
  const response = await PATCH(request("PATCH"), params());
  expect(response.status).toBe(200);
  expect(mocks.updateMany).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ ownerId: "owner", deletedAt: null }), data: { guestMessageTemplate: WEDDING_GUEST_MESSAGE } }));
  expect(mocks.audit).toHaveBeenCalledWith({ data: expect.objectContaining({ action: "guests.whatsapp_message_updated", metadata: { characterCount: WEDDING_GUEST_MESSAGE.length } }) });
  expect(response.headers.get("Cache-Control")).toBe("private, no-store");
});

test.each(["", "Tanpa tautan", "{tautan} {link_undangan}", "a".repeat(4001)])("rejects invalid message text before writing", async (messageTemplate) => {
  mocks.readJsonBody.mockResolvedValue({ ok: true, value: { messageTemplate } });
  expect((await PATCH(request("PATCH"), params())).status).toBe(400);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});

test("rejects unrelated settings in this endpoint", async () => {
  mocks.readJsonBody.mockResolvedValue({ ok: true, value: { messageTemplate: WEDDING_GUEST_MESSAGE, draftData: {} } });
  expect((await PATCH(request("PATCH"), params())).status).toBe(400);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});

test("handles oversized payloads and rate limits without writing", async () => {
  mocks.readJsonBody.mockResolvedValueOnce({ ok: false, status: 413 });
  expect((await PATCH(request("PATCH"), params())).status).toBe(413);
  mocks.allowRequest.mockResolvedValueOnce(false);
  expect((await PATCH(request("PATCH"), params())).status).toBe(429);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});

test("rechecks access when saving and does not audit a failed update", async () => {
  mocks.updateMany.mockResolvedValue({ count: 0 });
  expect((await PATCH(request("PATCH"), params())).status).toBe(404);
  expect(mocks.audit).not.toHaveBeenCalled();
});

test("respects invitation feature access", async () => {
  mocks.featureAccess.mockResolvedValue({ rsvp: false });
  expect((await PATCH(request("PATCH"), params())).status).toBe(403);
  expect(mocks.updateMany).not.toHaveBeenCalled();
});
