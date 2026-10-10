import { spawn } from "node:child_process";
import { createServer } from "node:http";
import { fileURLToPath } from "node:url";

const port = Number(process.env.E2E_WORKER_HEALTH_PORT ?? 3139);
const tsxCli = fileURLToPath(new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url));
const worker = spawn(process.execPath, [tsxCli, "src/worker.ts"], { env: process.env, stdio: ["ignore", "pipe", "inherit"] });
let ready = false;
let stopping = false;

worker.stdout.on("data", (chunk) => {
  const output = chunk.toString();
  process.stdout.write(output);
  if (output.includes("[background-worker] ready")) ready = true;
});

const server = createServer((request, response) => {
  if (request.method === "GET" && request.url === "/health" && ready) {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ready: true }));
    return;
  }
  response.writeHead(503, { "content-type": "application/json" });
  response.end(JSON.stringify({ ready: false }));
});

server.listen(port, "127.0.0.1");

function stop(signal) {
  stopping = true;
  ready = false;
  worker.kill(signal);
  server.close();
}

process.once("SIGINT", () => stop("SIGINT"));
process.once("SIGTERM", () => stop("SIGTERM"));
worker.once("error", (error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
  server.close();
});
worker.once("exit", (code) => {
  ready = false;
  server.close();
  process.exitCode = stopping ? 0 : code ?? 1;
});
