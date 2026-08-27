import type { z } from "zod";
import type {
  plannerProposalSchema,
  proposalSchema,
  proposalVoteSchema,
  proposalsFileSchema,
  swapProposalSchema,
} from "./schema.js";

export type ProposalVote = z.output<typeof proposalVoteSchema>;
export type PlannerProposal = z.output<typeof plannerProposalSchema>;
export type SwapProposal = z.output<typeof swapProposalSchema>;
export type Proposal = z.output<typeof proposalSchema>;
export type ProposalsFile = z.output<typeof proposalsFileSchema>;
