import type { AppConfig, PersonConfig } from "../config/types.js";
import type { GameNightOccurrence } from "../schedule/types.js";
import type { Child } from "hono/jsx";
import { DateTime, DateTimeFormatOptions } from "luxon";
import { configuredLocale } from "../config/locale.js";

type OriginalTurnDateProps = {
  turn: GameNightOccurrence;
  timezone: string;
  includeWeekday?: boolean;
  reserveSpace?: boolean;
};

type PortraitProps = {
  person: PersonConfig;
  large?: boolean;
};

type TurnBadgeProps = {
  turn: GameNightOccurrence;
};

type CsrfFieldProps = {
  token: string;
};

type TurnRowProps = {
  config: AppConfig;
  turn: GameNightOccurrence;
  label?: string;
  action?: { href: string; label: string };
};

type HiddenDateDisclosureProps = {
  count: number;
  children: Child;
};

export function formatTurnDate(
  date: string,
  timezone: string,
  includeWeekday = true,
  capitalizeFirst = true,
  locale = configuredLocale(),
): string {
  const value = DateTime.fromISO(date, { zone: timezone }).setLocale(locale);
  const localeOptions: DateTimeFormatOptions = {
    day: "numeric",
    month: "long",
  };
  if (includeWeekday) {
    localeOptions.weekday = "long";
  }

  const uncapitalized = value.toLocaleString(localeOptions);

  return capitalizeFirst
    ? uncapitalized.charAt(0).toUpperCase() + uncapitalized.slice(1)
    : uncapitalized;
}

export const OriginalTurnDate = ({
  turn,
  timezone,
  includeWeekday = true,
  reserveSpace = false,
}: OriginalTurnDateProps) => {
  if (turn.originalDate) {
    return (
      <small class="original-date">
        Originally {formatTurnDate(turn.originalDate, timezone, includeWeekday)}
      </small>
    );
  }
  return reserveSpace ? (
    <small class="original-date original-date-placeholder" aria-hidden="true">
      Originally
    </small>
  ) : null;
};

export function imageUrl(person: PersonConfig): string {
  return person.image
    ? `/images/${encodeURIComponent(person.image)}`
    : "/public/placeholder-avatar.svg";
}

export const Portrait = ({ person, large = false }: PortraitProps) => (
  <div class={large ? "portrait portrait-large" : "portrait"}>
    <img
      src={imageUrl(person)}
      alt={`Portrait of ${person.name}`}
      loading={large ? "eager" : "lazy"}
    />
  </div>
);

export const OverrideBadge = ({ turn }: TurnBadgeProps) =>
  turn.isOverride ? <span class="badge badge-override">Swapped</span> : null;

export const ExtraBadge = ({ turn }: TurnBadgeProps) =>
  turn.isExtra ? <span class="badge badge-extra">Extra</span> : null;

export const TurnRow = ({ config, turn, label, action }: TurnRowProps) => {
  const person = config.people[turn.personId];
  if (!person) {
    return null;
  }
  return (
    <li class="turn-row">
      <Portrait person={person} />
      <div class="turn-copy">
        {label ? <span class="eyebrow">{label}</span> : null}
        <strong>{person.name}</strong>
        <span>
          {formatTurnDate(turn.date, config.site.timezone)}
          <OriginalTurnDate turn={turn} timezone={config.site.timezone} />
        </span>
        {turn.reason ? <small class="turn-reason">{turn.reason}</small> : null}
      </div>
      <OverrideBadge turn={turn} />
      <ExtraBadge turn={turn} />
      {action ? (
        <a class="turn-action" href={action.href}>
          {action.label}
        </a>
      ) : null}
    </li>
  );
};

export const CsrfField = ({ token }: CsrfFieldProps) => (
  <input type="hidden" name="csrfToken" value={token} />
);

export const HiddenDateDisclosure = ({
  count,
  children,
}: HiddenDateDisclosureProps) => {
  if (count === 0) {
    return null;
  }
  return (
    <details class="hidden-dates">
      <summary>
        Show {count} hidden {count === 1 ? "date" : "dates"} (too many can't
        make it)
      </summary>
      {children}
    </details>
  );
};
