import "server-only";

export async function readJsonBody(request: Request, maxBytes = 2_200_000): Promise<
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 }
> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) return { ok: false, status: 413 };
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > maxBytes) return { ok: false, status: 413 };
  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}
