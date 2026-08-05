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
  if (compareCalendarDates(date, night.anchorDate) < 0) return 0;
  return Math.ceil(
    calendarDaysBetween(night.anchorDate, date) / night.intervalDays,
  );
}

export function turnDate(night: GameNightConfig, turnNumber: number): string {
  return addCalendarDays(night.anchorDate, turnNumber * night.intervalDays);
}

export function basePersonForTurn(
  night: GameNightConfig,
  turnNumber: number,
): string {
  const personId =
    night.people[positiveModulo(turnNumber, night.people.length)];
  if (!personId)
    throw new Error(`Game night ${night.id} has an empty rotation`);
  return personId;
}
