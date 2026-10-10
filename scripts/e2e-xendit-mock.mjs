import { createServer } from "node:http";

const port = Number(process.env.E2E_XENDIT_MOCK_PORT ?? 3137);

const server = createServer(async (request, response) => {
  if (request.method === "GET" && request.url === "/health") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ ready: true }));
    return;
  }

  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  let body;
  try {
    body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    response.writeHead(400, { "content-type": "application/json" });
    response.end(JSON.stringify({ error_code: "INVALID_JSON" }));
    return;
  }

  if (request.method === "POST" && request.url === "/sessions") {
    if (typeof body.description === "string" && body.description.includes("E2E Refund Reseller")) {
      response.writeHead(400, { "content-type": "application/json" });
      response.end(JSON.stringify({ error_code: "E2E_PROVIDER_REJECTED" }));
      return;
    }
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      payment_session_id: `e2e-session-${body.reference_id}`,
      payment_id: `e2e-payment-${body.reference_id}`,
      payment_request_id: `e2e-payment-request-${body.reference_id}`,
      payment_link_url: `https://checkout.xendit.co/e2e/${body.reference_id}`,
      expires_at: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }));
    return;
  }

  if (request.method === "POST" && request.url === "/refunds") {
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      id: `e2e-refund-${body.reference_id}`,
      reference_id: body.reference_id,
      payment_request_id: body.payment_request_id,
      amount: body.amount,
      currency: body.currency,
      status: "PENDING",
    }));
    return;
  }

  response.writeHead(404, { "content-type": "application/json" });
  response.end(JSON.stringify({ error_code: "NOT_FOUND" }));
});

server.listen(port, "127.0.0.1");
