import { ConfigError } from "./config-error.js";
import type { AppConfig, GameNightConfig } from "./types.js";

export function requireGameNight(
  config: AppConfig,
  gameNightId: string,
): GameNightConfig {
  const night = config.gameNights.find((item) => item.id === gameNightId);
  if (!night) {
    throw new ConfigError("Unknown game night", "UNKNOWN_GAME_NIGHT");
  }
  return night;
}

export function personName(config: AppConfig, personId: string): string {
  return config.people[personId]?.name ?? personId;
}
