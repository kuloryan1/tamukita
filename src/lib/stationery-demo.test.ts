import { describe, expect, it } from "vitest";
import { elegantCreamDemoEvent } from "@/lib/elegant-cream-demo";
import { calendarContent } from "@/lib/stationery-calendar";
import { WEDDING } from "@/lib/stationery-demo";
import { normalizeRecipient } from "@/lib/stationery-recipient";

function eventProperties(content = calendarContent()) {
  const unfolded = content.replace(/\r\n[ \t]/g, "");
  const event = unfolded.split("BEGIN:VEVENT\r\n")[1]?.split("\r\nEND:VEVENT")[0];
  if (!event) throw new Error("The download does not contain a complete calendar event.");
  return new Map<string, string>(event.split("\r\n").map((line) => {
    const colon = line.indexOf(":");
    return [line.slice(0, colon), line.slice(colon + 1)] as const;
  }));
}

function decodeCalendarText(value: string | undefined) {
  if (value === undefined) throw new Error("The requested calendar text property is missing.");
  return value.replace(/\\([\\,;nN])/g, (_, character: string) => /[nN]/.test(character) ? "\n" : character);
}

function calendarUtcInstant(value: string | undefined) {
  const match = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/.exec(value ?? "");
  if (!match) throw new Error("The calendar start must be an explicit UTC instant.");
  return new Date(Date.UTC(
    Number(match[1]), Number(match[2]) - 1, Number(match[3]),
    Number(match[4]), Number(match[5]), Number(match[6]),
  ));
}

describe("stationery calendar and countdown", () => {
  it("exports the Elegant Cream date and complete address at 19:00 WIB", () => {
    const content = calendarContent(elegantCreamDemoEvent, "elegant-cream-demo@tamukita.io");
    const event = eventProperties(content);
    expect(calendarUtcInstant(event.get("DTSTART")).toISOString()).toBe("2026-11-21T12:00:00.000Z");
    expect(decodeCalendarText(event.get("SUMMARY"))).toBe("Pernikahan Ryan Pratama & Dwi Wulan Maulida");
    expect(decodeCalendarText(event.get("LOCATION"))).toBe(
      "Gedung Graha Wisata Surabaya, Blok N–O, Jl. Wisata Menanggal No. 38, Dukuh Menanggal, Kec. Gayungan, Surabaya",
    );
    expect(decodeCalendarText(event.get("DESCRIPTION"))).toContain("Sabtu, 21 November 2026 pukul 19:00 WIB.");
    expect(content.split("\r\n").every((line) => Buffer.byteLength(line, "utf8") <= 75)).toBe(true);
  });

  it("keeps the countdown and calendar at Saturday 21 November 2026, 18:00 WIB in every viewer timezone", () => {
    const start = new Date(WEDDING.startAt);
    const calendarStart = calendarUtcInstant(eventProperties().get("DTSTART"));

    expect(start.toISOString()).toBe("2026-11-21T11:00:00.000Z");
    expect(calendarStart.getTime()).toBe(start.getTime());

    const jakarta = Object.fromEntries(new Intl.DateTimeFormat("en-GB", {
      timeZone: "Asia/Jakarta",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      weekday: "long",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).formatToParts(calendarStart).map((part) => [part.type, part.value]));
    expect(jakarta).toMatchObject({
      year: "2026", month: "11", day: "21", weekday: "Saturday", hour: "18", minute: "00",
    });
    // The user supplied a start time only; do not invent a finish time.
    expect(eventProperties().has("DTEND")).toBe(false);
  });

  it("exports an importable ICS file with intact escaped venue and folded invitation text", () => {
    const content = calendarContent();
    expect(content.startsWith("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n")).toBe(true);
    expect(content.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(/[\r\n]/.test(content.replace(/\r\n/g, ""))).toBe(false);
    for (const line of content.split("\r\n")) {
      expect(Buffer.byteLength(line, "utf8"), `ICS physical line exceeds 75 octets: ${line}`).toBeLessThanOrEqual(75);
    }

    const event = eventProperties();
    expect(decodeCalendarText(event.get("SUMMARY"))).toBe(`Pernikahan ${WEDDING.groom} & ${WEDDING.bride}`);
    expect(decodeCalendarText(event.get("LOCATION"))).toBe(`${WEDDING.venue}, ${WEDDING.city}`);
    expect(/(?<!\\),/.test(event.get("LOCATION") ?? "")).toBe(false);
    expect(decodeCalendarText(event.get("DESCRIPTION"))).toBe(
      `${WEDDING.intro} ${WEDDING.dateLabel} pukul ${WEDDING.timeLabel}.`,
    );
  });
});

describe("recipient names in share and template URLs", () => {
  it("preserves the emoji at the former 100 UTF-16-unit crash boundary", () => {
    const recipient = `${"A".repeat(99)}💌`;
    const result = normalizeRecipient(recipient);

    expect(result).toBe(recipient);
    expect(Array.from(result)).toHaveLength(100);
    encodeURIComponent(result);
    expect(new URLSearchParams(`to=${encodeURIComponent(result)}`).get("to")).toBe(recipient);
  });

  it("limits long Unicode names without leaving a dangling surrogate in their links", () => {
    const result = normalizeRecipient("💌".repeat(101));

    expect(result).toBe("💌".repeat(100));
    expect(decodeURIComponent(encodeURIComponent(result))).toBe(result);
  });

  it("removes malformed Unicode and control characters while retaining legitimate names and punctuation", () => {
    const result = normalizeRecipient("\u0000\n  Ayu\ud800 & Budi\udfff\u0085 💌\t  ");

    expect(result).toBe("Ayu & Budi 💌");
    expect(decodeURIComponent(encodeURIComponent(result))).toBe(result);
    expect(normalizeRecipient("  أحمد & 李明  ")).toBe("أحمد & 李明");
  });

  it.each([
    { label: "undefined", value: undefined },
    { label: "null", value: null },
    { label: "repeated query values", value: ["Budi", "Ayu"] },
    { label: "an object", value: { to: "Budi" } },
    { label: "whitespace and controls", value: " \t\n " },
  ])(
    "uses the recipient fallback for $label",
    ({ value }) => {
      expect(normalizeRecipient(value)).toBe("Anda");
      expect(normalizeRecipient(value, "")).toBe("");
    },
  );
});
