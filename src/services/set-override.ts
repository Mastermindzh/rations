import type { AppConfig, OverrideConfig } from "../config/types.js";

export function setOverride(
  config: AppConfig,
  gameNightId: string,
  date: string,
  personId: string,
  reason?: string,
  isExtra = false,
): AppConfig {
  const base: OverrideConfig = {
    gameNight: gameNightId,
    date,
    person: personId,
    ...(isExtra ? { isExtra: true } : {}),
  };
  const replacement: OverrideConfig = reason ? { ...base, reason } : base;
  const index = config.overrides.findIndex(
    (item) =>
      item.gameNight === gameNightId &&
      item.date === date &&
      Boolean(item.isExtra) === isExtra,
  );
  const overrides = [...config.overrides];
  if (index >= 0) {
    overrides[index] = replacement;
  } else {
    overrides.push(replacement);
  }
  return { ...config, overrides };
}
