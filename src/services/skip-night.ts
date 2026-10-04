import type { AppConfig } from "../config/types.js";
import { requireGameNight } from "../config/lookups.js";
import { ConfigError } from "../config/config-error.js";
import {
  isValidCalendarDate,
  todayInTimezone,
} from "../schedule/calendar-date.js";
import { resolveRelevantTurn } from "../schedule/resolve-turn.js";

export function applySkipNight(
  config: AppConfig,
  gameNightId: string,
  date: string,
  reason?: string,
): AppConfig {
  const night = requireGameNight(config, gameNightId);
  if (!isValidCalendarDate(date)) {
    throw new ConfigError("Invalid date", "INVALID_SKIP");
  }
  const turn = resolveRelevantTurn(config, night, date);
  if (turn.date !== date || turn.isExtra) {
    throw new ConfigError(
      "The recurring night is no longer on the schedule; extra days must be removed separately",
      "INVALID_SKIP",
    );
  }
  const originalDate = turn.originalDate ?? date;
  return {
    ...config,
    dateOverrides: config.dateOverrides.filter(
      (item) => item.gameNight !== night.id || item.oldDate !== originalDate,
    ),
    overrides: config.overrides.filter(
      (item) =>
        item.gameNight !== night.id ||
        item.date !== originalDate ||
        item.isExtra,
    ),
    skippedDays: [
      ...config.skippedDays,
      {
        gameNight: night.id,
        date: originalDate,
        ...(reason ? { reason } : {}),
      },
    ],
  };
}

export function applyRestoreNight(
  config: AppConfig,
  gameNightId: string,
  date: string,
): AppConfig {
  requireGameNight(config, gameNightId);
  if (date < todayInTimezone(config.site.timezone)) {
    throw new ConfigError(
      "Past skips cannot be restored because that changes later assignments",
      "INVALID_SKIP",
    );
  }
  return {
    ...config,
    skippedDays: config.skippedDays.filter(
      (item) => item.gameNight !== gameNightId || item.date !== date,
    ),
  };
}
