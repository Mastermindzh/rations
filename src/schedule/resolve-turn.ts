import type {
  AppConfig,
  ExtraDayConfig,
  GameNightConfig,
} from "../config/types.js";
import type { GameNightOccurrence } from "./types.js";
import {
  basePersonForTurn,
  turnDate,
  turnNumberForDate,
} from "./calculate-schedule.js";

// Counts actual occurrences strictly before `date`. Recurring dates establish
// the baseline; moves remove an occurrence at its old position and insert it at
// its new position, while extra days insert another occurrence. This makes the
// people rotation follow chronological event order rather than logical dates.
function rotationIndexBeforeDate(
  config: AppConfig,
  night: GameNightConfig,
  date: string,
): number {
  const movedOccurrenceAdjustment = config.dateOverrides
    .filter((item) => item.gameNight === night.id)
    .reduce((adjustment, item) => {
      const removedAtOldDate = item.oldDate < date ? -1 : 0;
      const insertedAtNewDate = item.newDate < date ? 1 : 0;
      return adjustment + removedAtOldDate + insertedAtNewDate;
    }, 0);
  const extraOccurrences = config.extraDays.filter(
    (item) => item.gameNight === night.id && item.date < date,
  ).length;

  return (
    turnNumberForDate(night, date) +
    movedOccurrenceAdjustment +
    extraOccurrences
  );
}

// Resolves one logical recurring turn into an actual occurrence. Its base person
// comes from the occurrence's chronological position after date moves and extra
// days; an explicit person override is then layered on top.
export function resolveTurnNumber(
  config: AppConfig,
  night: GameNightConfig,
  turnNumber: number,
): GameNightOccurrence {
  const scheduledDate = turnDate(night, turnNumber);
  const override = config.overrides.find(
    (item) =>
      item.gameNight === night.id &&
      item.date === scheduledDate &&
      !item.isExtra,
  );
  const dateOverride = config.dateOverrides.find(
    (item) => item.gameNight === night.id && item.oldDate === scheduledDate,
  );
  const date = dateOverride?.newDate ?? scheduledDate;
  const originalPersonId = basePersonForTurn(
    night,
    rotationIndexBeforeDate(config, night, date),
  );
  const base = {
    gameNightId: night.id,
    date,
    personId: override?.person ?? originalPersonId,
    originalPersonId,
    isOverride: Boolean(override),
    isExtra: false,
    turnNumber,
  };
  const dated = dateOverride ? { ...base, originalDate: scheduledDate } : base;
  return override?.reason ? { ...dated, reason: override.reason } : dated;
}

// An extra day takes the next person in the rotation: its index is the number of
// occurrences (scheduled turns plus earlier extra days) that precede its date.
export function resolveExtraDay(
  config: AppConfig,
  night: GameNightConfig,
  extraDay: ExtraDayConfig,
): GameNightOccurrence {
  const rotationIndex = rotationIndexBeforeDate(config, night, extraDay.date);
  const originalPersonId = basePersonForTurn(night, rotationIndex);
  const override = config.overrides.find(
    (item) =>
      item.gameNight === night.id &&
      item.date === extraDay.date &&
      item.isExtra,
  );
  const base: GameNightOccurrence = {
    gameNightId: night.id,
    date: extraDay.date,
    personId: override?.person ?? originalPersonId,
    originalPersonId,
    isOverride: Boolean(override),
    isExtra: true,
    turnNumber: -1,
  };
  return extraDay.reason ? { ...base, reason: extraDay.reason } : base;
}

// The single current occurrence: the soonest turn on or after `currentDate`.
export function resolveRelevantTurn(
  config: AppConfig,
  night: GameNightConfig,
  currentDate: string,
): GameNightOccurrence {
  return resolveFutureTurns(config, night, currentDate, 1)[0]!;
}

// The current occurrence plus the next `upcomingCount`. Pass includeExtraDays
// false when a caller explicitly needs a recurring-only projection.
export function resolveNightSchedule(
  config: AppConfig,
  night: GameNightConfig,
  currentDate: string,
  upcomingCount = night.people.length,
  includeExtraDays = true,
): { current: GameNightOccurrence; upcoming: GameNightOccurrence[] } {
  const turns = resolveFutureTurns(
    config,
    night,
    currentDate,
    upcomingCount + 1,
    includeExtraDays,
  );
  return { current: turns[0]!, upcoming: turns.slice(1) };
}

// Builds the soonest `count` occurrences on or after `currentDate`: it generates
// candidate turn numbers (with extra buffer for reschedules), resolves them plus
// any extra days, then filters to future dates and sorts by date. Upcoming extra
// days are always kept, even beyond `count`.
function resolveFutureTurns(
  config: AppConfig,
  night: GameNightConfig,
  currentDate: string,
  count: number,
  includeExtraDays = true,
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

  const recurring = [...turnNumbers].map((turnNumber) =>
    resolveTurnNumber(config, night, turnNumber),
  );
  const extra = includeExtraDays
    ? config.extraDays
        .filter((item) => item.gameNight === night.id)
        .map((item) => resolveExtraDay(config, night, item))
    : [];

  return [...recurring, ...extra]
    .filter((turn) => turn.date >= currentDate)
    .sort(
      (left, right) =>
        left.date.localeCompare(right.date) ||
        left.turnNumber - right.turnNumber,
    )
    .filter((turn, index) => index < count || turn.isExtra);
}
