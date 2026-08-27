import { z } from "zod";
import { SLUG_PATTERN } from "../config/schema.js";
import {
  ISO_DATE_PATTERN,
  isValidCalendarDate,
} from "../schedule/calendar-date.js";
import { MAX_PROPOSAL_CANDIDATES, MAX_TOTAL_PROPOSALS } from "./constraints.js";

type ProposalWithVotes = {
  votes: Array<{ date: string; person: string }>;
};

const isoDate = z
  .string()
  .regex(ISO_DATE_PATTERN, "Must be an ISO date (YYYY-MM-DD)")
  .refine(isValidCalendarDate, "Must be a real calendar date");

export const proposalVoteSchema = z.strictObject({
  date: isoDate,
  person: z.string(),
  vote: z.enum(["up", "down"]),
});

const baseFields = {
  id: z.string().regex(SLUG_PATTERN, "Must be a lowercase slug"),
  gameNight: z.string(),
  createdBy: z.string(),
  createdAt: z.iso.datetime({ message: "Must be an ISO instant" }),
  title: z.string().trim().min(1).max(80).optional(),
  votes: z.array(proposalVoteSchema).default([]),
};

const votesAreUnique = (proposal: ProposalWithVotes): boolean => {
  const keys = proposal.votes.map((entry) => `${entry.date}\0${entry.person}`);
  return new Set(keys).size === keys.length;
};

export const plannerProposalSchema = z
  .strictObject({
    ...baseFields,
    type: z.literal("planner"),
    unavailableThreshold: z.number().int().positive().optional(),
    candidates: z
      .array(isoDate)
      .min(1, "Needs at least one date")
      .max(
        MAX_PROPOSAL_CANDIDATES,
        `At most ${MAX_PROPOSAL_CANDIDATES} candidate dates are allowed`,
      ),
  })
  .refine(
    (proposal) =>
      new Set(proposal.candidates).size === proposal.candidates.length,
    { path: ["candidates"], message: "Candidate dates must be unique" },
  )
  .refine(votesAreUnique, {
    path: ["votes"],
    message: "Only one vote per person and date is allowed",
  })
  .refine(
    (proposal) =>
      proposal.votes.every((entry) => proposal.candidates.includes(entry.date)),
    { path: ["votes"], message: "Vote date must be a candidate" },
  );

export const swapProposalSchema = z
  .strictObject({
    ...baseFields,
    type: z.literal("swap"),
    targetDate: isoDate,
    newDate: isoDate,
  })
  .refine(votesAreUnique, {
    path: ["votes"],
    message: "Only one vote per person and date is allowed",
  })
  .refine(
    (proposal) =>
      proposal.votes.every((entry) => entry.date === proposal.newDate),
    { path: ["votes"], message: "Vote date must match the proposed new date" },
  );

export const proposalSchema = z.discriminatedUnion("type", [
  plannerProposalSchema,
  swapProposalSchema,
]);

export const proposalsFileSchema = z
  .strictObject({
    proposals: z
      .array(proposalSchema)
      .max(
        MAX_TOTAL_PROPOSALS,
        `At most ${MAX_TOTAL_PROPOSALS} proposals are allowed`,
      )
      .default([]),
  })
  .refine(
    (file) =>
      new Set(file.proposals.map((proposal) => proposal.id)).size ===
      file.proposals.length,
    { path: ["proposals"], message: "Proposal IDs must be unique" },
  );
