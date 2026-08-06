import type { AppConfig, GameNightConfig } from "../config/types.js";
import type { GameNightOccurrence } from "../schedule/types.js";
import { resolveNightSchedule } from "../schedule/resolve-turn.js";

export type QuickNight = {
  night: GameNightConfig;
  current: GameNightOccurrence;
  next: GameNightOccurrence;
};

export function buildQuickActions(
  config: AppConfig,
  today: string,
): QuickNight[] {
  return config.gameNights
    .map((night, configuredIndex) => {
      // Rotation-only: delay/reschedule act on recurring turns, not extra days.
      const schedule = resolveNightSchedule(config, night, today, 1, false);
      return {
        night,
        current: schedule.current,
        next: schedule.upcoming[0]!,
        configuredIndex,
      };
    })
    .sort(
      (left, right) =>
        left.current.date.localeCompare(right.current.date) ||
        left.configuredIndex - right.configuredIndex,
    )
    .map(({ night, current, next }) => ({ night, current, next }));
}
