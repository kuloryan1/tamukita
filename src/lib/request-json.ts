import "server-only";

export async function readJsonBody(request: Request, maxBytes = 2_200_000): Promise<
  | { ok: true; value: unknown }
  | { ok: false; status: 400 | 413 }
> {
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > maxBytes) return { ok: false, status: 413 };

  const reader = request.body?.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let text = "";
  let byteLength = 0;

  if (reader) {
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        byteLength += value.byteLength;
        if (byteLength > maxBytes) {
          await reader.cancel().catch(() => undefined);
          return { ok: false, status: 413 };
        }

        text += decoder.decode(value, { stream: true });
      }
      text += decoder.decode();
    } catch {
      await reader.cancel().catch(() => undefined);
      return { ok: false, status: 400 };
    } finally {
      reader.releaseLock();
    }
  }

  try {
    return { ok: true, value: JSON.parse(text) as unknown };
  } catch {
    return { ok: false, status: 400 };
  }
}
