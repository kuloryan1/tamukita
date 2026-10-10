import { randomBytes, scrypt, timingSafeEqual } from "node:crypto";

const KEY_LENGTH = 64;
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_MAX_MEMORY = 64 * 1024 * 1024;
const DUMMY_HASH = `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${"00".repeat(16)}$${"00".repeat(KEY_LENGTH)}`;

function deriveKey(password: string, salt: Buffer, cost = SCRYPT_N) {
  return new Promise<Buffer>((resolve, reject) => {
    scrypt(password, salt, KEY_LENGTH, {
      N: cost,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAX_MEMORY,
    }, (error, key) => {
      if (error) reject(error);
      else resolve(key as Buffer);
    });
  });
}

export async function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = await deriveKey(password, salt);
  return `scrypt$${SCRYPT_N}$${SCRYPT_R}$${SCRYPT_P}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, encodedHash: string | null | undefined) {
  const parts = (encodedHash || DUMMY_HASH).split("$");
  const [algorithm, n, r, p, saltHex, keyHex] = parts;
  const isValidFormat = algorithm === "scrypt"
    && Number(n) === SCRYPT_N
    && Number(r) === SCRYPT_R
    && Number(p) === SCRYPT_P
    && /^[\da-f]{32}$/i.test(saltHex || "")
    && new RegExp(`^[\\da-f]{${KEY_LENGTH * 2}}$`, "i").test(keyHex || "");

  const salt = isValidFormat ? Buffer.from(saltHex, "hex") : Buffer.alloc(16);
  const expected = isValidFormat ? Buffer.from(keyHex, "hex") : Buffer.alloc(KEY_LENGTH);
  const actual = await deriveKey(password, salt);
  return isValidFormat && timingSafeEqual(actual, expected);
}
