import type { AppConfig, GameNightConfig } from "../config/types.js";
import { personName } from "../config/lookups.js";
import type { Proposal, ProposalVote } from "../proposals/types.js";
import type { ShortcutKind } from "../schedule/date-ranges.js";
import { aggregateVotes, eliminatedCandidates } from "../proposals/helpers.js";
import { Layout } from "./layout.js";
import { formatTurnDate, HiddenDateDisclosure } from "./shared.js";
import { ErrorNotice } from "./notice-banner.js";

const PersonSelect = ({
  config,
  night,
  selected,
}: {
  config: AppConfig;
  night: GameNightConfig;
  selected?: string;
}) => (
  <select name="person" required data-person-select>
    <option value="" disabled selected={!selected}>
      Who are you?
    </option>
    {night.people.map((id) => (
      <option value={id} selected={selected === id}>
        {personName(config, id)}
      </option>
    ))}
  </select>
);

export const SwapProposePage = ({
  config,
  night,
  targetDate,
  password,
  error,
}: {
  config: AppConfig;
  night: GameNightConfig;
  targetDate: string;
  password?: string;
  error?: string;
}) => (
  <Layout title="Propose a swap" siteTitle={config.site.title} scripts>
    <a class="back-link" href={`/night/${night.id}`}>
      ← Back to {night.name}
    </a>
    <h1>Propose a new date</h1>
    <p>
      Move the game on{" "}
      <strong>{formatTurnDate(targetDate, config.site.timezone)}</strong> to
      another day. Everyone votes, then an admin confirms.
    </p>
    <ErrorNotice message={error} />
    <form
      class="stacked-form"
      method="post"
      data-voter-cookie-path={`/night/${night.id}`}
    >
      {password ? (
        <input type="hidden" name="password" value={password} />
      ) : null}
      <input type="hidden" name="targetDate" value={targetDate} />
      <label>
        New date
        <input type="date" name="newDate" required />
      </label>
      <label>
        Your name
        <PersonSelect config={config} night={night} />
      </label>
      <button class="button button-accent" type="submit">
        Propose swap
      </button>
    </form>
  </Layout>
);

const VoteGroup = ({
  config,
  night,
  proposalId,
  dates,
  hidden = [],
  votes,
  password,
}: {
  config: AppConfig;
  night: GameNightConfig;
  proposalId: string;
  dates: string[];
  hidden?: string[];
  votes: ProposalVote[];
  password?: string;
}) => {
  const byDate: Record<string, Record<string, "up" | "down">> = {};
  for (const vote of votes) {
    (byDate[vote.date] ??= {})[vote.person] = vote.vote;
  }
  const tallies = aggregateVotes(votes);
  const names = (date: string, dir: "up" | "down") =>
    (tallies.get(date)?.[dir] ?? []).map((person) =>
      personName(config, person),
    );
  const peopleNames = Object.fromEntries(
    night.people.map((id) => [id, personName(config, id)]),
  );
  const row = (date: string) => {
    const up = names(date, "up");
    const down = names(date, "down");
    return (
      <li class="candidate-row" data-date-row data-date={date}>
        <span class="candidate-date">
          {formatTurnDate(date, config.site.timezone)}
        </span>
        <div class="vote-buttons">
          <button
            type="button"
            data-vote-button
            data-vote="up"
            title={up.length ? up.join(", ") : "No votes yet"}
          >
            👍 {up.length}
          </button>
          <button
            type="button"
            data-vote-button
            data-vote="down"
            title={down.length ? down.join(", ") : "No votes yet"}
          >
            👎 {down.length}
          </button>
        </div>
        <form
          class="visually-hidden"
          method="post"
          action={`/proposals/${proposalId}/vote`}
          data-vote-form
        >
          {password ? (
            <input type="hidden" name="password" value={password} />
          ) : null}
          <input type="hidden" name="date" value={date} />
          <input type="hidden" name="person" data-person />
          <input type="hidden" name="vote" data-vote-value />
        </form>
      </li>
    );
  };
  return (
    <div
      class="vote-group"
      data-vote-group
      data-voter-cookie-path={`/night/${night.id}`}
      data-votes={JSON.stringify(byDate)}
      data-people={JSON.stringify(peopleNames)}
    >
      <label class="voter-select">
        <span>Your name</span>
        <select data-voter>
          <option value="" selected>
            Who are you?
          </option>
          {night.people.map((id) => (
            <option value={id}>{personName(config, id)}</option>
          ))}
        </select>
      </label>
      <ul class="candidate-list">{dates.map(row)}</ul>
      <HiddenDateDisclosure count={hidden.length}>
        <ul class="candidate-list">{hidden.map(row)}</ul>
      </HiddenDateDisclosure>
      <noscript>
        <p class="muted small">Voting needs JavaScript enabled.</p>
      </noscript>
    </div>
  );
};

const SwapProposalCard = ({
  config,
  night,
  proposal,
  password,
}: {
  config: AppConfig;
  night: GameNightConfig;
  proposal: Extract<Proposal, { type: "swap" }>;
  password?: string;
}) => (
  <article class="proposal-card">
    <h3>Move to {formatTurnDate(proposal.newDate, config.site.timezone)}</h3>
    <p class="muted small">
      Instead of {formatTurnDate(proposal.targetDate, config.site.timezone)} ·
      by {personName(config, proposal.createdBy)}
    </p>
    <VoteGroup
      config={config}
      night={night}
      proposalId={proposal.id}
      dates={[proposal.newDate]}
      votes={proposal.votes}
      {...(password ? { password } : {})}
    />
  </article>
);

