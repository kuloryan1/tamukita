import "server-only";

import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/generated/prisma/client";

const globalForPrisma = globalThis as typeof globalThis & {
  tamukitaPrisma?: PrismaClient;
};

export function getPrismaClient() {
  if (globalForPrisma.tamukitaPrisma) return globalForPrisma.tamukitaPrisma;

  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) throw new Error("DATABASE_URL belum dikonfigurasi.");

  const client = new PrismaClient({
    adapter: new PrismaPg({ connectionString }),
  });

  globalForPrisma.tamukitaPrisma = client;
  return client;
}
