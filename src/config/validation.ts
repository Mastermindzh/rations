import { IANAZone } from "luxon";
import { appConfigSchema, SLUG_PATTERN } from "./schema.js";
import type {
  AppConfig,
  DateOverrideConfig,
  ExtraDayConfig,
  GameNightConfig,
  OverrideConfig,
  ValidationIssue,
} from "./types.js";
import { isValidCalendarDate } from "../schedule/calendar-date.js";
import { dateAlignsWithSchedule } from "../schedule/calculate-schedule.js";
import {
  activeScheduleOccupiesDate,
  dateIsOccupied,
} from "../schedule/date-occupancy.js";

function issue(path: string, message: string): ValidationIssue {
  return { path, message };
}

/** Uniqueness key combining a game-night ID and a date, safe against separators in IDs. */
function nightDateKey(gameNight: string, date: string): string {
  return `${gameNight}\0${date}`;
}

/** Indexes game nights by ID, keeping the first occurrence of any duplicate. */
function indexGameNights(config: AppConfig): Map<string, GameNightConfig> {
  const nights = new Map<string, GameNightConfig>();
  for (const night of config.gameNights) {
    if (!nights.has(night.id)) {
      nights.set(night.id, night);
    }
  }
  return nights;
}

/** Checks the site timezone is a real IANA zone. */
function validateTimezone(config: AppConfig): ValidationIssue[] {
  return IANAZone.isValidZone(config.site.timezone)
    ? []
    : [issue("site.timezone", "Must be a valid IANA timezone")];
}

/** Checks every person ID is a lowercase slug. */
function validatePeopleIds(config: AppConfig): ValidationIssue[] {
  return Object.keys(config.people)
    .filter((personId) => !SLUG_PATTERN.test(personId))
    .map((personId) =>
      issue(`people.${personId}`, "Person ID must be a lowercase slug"),
    );
}

/** Checks one night's roster references known people with no duplicates. */
function validateNightRoster(
  night: GameNightConfig,
  index: number,
  config: AppConfig,
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const seen = new Set<string>();
  night.people.forEach((personId, personIndex) => {
    const path = `gameNights.${index}.people.${personIndex}`;
    if (!config.people[personId]) {
      errors.push(issue(path, `Unknown person: ${personId}`));
    }
    if (seen.has(personId)) {
      errors.push(issue(path, `Duplicate person: ${personId}`));
    }
    seen.add(personId);
  });
  return errors;
}

/** Checks all game nights for duplicate IDs, valid anchor dates, and valid rosters. */
function validateGameNights(config: AppConfig): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const seenIds = new Set<string>();
  config.gameNights.forEach((night, index) => {
    if (seenIds.has(night.id)) {
      errors.push(
        issue(`gameNights.${index}.id`, `Duplicate game-night ID: ${night.id}`),
      );
    }
    seenIds.add(night.id);
    if (!isValidCalendarDate(night.anchorDate)) {
      errors.push(
        issue(
          `gameNights.${index}.anchorDate`,
          "Must be a real ISO calendar date",
        ),
      );
    }
    errors.push(...validateNightRoster(night, index, config));
  });
  return errors;
}

/** Checks one snack-assignment override: known night, eligible person, aligned date. */
function validateOverride(
  override: OverrideConfig,
  index: number,
  night: GameNightConfig | undefined,
  config: AppConfig,
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  if (!night) {
    errors.push(
      issue(
        `overrides.${index}.gameNight`,
        `Unknown game night: ${override.gameNight}`,
      ),
    );
  }
  if (!config.people[override.person]) {
    errors.push(
      issue(`overrides.${index}.person`, `Unknown person: ${override.person}`),
    );
  } else if (night && !night.people.includes(override.person)) {
    errors.push(
      issue(
        `overrides.${index}.person`,
        `${override.person} does not belong to ${night.id}`,
      ),
    );
  }
  if (!isValidCalendarDate(override.date)) {
    errors.push(
      issue(`overrides.${index}.date`, "Must be a real ISO calendar date"),
    );
  } else if (
    night &&
    isValidCalendarDate(night.anchorDate) &&
    !dateAlignsWithSchedule(night, override.date)
  ) {
    errors.push(
      issue(
        `overrides.${index}.date`,
        `Date does not align with ${night.id}'s schedule`,
      ),
    );
  }
  return errors;
}

/** Checks all snack-assignment overrides and rejects duplicates per night and date. */
function validateOverrides(
  config: AppConfig,
  nightById: Map<string, GameNightConfig>,
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const seenKeys = new Set<string>();
  config.overrides.forEach((override, index) => {
    errors.push(
      ...validateOverride(
        override,
        index,
        nightById.get(override.gameNight),
        config,
      ),
    );
    const key = nightDateKey(override.gameNight, override.date);
    if (seenKeys.has(key)) {
      errors.push(
        issue(
          `overrides.${index}`,
          "Only one override is allowed per game night and date",
        ),
      );
    }
    seenKeys.add(key);
  });
  return errors;
}

