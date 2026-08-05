import type { AppConfig } from "../config/types.js";
import { changeConfig } from "../config/file.js";
import { ConfigError } from "../config/config-error.js";
import { turnNumberForDate } from "../schedule/calculate-schedule.js";
import { resolveTurnNumber } from "../schedule/resolve-turn.js";
import { setOverride } from "./set-override.js";

export async function delayOnce(
  dataDirectory: string,
  input: { gameNightId: string; expectedVersion: string; currentDate: string },
) {
  return changeConfig(dataDirectory, input.expectedVersion, (config) =>
    applyDelayOnce(config, input.gameNightId, input.currentDate),
  );
}

export function applyDelayOnce(
  config: AppConfig,
  gameNightId: string,
  currentDate: string,
): AppConfig {
  const night = config.gameNights.find((item) => item.id === gameNightId);
  if (!night) throw new ConfigError("Unknown game night", "UNKNOWN_GAME_NIGHT");
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
  const next = resolveTurnNumber(config, night, current.turnNumber + 1);
  if (current.personId === next.personId) {
    throw new ConfigError(
      "Delay once requires two different participants",
      "INVALID_DELAY",
    );
  }
  const currentName = config.people[current.personId]?.name ?? current.personId;
  const nextName = config.people[next.personId]?.name ?? next.personId;
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