const PlannerProposalCard = ({
  config,
  night,
  proposal,
  today,
  password,
}: {
  config: AppConfig;
  night: GameNightConfig;
  proposal: Extract<Proposal, { type: "planner" }>;
  today: string;
  password?: string;
}) => {
  const eliminated = eliminatedCandidates(proposal);
  const future = proposal.candidates.filter((date) => date >= today);
  const visible = future.filter((date) => !eliminated.has(date));
  const hidden = future.filter((date) => eliminated.has(date));
  return (
    <article class="proposal-card">
      <h3>{proposal.title ?? "Proposed dates"}</h3>
      <p class="muted small">by {personName(config, proposal.createdBy)}</p>
      <VoteGroup
        config={config}
        night={night}
        proposalId={proposal.id}
        dates={visible}
        hidden={hidden}
        votes={proposal.votes}
        {...(password ? { password } : {})}
      />
    </article>
  );
};

export const NightProposalsPage = ({
  config,
  night,
  proposals,
  today,
  password,
}: {
  config: AppConfig;
  night: GameNightConfig;
  proposals: Proposal[];
  today: string;
  password?: string;
}) => {
  const current = proposals.filter((proposal) =>
    proposal.type === "swap"
      ? proposal.newDate >= today
      : proposal.candidates.some((date) => date >= today),
  );
  return (
    <Layout title="Proposals" siteTitle={config.site.title} scripts>
      <a class="back-link" href={`/night/${night.id}`}>
        ← Back to {night.name}
      </a>
      <h1>Vote on dates for {night.name}</h1>
      {current.length === 0 ? (
        <div class="empty-state">
          <p>No open proposals right now.</p>
        </div>
      ) : (
        <div class="proposal-grid">
          {current.map((proposal) =>
            proposal.type === "swap" ? (
              <SwapProposalCard
                config={config}
                night={night}
                proposal={proposal}
                {...(password ? { password } : {})}
              />
            ) : (
              <PlannerProposalCard
                config={config}
                night={night}
                proposal={proposal}
                today={today}
                {...(password ? { password } : {})}
              />
            ),
          )}
        </div>
      )}
    </Layout>
  );
};

const SHORTCUT_LABELS: Record<ShortcutKind, string> = {
  "this-week": "This week",
  "next-week": "Next week",
  "this-month": "This month",
  "next-month": "Next month",
};

export const PlannerProposePage = ({
  config,
  night,
  today,
  shortcuts,
  password,
  error,
}: {
  config: AppConfig;
  night: GameNightConfig;
  today: string;
  shortcuts: Record<ShortcutKind, string[]>;
  password?: string;
  error?: string;
}) => (
  <Layout title="Propose dates" siteTitle={config.site.title} scripts>
    <a class="back-link" href={`/night/${night.id}`}>
      ← Back to {night.name}
    </a>
    <h1>Propose dates for {night.name}</h1>
    <p>
      Add the days that could work, then everyone votes. An admin adds the
      winners to the schedule.
    </p>
    <ErrorNotice message={error} />
    <form
      class="stacked-form"
      method="post"
      data-planner-form
      data-today={today}
      data-voter-cookie-path={`/night/${night.id}`}
    >
      {password ? (
        <input type="hidden" name="password" value={password} />
      ) : null}
      <label>
        Your name
        <PersonSelect config={config} night={night} />
      </label>
      <label>
        Title (optional)
        <input
          type="text"
          name="title"
          maxlength={80}
          placeholder="Holiday week"
        />
      </label>

      <fieldset class="date-picker">
        <legend>Dates</legend>
        <div class="shortcut-row">
          {(Object.keys(SHORTCUT_LABELS) as ShortcutKind[]).map((kind) => (
            <button
              type="button"
              class="button button-quiet"
              data-shortcut
              data-dates={shortcuts[kind].join(",")}
            >
              {SHORTCUT_LABELS[kind]}
            </button>
          ))}
        </div>
        <div class="add-one">
          <input type="date" data-add-date />
          <button type="button" class="button" data-add-date-button>
            Add day
          </button>
        </div>
        <div class="add-range">
          <input type="date" data-range-start aria-label="Range start" />
          <span aria-hidden="true">→</span>
          <input type="date" data-range-end aria-label="Range end" />
          <button type="button" class="button" data-add-range-button>
            Add range
          </button>
        </div>
        <div class="date-chips" data-chips aria-live="polite"></div>
        <noscript>
          <p class="muted small">
            Adding dates needs JavaScript. Enable it to use this form.
          </p>
        </noscript>
      </fieldset>

      <label class="threshold-row">
        <input type="checkbox" name="thresholdEnabled" data-threshold-toggle />{" "}
        Hide a date once{" "}
        <input
          type="number"
          name="threshold"
          min="1"
          value="2"
          data-threshold-input
          disabled
        />{" "}
        people can't make it
      </label>

      <button class="button button-accent" type="submit">
        Share for voting
      </button>
    </form>
  </Layout>
);
