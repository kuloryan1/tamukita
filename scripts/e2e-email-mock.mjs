import { createServer } from "node:http";
import { randomUUID } from "node:crypto";

const host = "127.0.0.1";
const port = Number(process.env.E2E_EMAIL_MOCK_PORT ?? 3140);
const messages = [];

function sendJson(response, status, value) {
  response.writeHead(status, { "content-type": "application/json; charset=utf-8", "cache-control": "no-store" });
  response.end(JSON.stringify(value));
}

const server = createServer((request, response) => {
  const url = new URL(request.url ?? "/", `http://${host}:${port}`);
  if (request.method === "GET" && url.pathname === "/health") {
    sendJson(response, 200, { ready: true });
    return;
  }

  if (request.method === "GET" && url.pathname === "/messages") {
    const recipient = url.searchParams.get("to");
    if (!recipient) {
      sendJson(response, 400, { error: "A recipient filter is required." });
      return;
    }
    sendJson(response, 200, { messages: messages.filter((message) => message.to.includes(recipient)) });
    return;
  }

  if (request.method !== "POST" || url.pathname !== "/emails") {
    sendJson(response, 404, { error: "Not found." });
    return;
  }

  if (request.headers.authorization !== "Bearer e2e-local-only") {
    sendJson(response, 401, { error: "Invalid test mail key." });
    return;
  }

  const chunks = [];
  let bytes = 0;
  request.on("data", (chunk) => {
    bytes += chunk.length;
    if (bytes > 64_000) {
      request.destroy();
      return;
    }
    chunks.push(chunk);
  });
  request.on("end", () => {
    let payload;
    try {
      payload = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch {
      sendJson(response, 400, { error: "Invalid JSON." });
      return;
    }

    if (typeof payload?.from !== "string"
      || !Array.isArray(payload.to)
      || !payload.to.every((recipient) => typeof recipient === "string")
      || typeof payload.subject !== "string"
      || typeof payload.html !== "string"
      || typeof payload.text !== "string") {
      sendJson(response, 400, { error: "Invalid email payload." });
      return;
    }

    messages.push({ from: payload.from, to: payload.to, subject: payload.subject, html: payload.html, text: payload.text });
    sendJson(response, 200, { id: `e2e-${randomUUID()}` });
  });
});

server.listen(port, host);

function stop() {
  server.close();
}

process.once("SIGINT", stop);
process.once("SIGTERM", stop);
