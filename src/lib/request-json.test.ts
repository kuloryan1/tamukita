import { expect, test, vi } from "vitest";

vi.mock("server-only", () => ({}));

import { readJsonBody } from "@/lib/request-json";

function streamedRequest(body: ReadableStream<Uint8Array>) {
  return new Request("https://example.test/api", {
    method: "POST",
    body,
    duplex: "half",
  } as RequestInit);
}

test("parses valid JSON split across streamed chunks", async () => {
  const encoder = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(encoder.encode('{"ready":'));
      controller.enqueue(encoder.encode("true}"));
      controller.close();
    },
  });

  await expect(readJsonBody(streamedRequest(body), 32)).resolves.toEqual({
    ok: true,
    value: { ready: true },
  });
});

test("rejects an oversized chunked body and cancels the stream", async () => {
  let canceled = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      controller.enqueue(new Uint8Array(8));
    },
    cancel() {
      canceled = true;
    },
  });

  await expect(readJsonBody(streamedRequest(body), 4)).resolves.toEqual({ ok: false, status: 413 });
  expect(canceled).toBe(true);
});

test("rejects malformed JSON and invalid UTF-8", async () => {
  const malformed = new Request("https://example.test/api", { method: "POST", body: "{" });
  const invalidUtf8 = streamedRequest(new ReadableStream<Uint8Array>({
    start(controller) {
      controller.enqueue(new Uint8Array([0xc3, 0x28]));
      controller.close();
    },
  }));

  await expect(readJsonBody(malformed)).resolves.toEqual({ ok: false, status: 400 });
  await expect(readJsonBody(invalidUtf8)).resolves.toEqual({ ok: false, status: 400 });
});
