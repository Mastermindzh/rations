import type { AppConfig, GameNightConfig } from "../config/types.js";
import { dateAlignsWithSchedule } from "./calculate-schedule.js";

export type DateOccupancyOptions = {
  includeExtraDays?: boolean;
  includeMovedToDates?: boolean;
};

export function activeScheduleOccupiesDate(
  config: AppConfig,
  night: GameNightConfig,
  date: string,
): boolean {
  const wasMovedAway = config.dateOverrides.some(
    (override) => override.gameNight === night.id && override.oldDate === date,
  );
  return dateAlignsWithSchedule(night, date) && !wasMovedAway;
}

export function createDateOccupancyChecker(
  config: AppConfig,
  night: GameNightConfig,
  options: DateOccupancyOptions = {},
): (date: string) => boolean {
  const includeExtraDays = options.includeExtraDays ?? true;
  const includeMovedToDates = options.includeMovedToDates ?? true;
  const extraDates = new Set(
    includeExtraDays
      ? config.extraDays
          .filter((item) => item.gameNight === night.id)
          .map((item) => item.date)
      : [],
  );
  const overrides = config.dateOverrides.filter(
    (item) => item.gameNight === night.id,
  );
  const movedToDates = new Set(
    includeMovedToDates ? overrides.map((item) => item.newDate) : [],
  );
  const movedFromDates = new Set(overrides.map((item) => item.oldDate));

  return (date) =>
    extraDates.has(date) ||
    movedToDates.has(date) ||
    (dateAlignsWithSchedule(night, date) && !movedFromDates.has(date));
}

export function dateIsOccupied(
  config: AppConfig,
  night: GameNightConfig,
  date: string,
  options: DateOccupancyOptions = {},
): boolean {
  return createDateOccupancyChecker(config, night, options)(date);
}
