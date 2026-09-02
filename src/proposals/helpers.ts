import { randomBytes } from "node:crypto";
import type { AppConfig, GameNightConfig } from "../config/types.js";
import { createDateOccupancyChecker } from "../schedule/date-occupancy.js";
import type { PlannerProposal, Proposal, ProposalVote } from "./types.js";

export type VoteDetails = { up: string[]; down: string[] };
export type VoteTally = { up: number; down: number };
export type VoteInput = {
  person: string;
  date: string;
  vote: ProposalVote["vote"];
};

export function aggregateVotes(
  votes: ProposalVote[],
): Map<string, VoteDetails> {
  const byDate = new Map<string, VoteDetails>();
  for (const entry of votes) {
    const details = byDate.get(entry.date) ?? { up: [], down: [] };
    details[entry.vote].push(entry.person);
    byDate.set(entry.date, details);
  }
  return byDate;
}

export function newProposalId(type: Proposal["type"]): string {
  return `${type}-${randomBytes(6).toString("hex")}`;
}

export function voteTally(
  proposal: Proposal,
  date: string,
): VoteTally {
  const details = aggregateVotes(proposal.votes).get(date);
  return { up: details?.up.length ?? 0, down: details?.down.length ?? 0 };
}

// Upserts one person's vote for a date.
export function applyVote(
  votes: ProposalVote[],
  entry: VoteInput,
): ProposalVote[] {
  const others = votes.filter(
    (vote) => !(vote.date === entry.date && vote.person === entry.person),
  );
  return [
    ...others,
    { date: entry.date, person: entry.person, vote: entry.vote },
  ];
}

// Planner candidates hidden from voters once enough people vote "can't make it".
export function eliminatedCandidates(
  proposal: PlannerProposal,
): Set<string> {
  const threshold = proposal.unavailableThreshold;
  if (!threshold) {
    return new Set();
  }
  const eliminated = new Set<string>();
  const tallies = aggregateVotes(proposal.votes);
  for (const date of proposal.candidates) {
    if ((tallies.get(date)?.down.length ?? 0) >= threshold) {
      eliminated.add(date);
    }
  }
  return eliminated;
}

// Novel future dates to add as extra days: drops past dates and ones already occupied.
export function datesToApply(
  config: AppConfig,
  night: GameNightConfig,
  dates: string[],
  today: string,
): string[] {
  const seen = new Set<string>();
  const isOccupied = createDateOccupancyChecker(config, night);
  return dates.filter((date) => {
    if (date < today || seen.has(date)) {
      return false;
    }
    seen.add(date);
    return !isOccupied(date);
  });
}
