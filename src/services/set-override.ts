import type { AppConfig, OverrideConfig } from "../config/types.js";

export function setOverride(
  config: AppConfig,
  gameNightId: string,
  date: string,
  personId: string,
  reason?: string,
): AppConfig {
  const replacement: OverrideConfig = reason
    ? { gameNight: gameNightId, date, person: personId, reason }
    : { gameNight: gameNightId, date, person: personId };
  const index = config.overrides.findIndex(
    (item) => item.gameNight === gameNightId && item.date === date,
  );
  const overrides = [...config.overrides];
  if (index >= 0) {
    overrides[index] = replacement;
  } else {
    overrides.push(replacement);
  }
  return { ...config, overrides };
}
