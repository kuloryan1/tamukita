import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

const VERSION = 1;
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function encryptionKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error("AUTH_SECRET diperlukan untuk mengenkripsi kontak tamu.");
  return createHash("sha256").update(`tamukita:guest-contact:v${VERSION}:${secret}`).digest();
}

export function encryptGuestPhone(phone: string): Uint8Array<ArrayBuffer> {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(phone, "utf8"), cipher.final()]);
  const packed = Buffer.concat([Buffer.from([VERSION]), iv, cipher.getAuthTag(), encrypted]);
  const result = new Uint8Array(packed.length);
  result.set(packed);
  return result;
}

export function decryptGuestPhone(value: Uint8Array): string {
  const packed = Buffer.from(value);
  if (packed.length <= 1 + IV_LENGTH + TAG_LENGTH || packed[0] !== VERSION) {
    throw new Error("Data kontak tamu tidak dapat dibaca.");
  }
  const iv = packed.subarray(1, 1 + IV_LENGTH);
  const tag = packed.subarray(1 + IV_LENGTH, 1 + IV_LENGTH + TAG_LENGTH);
  const encrypted = packed.subarray(1 + IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}
