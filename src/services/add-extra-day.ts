import type { AppConfig, ExtraDayConfig } from "../config/types.js";
import { changeConfig } from "../config/file.js";
import { ConfigError } from "../config/config-error.js";

export async function addExtraDay(
  dataDirectory: string,
  input: {
    gameNightId: string;
    expectedVersion: string;
    date: string;
    reason?: string;
  },
) {
  return changeConfig(dataDirectory, input.expectedVersion, (config) =>
    applyAddExtraDay(config, input.gameNightId, input.date, input.reason),
  );
}

// Appends the extra day; date conflicts and duplicates are caught by full-config
// validation inside changeConfig.
export function applyAddExtraDay(
  config: AppConfig,
  gameNightId: string,
  date: string,
  reason?: string,
): AppConfig {
  if (!config.gameNights.some((night) => night.id === gameNightId)) {
    throw new ConfigError("Unknown game night", "UNKNOWN_GAME_NIGHT");
  }
  const extraDay: ExtraDayConfig = reason
    ? { gameNight: gameNightId, date, reason }
    : { gameNight: gameNightId, date };
  return { ...config, extraDays: [...config.extraDays, extraDay] };
}
