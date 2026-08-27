import type { AppConfig, ExtraDayConfig } from "../config/types.js";
import { changeConfig } from "../config/file.js";
import { requireGameNight } from "../config/lookups.js";

type AddExtraDayInput = {
  gameNightId: string;
  expectedVersion: string;
  date: string;
  reason?: string;
};

export async function addExtraDay(
  dataDirectory: string,
  input: AddExtraDayInput,
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
  requireGameNight(config, gameNightId);
  const extraDay: ExtraDayConfig = reason
    ? { gameNight: gameNightId, date, reason }
    : { gameNight: gameNightId, date };
  return { ...config, extraDays: [...config.extraDays, extraDay] };
}
