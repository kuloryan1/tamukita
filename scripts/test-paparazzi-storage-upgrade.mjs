import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

const url = new URL(process.env.DATABASE_URL ?? "postgresql://invalid/invalid");
const local = ["localhost", "127.0.0.1"].includes(url.hostname) && url.pathname === "/tamukita_paparazzi_e2e";
const ci = process.env.CI === "true" && process.env.E2E_ALLOW_GITHUB_SERVICE_DATABASE === "1" && url.hostname === "postgres" && url.pathname === "/tamukita";
if (process.env.E2E_ALLOW_DESTRUCTIVE !== "1" || (!local && !ci)) throw new Error("Storage upgrade test requires an explicitly allowed disposable database.");
url.searchParams.delete("schema");
const pool = new pg.Pool({ connectionString: url.toString() });
const client = await pool.connect();
try {
  await client.query("BEGIN");
  const schema = `paparazzi_upgrade_${randomBytes(8).toString("hex")}`;
  await client.query(`CREATE SCHEMA "${schema}"`);
  await client.query(`SET LOCAL search_path TO "${schema}"`);
  await client.query(`CREATE TABLE paparazzi_albums (id integer PRIMARY KEY, "maxPhotos" integer NOT NULL DEFAULT 200);
    CREATE TABLE paparazzi_photos (id integer PRIMARY KEY, "sourceKey" text NOT NULL, "processedKey" text NOT NULL);
    INSERT INTO paparazzi_albums VALUES (1,200);
    INSERT INTO paparazzi_photos VALUES (1,'existing-private-source','existing-private-photo');`);
  const migration = await readFile(new URL("../prisma/migrations/20261031010000_paparazzi_server_storage/migration.sql", import.meta.url), "utf8");
  await client.query(migration);
  assert.deepEqual((await client.query('SELECT "storageProvider", "sourceKey", "processedKey" FROM paparazzi_photos WHERE id=1')).rows[0], {
    storageProvider: "R2", sourceKey: "existing-private-source", processedKey: "existing-private-photo",
  });
  assert.equal((await client.query('SELECT "maxPhotos" FROM paparazzi_albums WHERE id=1')).rows[0].maxPhotos, null);
  await client.query("INSERT INTO paparazzi_albums (id) VALUES (2)");
  assert.equal((await client.query('SELECT "maxPhotos" FROM paparazzi_albums WHERE id=2')).rows[0].maxPhotos, null);
  console.log("Storage upgrade passed: existing photos stay R2; existing and new albums have no quota.");
} finally {
  await client.query("ROLLBACK"); await client.release(); await pool.end();
}
