import type { AppConfig, GameNightConfig } from "../config/types.js";
import type { GameNightOccurrence } from "../schedule/types.js";
import { resolveRelevantTurn } from "../schedule/resolve-turn.js";

export type OverviewEntry = {
  night: GameNightConfig;
  turn: GameNightOccurrence;
  shareUrl: string;
};

function shareUrl(nightId: string, password?: string): string {
  const path = `/night/${encodeURIComponent(nightId)}`;
  return password
    ? `${path}?${new URLSearchParams({ password }).toString()}`
    : path;
}

export function buildOverviewEntries(
  config: AppConfig,
  today: string,
): OverviewEntry[] {
  return config.gameNights
    .map((night, configuredIndex) => ({
      night,
      turn: resolveRelevantTurn(config, night, today),
      shareUrl: shareUrl(night.id, night.password),
      configuredIndex,
    }))
    .sort(
      (left, right) =>
        left.turn.date.localeCompare(right.turn.date) ||
        left.configuredIndex - right.configuredIndex,
    )
    .map(({ night, turn, shareUrl }) => ({ night, turn, shareUrl }));
}
