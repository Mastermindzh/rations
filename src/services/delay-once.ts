import type { AppConfig } from "../config/types.js";
import { changeConfig } from "../config/file.js";
import { personName, requireGameNight } from "../config/lookups.js";
import { ConfigError } from "../config/config-error.js";
import { turnNumberForDate } from "../schedule/calculate-schedule.js";
import {
  resolveNightSchedule,
  resolveTurnNumber,
} from "../schedule/resolve-turn.js";
import { setOverride } from "./set-override.js";

type DelayOnceInput = {
  gameNightId: string;
  expectedVersion: string;
  currentDate: string;
};

export async function delayOnce(dataDirectory: string, input: DelayOnceInput) {
  return changeConfig(dataDirectory, input.expectedVersion, (config) =>
    applyDelayOnce(config, input.gameNightId, input.currentDate),
  );
}

export function applyDelayOnce(
  config: AppConfig,
  gameNightId: string,
  currentDate: string,
): AppConfig {
  const night = requireGameNight(config, gameNightId);
  const current = resolveTurnNumber(
    config,
    night,
    turnNumberForDate(night, currentDate),
  );
  const currentScheduledDate = current.originalDate ?? current.date;
  if (currentScheduledDate !== currentDate) {
    throw new ConfigError(
      "The submitted turn is no longer current",
      "INVALID_DELAY",
    );
  }
  const chronologicalNights = resolveNightSchedule(
    config,
    night,
    current.date,
    1,
    false,
  );
  if (
    (chronologicalNights.current.originalDate ??
      chronologicalNights.current.date) !== currentScheduledDate
  ) {
    throw new ConfigError(
      "The submitted turn is no longer current",
      "INVALID_DELAY",
    );
  }
  const next = chronologicalNights.upcoming[0]!;
  if (current.personId === next.personId) {
    throw new ConfigError(
      "Delay once requires two different participants",
      "INVALID_DELAY",
    );
  }
  const currentName = personName(config, current.personId);
  const nextName = personName(config, next.personId);
  let updated = setOverride(
    config,
    night.id,
    currentScheduledDate,
    next.personId,
    `${currentName} delayed once`,
  );
  updated = setOverride(
    updated,
    night.id,
    next.originalDate ?? next.date,
    current.personId,
    `Swapped with ${nextName}`,
  );
  return updated;
}
