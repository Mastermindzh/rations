import type { AppConfig, GameNightConfig } from "../config/types.js";
import type { GameNightOccurrence } from "../schedule/types.js";
import type { Proposal } from "../proposals/types.js";
import { withSharePassword } from "../services/share-access.js";
import { Layout } from "./layout.js";
import {
  formatTurnDate,
  OriginalTurnDate,
  OverrideBadge,
  ExtraBadge,
  Portrait,
  TurnRow,
} from "./shared.js";

type GameNightPageProps = {
  config: AppConfig;
  night: GameNightConfig;
  schedule: { current: GameNightOccurrence; upcoming: GameNightOccurrence[] };
  admin: boolean;
  csrfToken?: string;
  password?: string;
  openProposals?: Proposal[];
};

const proposalLabel = (config: AppConfig, proposal: Proposal): string => {
  if (proposal.type === "swap") {
    return `Move ${formatTurnDate(proposal.targetDate, config.site.timezone)} → ${formatTurnDate(proposal.newDate, config.site.timezone)}`;
  }
  return proposal.title ?? "Proposed dates";
};

export const GameNightPage = ({
  config,
  night,
  schedule,
  admin,
  csrfToken,
  password,
  openProposals = [],
}: GameNightPageProps) => {
  const person = config.people[schedule.current.personId]!;
  const next = schedule.upcoming[0];
  const nextPerson = next ? config.people[next.personId] : undefined;
  const withPassword = (path: string) => withSharePassword(path, password);
  return (
    <Layout
      title={night.name}
      siteTitle={config.site.title}
      admin={admin}
      mainClass="game-night-page"
      {...(csrfToken ? { csrfToken } : {})}
    >
      {admin ? (
        <a class="back-link" href="/">
          ← All game nights
        </a>
      ) : null}
      <section class="night-hero">
        <div class="hero-copy">
          <h1>{night.name}</h1>
          {night.description ? <p>{night.description}</p> : null}
        </div>
        <div class="hero-person">
          <Portrait person={person} large />
          <div class="hero-name">
            <OverrideBadge turn={schedule.current} />
            <ExtraBadge turn={schedule.current} />
            <h2>{person.name}</h2>
            <p>
              {formatTurnDate(schedule.current.date, config.site.timezone)}
              <OriginalTurnDate
                turn={schedule.current}
                timezone={config.site.timezone}
              />
            </p>
            {schedule.current.reason ? (
              <span class="override-reason">{schedule.current.reason}</span>
            ) : null}
          </div>
        </div>
        {nextPerson ? (
          <p class="next-callout">
            Next up <strong>{nextPerson.name}</strong> ·{" "}
            {formatTurnDate(next!.date, config.site.timezone)}
            <OriginalTurnDate
              turn={next!}
              timezone={config.site.timezone}
              includeWeekday={false}
            />
          </p>
        ) : null}
      </section>
      <div class="night-panels">
        {openProposals.length ? (
          <details class="night-panel" open>
            <summary>
              {openProposals.length} open date{" "}
              {openProposals.length === 1 ? "proposal" : "proposals"}
            </summary>
            <ul class="panel-list">
              {openProposals.map((proposal) => (
                <li>{proposalLabel(config, proposal)}</li>
              ))}
            </ul>
            <a
              class="button button-accent"
              href={withPassword(`/night/${night.id}/proposals`)}
            >
              Vote on these dates →
            </a>
          </details>
        ) : null}
        <details class="night-panel">
          <summary>Suggest a change</summary>
          <div class="night-actions-links">
            <a
              class="button"
              href={withPassword(
                `/night/${night.id}/date/${schedule.current.date}/propose-swap`,
              )}
            >
              Propose moving this date
            </a>
            <a class="button" href={withPassword(`/night/${night.id}/propose`)}>
              Propose new date(s)
            </a>
          </div>
        </details>
        <details class="night-panel">
          <summary>Schedule</summary>
          <ul class="turn-list">
            {schedule.upcoming.map((turn, index) => (
              <TurnRow
                config={config}
                turn={turn}
                action={{
                  href: withPassword(
                    `/night/${night.id}/date/${turn.date}/propose-swap`,
                  ),
                  label: "Propose new date",
                }}
                {...(index === 0 ? { label: "Next" } : {})}
              />
            ))}
          </ul>
        </details>
      </div>
    </Layout>
  );
};
