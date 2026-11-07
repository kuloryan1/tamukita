import { expect, test } from "vitest";
import { mediaServerFilePath } from "@/lib/media-server-storage";

const organizationId = "11111111-1111-4111-8111-111111111111";
const invitationId = "22222222-2222-4222-8222-222222222222";
const assetId = "33333333-3333-4333-8333-333333333333";
const storageRoot = "/tmp/tamukita-media-storage-test";

test("allows private couple portrait crops and public processed variants", () => {
  expect(() => mediaServerFilePath(`private/pending/${organizationId}/${invitationId}/${assetId}/hostOnePhoto.webp`, storageRoot)).not.toThrow();
  expect(() => mediaServerFilePath(`private/pending/${organizationId}/${invitationId}/${assetId}/hostTwoPhoto.png`, storageRoot)).not.toThrow();
  expect(() => mediaServerFilePath(`invitations/${invitationId}/${assetId}/portrait.webp`, storageRoot)).not.toThrow();
  expect(() => mediaServerFilePath(`invitations/${invitationId}/${assetId}/portrait-thumbnail.webp`, storageRoot)).not.toThrow();
  expect(() => mediaServerFilePath(`invitations/${invitationId}/${assetId}/portrait-source.png`, storageRoot)).toThrow();
});
