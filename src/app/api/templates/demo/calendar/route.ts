import { calendarContent } from "@/lib/stationery-calendar";
export function GET() {
  return new Response(calendarContent(), { headers: {
    "Content-Type": "text/calendar; charset=utf-8",
    "Content-Disposition": 'attachment; filename="Ryan-Dwi-21-November-2026.ics"',
    "Cache-Control": "public, max-age=86400",
    "X-Content-Type-Options": "nosniff",
  } });
}
