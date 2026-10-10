import { createHash } from "node:crypto";
import { createServer } from "node:http";

const port = Number(process.env.E2E_R2_MOCK_PORT ?? 3138);
const objects = new Map();

function setCors(request, response) {
  const origin = request.headers.origin;
  response.setHeader("Access-Control-Allow-Origin", origin === "http://127.0.0.1:3000" ? origin : "*");
  response.setHeader("Access-Control-Allow-Methods", "GET, HEAD, PUT, DELETE, OPTIONS");
  response.setHeader("Access-Control-Allow-Headers", request.headers["access-control-request-headers"] ?? "Content-Type");
  response.setHeader("Access-Control-Expose-Headers", "ETag, Content-Length, Content-Type");
  response.setHeader("Vary", "Origin");
}

function missingObject(response, headOnly) {
  response.writeHead(404, { "content-type": "application/xml" });
  response.end(headOnly ? undefined : "<Error><Code>NoSuchKey</Code><Message>The specified key does not exist.</Message></Error>");
}

const server = createServer(async (request, response) => {
  setCors(request, response);
  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  const url = new URL(request.url ?? "/", `http://${request.headers.host ?? "127.0.0.1"}`);
  if (request.method === "GET" && url.pathname === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ready: true }));
    return;
  }

  let segments;
  try {
    segments = url.pathname.split("/").filter(Boolean).map((segment) => decodeURIComponent(segment));
  } catch {
    response.writeHead(400);
    response.end();
    return;
  }
  const bucket = segments.shift();
  const key = segments.join("/");
  if (!bucket || !key) {
    response.writeHead(404);
    response.end();
    return;
  }
  const storageKey = `${bucket}/${key}`;

  if (request.method === "PUT") {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = Buffer.concat(chunks);
    const object = { body, contentType: String(request.headers["content-type"] ?? "application/octet-stream") };
    objects.set(storageKey, object);
    const etag = `"${createHash("md5").update(body).digest("hex")}"`;
    response.writeHead(200, { ETag: etag });
    response.end();
    return;
  }

  if (request.method === "HEAD" || request.method === "GET") {
    const object = objects.get(storageKey);
    if (!object) {
      missingObject(response, request.method === "HEAD");
      return;
    }
    response.writeHead(200, {
      "content-type": object.contentType,
      "content-length": object.body.length,
      ETag: `"${createHash("md5").update(object.body).digest("hex")}"`,
      "cache-control": bucket === "public" ? "public, max-age=60" : "private, no-store",
    });
    response.end(request.method === "GET" ? object.body : undefined);
    return;
  }

  if (request.method === "DELETE") {
    objects.delete(storageKey);
    response.writeHead(204);
    response.end();
    return;
  }

  response.writeHead(405, { Allow: "GET, HEAD, PUT, DELETE, OPTIONS" });
  response.end();
});

server.listen(port, "127.0.0.1");
