import type { AppConfig, GameNightConfig } from "../config/types.js";
import type { GameNightOccurrence } from "../schedule/types.js";
import { resolveNightSchedule } from "../schedule/resolve-turn.js";

export type QuickNight = {
  night: GameNightConfig;
  current: GameNightOccurrence;
  next: GameNightOccurrence;
  reschedule: GameNightOccurrence;
};

export function buildQuickActions(
  config: AppConfig,
  today: string,
): QuickNight[] {
  return config.gameNights
    .map((night, configuredIndex) => {
      const schedule = resolveNightSchedule(config, night, today, 1);
      const recurringSchedule = resolveNightSchedule(
        config,
        night,
        today,
        0,
        false,
      );
      return {
        night,
        current: schedule.current,
        next: schedule.upcoming[0]!,
        reschedule: recurringSchedule.current,
        configuredIndex,
      };
    })
    .sort(
      (left, right) =>
        left.current.date.localeCompare(right.current.date) ||
        left.configuredIndex - right.configuredIndex,
    )
    .map(({ night, current, next, reschedule }) => ({
      night,
      current,
      next,
      reschedule,
    }));
}
