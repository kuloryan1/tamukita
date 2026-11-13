export type AkadEventDetails = {
  weekday: string;
  day: string;
  month: string;
  year: string;
  dateLabel: string;
  time: string;
  address: string;
};

export function getAkadEventDetails(templateSlug: string, customFields?: Record<string, string> | null): AkadEventDetails | null {
  if (templateSlug !== "elegant-cream") return null;
  const dateValue = customFields?.akadDate?.trim() ?? "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) return null;

  const date = new Date(`${dateValue}T12:00:00+07:00`);
  if (!Number.isFinite(date.getTime()) || date.toISOString().slice(0, 10) !== dateValue) return null;

  const parts = new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "2-digit", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) => parts.find((item) => item.type === type)?.value ?? "";
  const timeValue = customFields?.akadTime?.trim() ?? "";
  const time = /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(timeValue) ? timeValue : "";

  return {
    weekday: part("weekday").toLocaleUpperCase("id-ID"),
    day: part("day"),
    month: part("month").toLocaleUpperCase("id-ID"),
    year: part("year"),
    dateLabel: new Intl.DateTimeFormat("id-ID", { weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(date),
    time,
    address: customFields?.akadAddress?.trim() ?? "",
  };
}
