import type { AppConfig, GameNightConfig } from "../config/types.js";
import type { GameNightOccurrence } from "../schedule/types.js";
import { withSharePassword } from "../services/share-access.js";
import { Layout } from "./layout.js";
import {
  formatTurnDate,
  OriginalTurnDate,
  OverrideBadge,
  ExtraBadge,
  Portrait,
} from "./shared.js";

type OverviewPageProps = {
  config: AppConfig;
  entries: Array<{
    night: GameNightConfig;
    turn: GameNightOccurrence;
    shareUrl: string;
  }>;
  admin: boolean;
  proposalCounts?: Record<string, number>;
  csrfToken?: string;
};

export const OverviewPage = ({
  config,
  entries,
  admin,
  proposalCounts = {},
  csrfToken,
}: OverviewPageProps) => (
  <Layout
    title={config.site.title}
    siteTitle={config.site.title}
    admin={admin}
    scripts
    {...(csrfToken ? { csrfToken } : {})}
  >
    {entries.length ? (
      <section class="night-grid" aria-label="Game nights">
        {entries.map(({ night, turn, shareUrl }) => {
          const person = config.people[turn.personId];
          if (!person) {
            return null;
          }
          return (
            <article class="night-card">
              <a
                class="card-link"
                href={shareUrl}
                aria-label={`View ${night.name}`}
              ></a>
              <div class="card-heading">
                <div>
                  <h2>{night.name}</h2>
                </div>
                <div class="card-actions">
                  <button
                    class="share-link"
                    type="button"
                    data-share-url={shareUrl}
                    aria-label={`Copy share link for ${night.name}`}
                    aria-live="polite"
                  >
                    Share
                  </button>
                  <span class="arrow" aria-hidden="true">
                    ↗
                  </span>
                </div>
              </div>
              {night.description ? (
                <p class="description">{night.description}</p>
              ) : null}
              <span class="player-count">
                <svg
                  class="player-count-icon"
                  viewBox="0 0 16 16"
                  aria-hidden="true"
                >
                  <circle cx="8" cy="5" r="3" />
                  <path d="M2.5 14c.4-3.2 2.2-4.8 5.5-4.8s5.1 1.6 5.5 4.8" />
                </svg>
                {night.people.length}{" "}
                {night.people.length === 1 ? "player" : "players"}
              </span>
              <div class="card-person">
                <Portrait person={person} />
                <div>
                  <strong>{person.name}</strong>
                  <span>
                    {formatTurnDate(turn.date, config.site.timezone)}
                    <OriginalTurnDate
                      turn={turn}
                      timezone={config.site.timezone}
                    />
                  </span>
                </div>
                <OverrideBadge turn={turn} />
                <ExtraBadge turn={turn} />
              </div>
              {proposalCounts[night.id] ? (
                <a
                  class="card-proposals"
                  href={withSharePassword(
                    `/night/${night.id}/proposals`,
                    night.password,
                  )}
                >
                  {proposalCounts[night.id]} open date{" "}
                  {proposalCounts[night.id] === 1 ? "proposal" : "proposals"} →
                </a>
              ) : null}
            </article>
          );
        })}
      </section>
    ) : (
      <div class="empty-state">
        <h2>No game nights yet</h2>
        <p>Add one in the configuration to begin.</p>
      </div>
    )}
  </Layout>
);
