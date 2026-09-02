import type { AppConfig } from "../config/types.js";
import type { GameNightOccurrence } from "../schedule/types.js";
import { changeConfig } from "../config/file.js";
import { personName, requireGameNight } from "../config/lookups.js";
import { ConfigError } from "../config/config-error.js";
import { resolveNightSchedule } from "../schedule/resolve-turn.js";
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
  const chronologicalNights = resolveNightSchedule(
    config,
    night,
    currentDate,
    1,
  );
  const current = chronologicalNights.current;
  if (current.date !== currentDate) {
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
  let updated = setOccurrenceOverride(
    config,
    current,
    next.personId,
    `${currentName} delayed once`,
  );
  updated = setOccurrenceOverride(
    updated,
    next,
    current.personId,
    `Swapped with ${nextName}`,
  );
  return updated;
}

function setOccurrenceOverride(
  config: AppConfig,
  occurrence: GameNightOccurrence,
  personId: string,
  reason: string,
): AppConfig {
  return setOverride(
    config,
    occurrence.gameNightId,
    occurrence.originalDate ?? occurrence.date,
    personId,
    reason,
    occurrence.isExtra,
  );
}
