import type { GameNightConfig } from "../config/types.js";
import {
  addCalendarDays,
  calendarDaysBetween,
  compareCalendarDates,
} from "./calendar-date.js";

export function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor;
}

export function turnNumberForDate(
  night: GameNightConfig,
  date: string,
): number {
  if (compareCalendarDates(date, night.anchorDate) < 0) {
    return 0;
  }
  return Math.ceil(
    calendarDaysBetween(night.anchorDate, date) / night.intervalDays,
  );
}

export function turnDate(night: GameNightConfig, turnNumber: number): string {
  return addCalendarDays(night.anchorDate, turnNumber * night.intervalDays);
}

/** True when `date` lands on one of the night's recurring occurrences (on/after anchor). */
export function dateAlignsWithSchedule(
  night: GameNightConfig,
  date: string,
): boolean {
  const days = calendarDaysBetween(night.anchorDate, date);
  return days >= 0 && days % night.intervalDays === 0;
}

export function basePersonForTurn(
  night: GameNightConfig,
  turnNumber: number,
): string {
  const personId =
    night.people[positiveModulo(turnNumber, night.people.length)];
  if (!personId) {
    throw new Error(`Game night ${night.id} has an empty rotation`);
  }
  return personId;
}
