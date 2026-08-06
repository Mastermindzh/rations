import type { AppConfig, PersonConfig } from "../config/types.js";
import type { GameNightOccurrence } from "../schedule/types.js";
import { DateTime } from "luxon";

export function formatTurnDate(
  date: string,
  timezone: string,
  includeWeekday = true,
): string {
  const value = DateTime.fromISO(date, { zone: timezone }).setLocale("en-GB");
  return value.toFormat(includeWeekday ? "cccc, d LLLL" : "d LLLL");
}

export const OriginalTurnDate = ({
  turn,
  timezone,
  includeWeekday = true,
  reserveSpace = false,
}: {
  turn: GameNightOccurrence;
  timezone: string;
  includeWeekday?: boolean;
  reserveSpace?: boolean;
}) => {
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

export const Portrait = ({
  person,
  large = false,
}: {
  person: PersonConfig;
  large?: boolean;
}) => (
  <div class={large ? "portrait portrait-large" : "portrait"}>
    <img
      src={imageUrl(person)}
      alt={`Portrait of ${person.name}`}
      loading={large ? "eager" : "lazy"}
    />
  </div>
);

export const OverrideBadge = ({ turn }: { turn: GameNightOccurrence }) =>
  turn.isOverride ? <span class="badge badge-override">Swapped</span> : null;

export const ExtraBadge = ({ turn }: { turn: GameNightOccurrence }) =>
  turn.isExtra ? <span class="badge badge-extra">Extra</span> : null;

export const TurnRow = ({
  config,
  turn,
  label,
}: {
  config: AppConfig;
  turn: GameNightOccurrence;
  label?: string;
}) => {
  const person = config.people[turn.personId];
  if (!person) return null;
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
    </li>
  );
};

export const CsrfField = ({ token }: { token: string }) => (
  <input type="hidden" name="csrfToken" value={token} />
);
