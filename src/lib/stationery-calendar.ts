import type { InvitationDraft } from "@/lib/invitations";
import { WEDDING } from "@/lib/stationery-demo";

type CalendarEvent = Pick<InvitationDraft, "eventDate" | "eventTime" | "hostOne" | "hostTwo" | "venue" | "address" | "story">;

const defaultEvent: CalendarEvent = {
  eventDate: WEDDING.eventDate,
  eventTime: WEDDING.eventTime,
  hostOne: WEDDING.groom,
  hostTwo: WEDDING.bride,
  venue: WEDDING.venue,
  address: WEDDING.city,
  story: WEDDING.intro,
};

const dateFormatter = new Intl.DateTimeFormat("id-ID", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta",
});

function escapeCalendarText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r\n|\r|\n/g, "\\n").replace(/[,;]/g, "\\$&");
}

function foldCalendarLine(line: string) {
  let width = 0;
  let result = "";
  for (const character of line) {
    const bytes = Buffer.byteLength(character, "utf8");
    if (width + bytes > 75) {
      result += "\r\n ";
      width = 1;
    }
    result += character;
    width += bytes;
  }
  return result;
}

export function calendarContent(event: CalendarEvent = defaultEvent, uid = "ryan-dwi-20261121@tamukita.io") {
  const startsAt = new Date(`${event.eventDate}T${event.eventTime}:00+07:00`);
  const startUtc = startsAt.toISOString().replace(/[-:]|\.\d{3}/g, "");
  const summary = `Pernikahan ${event.hostOne} & ${event.hostTwo}`;
  const location = [event.venue, event.address].filter(Boolean).join(", ");
  const description = `${event.story} ${dateFormatter.format(startsAt)} pukul ${event.eventTime} WIB.`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//TamuKita//Undangan Digital//ID",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    "DTSTAMP:20261105T000000Z",
    `DTSTART:${startUtc}`,
    `SUMMARY:${escapeCalendarText(summary)}`,
    `LOCATION:${escapeCalendarText(location)}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
    "",
  ].map(foldCalendarLine).join("\r\n");
}
