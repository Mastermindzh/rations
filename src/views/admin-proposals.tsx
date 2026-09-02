import type { AppConfig } from "../config/types.js";
import type { Proposal } from "../proposals/types.js";
import { DateTime } from "luxon";
import { configuredLocale } from "../config/locale.js";
import { personName } from "../config/lookups.js";
import {
  aggregateVotes,
  eliminatedCandidates,
  type VoteDetails,
} from "../proposals/helpers.js";
import { CsrfField, formatTurnDate, HiddenDateDisclosure } from "./shared.js";

type TallyProps = {
  config: AppConfig;
  details: VoteDetails;
};

type ActionsProps = {
  id: string;
};

type ProposalRowProps<TProposal extends Proposal> = {
  config: AppConfig;
  proposal: TProposal;
  csrfToken: string;
};

type AdminProposalsSectionProps = {
  config: AppConfig;
  proposals: Proposal[];
  csrfToken: string;
};

const createdLabel = (config: AppConfig, createdAt: string): string => {
  return DateTime.fromISO(createdAt)
    .setZone(config.site.timezone)
    .setLocale(configuredLocale())
    .toLocaleString(DateTime.DATETIME_MED);
};

const voterTitle = (config: AppConfig, people: string[]): string => {
  const names = people.map((person) => personName(config, person));
  return names.length ? names.join(", ") : "No votes yet";
};

const Tally = ({ config, details }: TallyProps) => {
  return (
    <>
      <span title={voterTitle(config, details.up)}>👍 {details.up.length}</span>{" "}
      <span title={voterTitle(config, details.down)}>
        👎 {details.down.length}
      </span>
    </>
  );
};

const Actions = ({ id: proposalId }: ActionsProps) => (
  <div class="proposal-actions">
    <button class="button button-accent" type="submit">
      Approve
    </button>
    <button
      class="button"
      type="submit"
      formaction={`/admin/proposals/${proposalId}/deny`}
      data-confirm="Deny this proposal?"
    >
      Deny
    </button>
    <button
      class="button button-quiet"
      type="submit"
      formaction={`/admin/proposals/${proposalId}/delete`}
      data-confirm="Delete this proposal?"
    >
      Delete
    </button>
  </div>
);

const SwapRow = ({
  config,
  proposal,
  csrfToken,
}: ProposalRowProps<Extract<Proposal, { type: "swap" }>>) => {
  const tallies = aggregateVotes(proposal.votes);
  return (
    <form method="post" action={`/admin/proposals/${proposal.id}/approve`}>
      <CsrfField token={csrfToken} />
      <p>
        <strong>
          {formatTurnDate(proposal.targetDate, config.site.timezone)}
        </strong>{" "}
        → {formatTurnDate(proposal.newDate, config.site.timezone)} ·{" "}
        <Tally
          config={config}
          details={tallies.get(proposal.newDate) ?? { up: [], down: [] }}
        />
      </p>
      <Actions id={proposal.id} />
    </form>
  );
};

const PlannerRow = ({
  config,
  proposal,
  csrfToken,
}: ProposalRowProps<Extract<Proposal, { type: "planner" }>>) => {
  const eliminated = eliminatedCandidates(proposal);
  const tallies = aggregateVotes(proposal.votes);
  const visible = proposal.candidates.filter((date) => !eliminated.has(date));
  const hidden = proposal.candidates.filter((date) => eliminated.has(date));
  const row = (date: string) => (
    <li>
      <label class="admin-candidate-option">
        <input
          type="checkbox"
          name="dates"
          value={date}
          checked={!eliminated.has(date)}
        />
        <span class="admin-candidate-copy">
          <span>
            {formatTurnDate(date, config.site.timezone)} ·{" "}
            <Tally
              config={config}
              details={tallies.get(date) ?? { up: [], down: [] }}
            />
          </span>
          {eliminated.has(date) ? (
            <span class="badge badge-muted">Eliminated</span>
          ) : null}
        </span>
      </label>
    </li>
  );
  return (
    <form method="post" action={`/admin/proposals/${proposal.id}/approve`}>
      <CsrfField token={csrfToken} />
      <ul
        class={`candidate-list admin-candidate-list${
          visible.length > 7 ? " candidate-list-scroll" : ""
        }`}
      >
        {visible.map(row)}
      </ul>
      <HiddenDateDisclosure count={hidden.length}>
        <ul
          class={`candidate-list admin-candidate-list${
            hidden.length > 7 ? " candidate-list-scroll" : ""
          }`}
        >
          {hidden.map(row)}
        </ul>
      </HiddenDateDisclosure>
      <Actions id={proposal.id} />
    </form>
  );
};

export const AdminProposalsSection = ({
  config,
  proposals,
  csrfToken,
}: AdminProposalsSectionProps) => {
  if (proposals.length === 0) {
    return null;
  }
  return (
    <section class="admin-section">
      <div class="section-heading">
        <div>
          <span class="eyebrow">Community</span>
          <h2>Date proposals</h2>
        </div>
      </div>
      <div class="proposal-grid">
        {proposals.map((proposal) => {
          const night = config.gameNights.find(
            (item) => item.id === proposal.gameNight,
          );
          return (
            <article class="proposal-card">
              <div class="quick-title">
                <h3>{night?.name ?? proposal.gameNight}</h3>
                <a href={`/night/${proposal.gameNight}/proposals`}>
                  Vote page ↗
                </a>
              </div>
              <div class="proposal-meta">
                <span class="badge badge-muted">
                  {proposal.type === "planner" ? "Planner" : "Swap"}
                </span>
                <span class="badge badge-extra">Open</span>
                <time datetime={proposal.createdAt}>
                  {createdLabel(config, proposal.createdAt)}
                </time>
              </div>
              <p class="muted small">
                by {personName(config, proposal.createdBy)}
              </p>
              {proposal.type === "swap" ? (
                <SwapRow
                  config={config}
                  proposal={proposal}
                  csrfToken={csrfToken}
                />
              ) : (
                <PlannerRow
                  config={config}
                  proposal={proposal}
                  csrfToken={csrfToken}
                />
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
};
