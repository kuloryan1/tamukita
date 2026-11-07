import { calendarContent } from "@/lib/stationery-calendar";
import { elegantCreamDemoEvent } from "@/lib/elegant-cream-demo";

export function GET(request: Request) {
  const elegantCream = new URL(request.url).searchParams.get("template") === "elegant-cream";
  const content = elegantCream ? calendarContent(elegantCreamDemoEvent, "elegant-cream-demo@tamukita.io") : calendarContent();
  const filename = elegantCream ? "Ryan-Wulan.ics" : "Ryan-Dwi-21-November-2026.ics";
  return new Response(content, { headers: {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": `attachment; filename="${filename}"`,
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  } });
}