/** Checks one date override: known night, aligned old date, valid and changed new date. */
function validateDateOverride(
  override: DateOverrideConfig,
  index: number,
  night: GameNightConfig | undefined,
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  if (!night) {
    errors.push(
      issue(
        `dateOverrides.${index}.gameNight`,
        `Unknown game night: ${override.gameNight}`,
      ),
    );
  }
  if (!isValidCalendarDate(override.oldDate)) {
    errors.push(
      issue(
        `dateOverrides.${index}.oldDate`,
        "Must be a real ISO calendar date",
      ),
    );
  } else if (
    night &&
    isValidCalendarDate(night.anchorDate) &&
    !dateAlignsWithSchedule(night, override.oldDate)
  ) {
    errors.push(
      issue(
        `dateOverrides.${index}.oldDate`,
        `Date does not align with ${night.id}'s schedule`,
      ),
    );
  }
  if (!isValidCalendarDate(override.newDate)) {
    errors.push(
      issue(
        `dateOverrides.${index}.newDate`,
        "Must be a real ISO calendar date",
      ),
    );
  }
  if (override.oldDate === override.newDate) {
    errors.push(
      issue(
        `dateOverrides.${index}.newDate`,
        "New date must differ from the old date",
      ),
    );
  }
  return errors;
}

/** Checks all date overrides and rejects duplicate old dates or colliding new dates. */
function validateDateOverrides(
  config: AppConfig,
  nightById: Map<string, GameNightConfig>,
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const oldDateKeys = new Set<string>();
  const newDateKeys = new Set<string>();
  config.dateOverrides.forEach((override, index) => {
    errors.push(
      ...validateDateOverride(
        override,
        index,
        nightById.get(override.gameNight),
      ),
    );
    const oldKey = nightDateKey(override.gameNight, override.oldDate);
    if (oldDateKeys.has(oldKey)) {
      errors.push(
        issue(
          `dateOverrides.${index}`,
          "Only one date override is allowed per game night and old date",
        ),
      );
    }
    oldDateKeys.add(oldKey);
    const newKey = nightDateKey(override.gameNight, override.newDate);
    if (newDateKeys.has(newKey)) {
      errors.push(
        issue(
          `dateOverrides.${index}.newDate`,
          "Two occurrences cannot be moved to the same date",
        ),
      );
    }
    newDateKeys.add(newKey);
  });
  return errors;
}

// A moved date may not land on a still-active scheduled night that was not itself moved away.
function validateMovedDateConflicts(
  config: AppConfig,
  nightById: Map<string, GameNightConfig>,
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  config.dateOverrides.forEach((override, index) => {
    const night = nightById.get(override.gameNight);
    if (
      !night ||
      !isValidCalendarDate(override.newDate) ||
      !isValidCalendarDate(night.anchorDate)
    ) {
      return;
    }
    if (activeScheduleOccupiesDate(config, night, override.newDate)) {
      errors.push(
        issue(
          `dateOverrides.${index}.newDate`,
          `New date conflicts with another scheduled ${night.id} night`,
        ),
      );
    }
  });
  return errors;
}

/** Checks one extra day: known night and a valid, free date. */
function validateExtraDay(
  config: AppConfig,
  extraDay: ExtraDayConfig,
  index: number,
  night: GameNightConfig | undefined,
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  if (!night) {
    errors.push(
      issue(
        `extraDays.${index}.gameNight`,
        `Unknown game night: ${extraDay.gameNight}`,
      ),
    );
  }
  if (!isValidCalendarDate(extraDay.date)) {
    errors.push(
      issue(`extraDays.${index}.date`, "Must be a real ISO calendar date"),
    );
  } else if (night && isValidCalendarDate(night.anchorDate)) {
    if (
      dateIsOccupied(config, night, extraDay.date, {
        includeExtraDays: false,
      })
    ) {
      errors.push(
        issue(
          `extraDays.${index}.date`,
          `Date already has a scheduled ${night.id} night`,
        ),
      );
    }
  }
  return errors;
}

/** Checks all extra days and rejects duplicates or dates that already hold a night. */
function validateExtraDays(
  config: AppConfig,
  nightById: Map<string, GameNightConfig>,
): ValidationIssue[] {
  const errors: ValidationIssue[] = [];
  const seenKeys = new Set<string>();
  config.extraDays.forEach((extraDay, index) => {
    errors.push(
      ...validateExtraDay(
        config,
        extraDay,
        index,
        nightById.get(extraDay.gameNight),
      ),
    );
    const key = nightDateKey(extraDay.gameNight, extraDay.date);
    if (seenKeys.has(key)) {
      errors.push(
        issue(
          `extraDays.${index}`,
          "Only one extra day is allowed per game night and date",
        ),
      );
    }
    seenKeys.add(key);
  });
  return errors;
}

/** Fully validates untrusted input: schema first, then cross-field domain rules. */
export function validateConfig(
  value: unknown,
):
  | { success: true; config: AppConfig }
  | { success: false; errors: ValidationIssue[] } {
  const parsed = appConfigSchema.safeParse(value);

  if (!parsed.success) {
    return {
      success: false,
      errors: parsed.error.issues.map((item) =>
        issue(item.path.length ? item.path.join(".") : "config", item.message),
      ),
    };
  }

  const config = parsed.data as AppConfig;
  const nightById = indexGameNights(config);
  const errors = [
    ...validateTimezone(config),
    ...validatePeopleIds(config),
    ...validateGameNights(config),
    ...validateOverrides(config, nightById),
    ...validateDateOverrides(config, nightById),
    ...validateMovedDateConflicts(config, nightById),
    ...validateExtraDays(config, nightById),
  ];

  return errors.length > 0
    ? { success: false, errors }
    : { success: true, config };
}
