import type { AppConfig } from "../config/types.js";
import { ConfigError } from "../config/config-error.js";
import { personName, requireGameNight } from "../config/lookups.js";
import { resolveRelevantTurn } from "../schedule/resolve-turn.js";
import { applySkipNight } from "../services/skip-night.js";
import { formatTurnDate } from "./shared.js";

export const SkipPreview = ({
  config,
  gameNightId,
  date,
}: {
  config: AppConfig;
  gameNightId: string;
  date: string;
}) => {
  try {
    const updated = applySkipNight(config, gameNightId, date);
    const night = requireGameNight(config, gameNightId);
    const current = resolveRelevantTurn(config, night, date);
    const next = resolveRelevantTurn(updated, night, date);
    return (
      <p class="muted small">
        Skip {formatTurnDate(date, config.site.timezone)} (
        {personName(config, current.personId)}). Next actual night:{" "}
        {formatTurnDate(next.date, config.site.timezone)} -{" "}
        {personName(config, next.personId)}.
      </p>
    );
  } catch (error) {
    if (!(error instanceof ConfigError)) throw error;
    return <p class="muted small">{error.message}</p>;
  }
};
