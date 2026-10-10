import { cookies } from "next/headers";
import { recordPlatformMetric } from "@/lib/platform-analytics";

const visitCookieName = "tk_marketplace_seen_day";
const visitCookiePath = "/api/analytics/marketplace-visit";

export async function POST(request: Request) {
  const requestOrigin = request.headers.get("origin");
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL ?? request.url;
  let expectedOrigin: string;
  try {
    expectedOrigin = new URL(configuredOrigin).origin;
    if (!requestOrigin || new URL(requestOrigin).origin !== expectedOrigin) {
      return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
    }
  } catch {
    return new Response(null, { status: 403, headers: { "Cache-Control": "no-store" } });
  }

  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const cookieStore = await cookies();
  if (cookieStore.get(visitCookieName)?.value === today) {
    return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
  }

  const recorded = await recordPlatformMetric("template_catalog_unique_visitors");
  if (recorded) {
    cookieStore.set(visitCookieName, today, {
      expires: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1)),
      httpOnly: true,
      path: visitCookiePath,
      sameSite: "lax",
      secure: new URL(expectedOrigin).protocol === "https:",
    });
  }

  return new Response(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
