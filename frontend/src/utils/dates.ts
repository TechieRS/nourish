import { format, parseISO } from "date-fns";
import type { Appointment, PracticeConfig } from "../types";
export const dayLabel = (day: string, pattern = "EEEE, MMMM d") =>
  format(parseISO(day), pattern);
export function timeLabel(time: string) {
  const [h, m] = time.split(":").map(Number);
  return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
}
export function isFuture(a: Appointment, config: PracticeConfig) {
  const nowParts = new Intl.DateTimeFormat("en-CA", {
    timeZone: config.timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: string) =>
    nowParts.find((p) => p.type === type)?.value || "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  return (
    a.appointment_date > today ||
    (a.appointment_date === today &&
      a.start_time > `${part("hour")}:${part("minute")}:${part("second")}`)
  );
}
export function downloadCalendar(a: Appointment, timezone: string) {
  const stamp = (day: string, t: string) =>
    `${day.replaceAll("-", "")}T${t.replaceAll(":", "")}`;
  const text = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Nourish//Consultation//EN",
    "BEGIN:VEVENT",
    `UID:${a.id}@nourish.demo`,
    `DTSTAMP:${new Date()
      .toISOString()
      .replace(/[-:]/g, "")
      .replace(/\.\d{3}/, "")}`,
    `DTSTART;TZID=${timezone}:${stamp(a.appointment_date, a.start_time)}`,
    `DTEND;TZID=${timezone}:${stamp(a.appointment_date, a.end_time)}`,
    "SUMMARY:Nourish nutrition consultation",
    "DESCRIPTION:Your 30-minute wellness consultation.",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob([text], { type: "text/calendar;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = "nourish-consultation.ics";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
