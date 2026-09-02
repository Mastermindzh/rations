import { DateTime } from "luxon";

export const ISO_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export function parseCalendarDate(value: string): DateTime {
  if (!ISO_DATE_PATTERN.test(value)) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  const date = DateTime.fromISO(value, { zone: "UTC" }).startOf("day");
  if (!date.isValid || date.toISODate() !== value) {
    throw new Error(`Invalid calendar date: ${value}`);
  }
  return date;
}

export function isValidCalendarDate(value: string): boolean {
  try {
    parseCalendarDate(value);
    return true;
  } catch {
    return false;
  }
}

export function formatCalendarDate(date: DateTime): string {
  const value = date.toISODate();
  if (!value) {
    throw new Error("Cannot format invalid calendar date");
  }
  return value;
}

export function addCalendarDays(value: string, days: number): string {
  if (!Number.isInteger(days)) {
    throw new Error("Calendar days must be an integer");
  }
  return formatCalendarDate(parseCalendarDate(value).plus({ days }));
}

export function compareCalendarDates(left: string, right: string): number {
  return left === right ? 0 : left < right ? -1 : 1;
}

export function calendarDaysBetween(start: string, end: string): number {
  const days = parseCalendarDate(end).diff(
    parseCalendarDate(start),
    "days",
  ).days;
  return Math.trunc(days);
}

export function todayInTimezone(
  timezone: string,
  now: DateTime<boolean> = DateTime.now(),
): string {
  const zoned = now.setZone(timezone);
  if (!zoned.isValid) {
    throw new Error(`Invalid timezone: ${timezone}`);
  }
  const value = zoned.toISODate();
  if (!value) {
    throw new Error("Unable to determine current date");
  }
  return value;
}
