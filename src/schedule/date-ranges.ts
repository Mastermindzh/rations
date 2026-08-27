import { DateTime } from "luxon";

export type ShortcutKind =
  | "this-week"
  | "next-week"
  | "this-month"
  | "next-month";

function range(start: DateTime, end: DateTime): string[] {
  const dates: string[] = [];
  for (let cursor = start; cursor <= end; cursor = cursor.plus({ days: 1 })) {
    const iso = cursor.toISODate();
    if (iso) {
      dates.push(iso);
    }
  }
  return dates;
}

// Expands a shortcut into ISO dates. Weeks start on Monday (ISO). `today` is the
// reference date; "this" ranges begin at today, never in the past.
export function expandShortcut(
  kind: ShortcutKind,
  today: string,
  timezone: string,
): string[] {
  const start = DateTime.fromISO(today, { zone: timezone }).startOf("day");
  if (!start.isValid) {
    return [];
  }
  switch (kind) {
    case "this-week":
      return range(start, start.endOf("week"));
    case "next-week": {
      const week = start.plus({ weeks: 1 }).startOf("week");
      return range(week, week.endOf("week"));
    }
    case "this-month":
      return range(start, start.endOf("month"));
    case "next-month": {
      const month = start.plus({ months: 1 }).startOf("month");
      return range(month, month.endOf("month"));
    }
  }
}
