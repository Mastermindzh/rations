import type { AppConfig, GameNightConfig } from "../config/types.js";
import type { GameNightOccurrence } from "./types.js";
import {
  basePersonForTurn,
  turnDate,
  turnNumberForDate,
} from "./calculate-schedule.js";

export function resolveTurnNumber(
  config: AppConfig,
  night: GameNightConfig,
  turnNumber: number,
): GameNightOccurrence {
  const scheduledDate = turnDate(night, turnNumber);
  const originalPersonId = basePersonForTurn(night, turnNumber);
  const override = config.overrides.find(
    (item) => item.gameNight === night.id && item.date === scheduledDate,
  );
  const dateOverride = config.dateOverrides.find(
    (item) => item.gameNight === night.id && item.oldDate === scheduledDate,
  );
  const base = {
    gameNightId: night.id,
    date: dateOverride?.newDate ?? scheduledDate,
    personId: override?.person ?? originalPersonId,
    originalPersonId,
    isOverride: Boolean(override),
    turnNumber,
  };
  const dated = dateOverride ? { ...base, originalDate: scheduledDate } : base;
  return override?.reason ? { ...dated, reason: override.reason } : dated;
}

export function resolveRelevantTurn(
  config: AppConfig,
  night: GameNightConfig,
  currentDate: string,
): GameNightOccurrence {
  return resolveFutureTurns(config, night, currentDate, 1)[0]!;
}

export function resolveNightSchedule(
  config: AppConfig,
  night: GameNightConfig,
  currentDate: string,
  upcomingCount = night.people.length,
): { current: GameNightOccurrence; upcoming: GameNightOccurrence[] } {
  const turns = resolveFutureTurns(
    config,
    night,
    currentDate,
    upcomingCount + 1,
  );
  return { current: turns[0]!, upcoming: turns.slice(1) };
}

function resolveFutureTurns(
  config: AppConfig,
  night: GameNightConfig,
  currentDate: string,
  count: number,
): GameNightOccurrence[] {
  const dateOverrides = config.dateOverrides.filter(
    (item) => item.gameNight === night.id,
  );
  const firstScheduledTurn = turnNumberForDate(night, currentDate);
  const turnNumbers = new Set<number>();

  for (let offset = 0; offset < count + dateOverrides.length + 1; offset += 1) {
    turnNumbers.add(firstScheduledTurn + offset);
  }
  for (const override of dateOverrides) {
    turnNumbers.add(turnNumberForDate(night, override.oldDate));
  }

  return [...turnNumbers]
    .map((turnNumber) => resolveTurnNumber(config, night, turnNumber))
    .filter((turn) => turn.date >= currentDate)
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.turnNumber - right.turnNumber,
    )
    .slice(0, count);
}
