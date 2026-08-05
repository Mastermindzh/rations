import type { AppConfig, DateOverrideConfig } from "../config/types.js";
import { changeConfig } from "../config/file.js";
import { ConfigError } from "../config/config-error.js";

export async function rescheduleNight(
  dataDirectory: string,
  input: {
    gameNightId: string;
    expectedVersion: string;
    oldDate: string;
    newDate: string;
  },
) {
  return changeConfig(dataDirectory, input.expectedVersion, (config) =>
    applyDateOverride(config, input.gameNightId, input.oldDate, input.newDate),
  );
}

export function applyDateOverride(
  config: AppConfig,
  gameNightId: string,
  oldDate: string,
  newDate: string,
): AppConfig {
  if (!config.gameNights.some((night) => night.id === gameNightId)) {
    throw new ConfigError("Unknown game night", "UNKNOWN_GAME_NIGHT");
  }
  const index = config.dateOverrides.findIndex(
    (item) => item.gameNight === gameNightId && item.oldDate === oldDate,
  );
  const dateOverrides = [...config.dateOverrides];
  if (oldDate === newDate) {
    if (index >= 0) dateOverrides.splice(index, 1);
    return { ...config, dateOverrides };
  }
  const replacement: DateOverrideConfig = {
    gameNight: gameNightId,
    oldDate,
    newDate,
  };
  if (index >= 0) dateOverrides[index] = replacement;
  else dateOverrides.push(replacement);
  return { ...config, dateOverrides };
}
