import { spawn } from "node:child_process";
import { cp, mkdir } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("..", import.meta.url));
const standaloneRoot = path.join(projectRoot, ".next", "standalone");
const staticSource = path.join(projectRoot, ".next", "static");
const staticTarget = path.join(standaloneRoot, ".next", "static");
const publicSource = path.join(projectRoot, "public");
const publicTarget = path.join(standaloneRoot, "public");

await mkdir(path.dirname(staticTarget), { recursive: true });
await cp(staticSource, staticTarget, { recursive: true, force: true });
await mkdir(publicTarget, { recursive: true });
try {
  await cp(publicSource, publicTarget, { recursive: true, force: true });
} catch (error) {
  if (typeof error !== "object" || error === null || !("code" in error) || error.code !== "ENOENT") throw error;
}

const server = spawn(process.execPath, ["server.js"], {
  cwd: standaloneRoot,
  env: process.env,
  stdio: "inherit",
});
let stopping = false;

function stop(signal) {
  stopping = true;
  server.kill(signal);
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));

server.once("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
server.once("exit", (code) => {
  process.exitCode = stopping ? 0 : code ?? 1;
});
