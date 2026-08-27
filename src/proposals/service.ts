import { changeConfig, loadConfig } from "../config/file.js";
import { ConfigError } from "../config/config-error.js";
import { applyDateOverride } from "../services/reschedule-night.js";
import { applyAddExtraDay } from "../services/add-extra-day.js";
import { todayInTimezone } from "../schedule/calendar-date.js";
import { isValidCalendarDate } from "../schedule/calendar-date.js";
import type { AppConfig } from "../config/types.js";
import { requireGameNight } from "../config/lookups.js";
import { loadProposals, changeProposals } from "./store.js";
import {
  applyVote,
  datesToApply,
  eliminatedCandidates,
  newProposalId,
} from "./helpers.js";
import { dateIsOccupied } from "../schedule/date-occupancy.js";
import type { Proposal } from "./types.js";
import type { VoteInput } from "./helpers.js";
import {
  MAX_PROPOSAL_CANDIDATES,
  MAX_PROPOSALS_PER_NIGHT,
  MAX_TOTAL_PROPOSALS,
} from "./constraints.js";

type CreateSwapProposalInput = {
  gameNightId: string;
  createdBy: string;
  targetDate: string;
  newDate: string;
  title?: string;
};

type CreatePlannerProposalInput = {
  gameNightId: string;
  createdBy: string;
  candidates: string[];
  unavailableThreshold?: number;
  title?: string;
};

type CastVoteInput = VoteInput & { proposalId: string };

type ApproveProposalInput = { id: string; dates?: string[] };

const applySwap = (
  config: AppConfig,
  gameNightId: string,
  targetDate: string,
  newDate: string,
): AppConfig => {
  const extraIndex = config.extraDays.findIndex(
    (item) => item.gameNight === gameNightId && item.date === targetDate,
  );
  if (extraIndex >= 0) {
    const extraDays = [...config.extraDays];
    extraDays[extraIndex] = { ...extraDays[extraIndex]!, date: newDate };
    return { ...config, extraDays };
  }

  const movedIndex = config.dateOverrides.findIndex(
    (item) => item.gameNight === gameNightId && item.newDate === targetDate,
  );
  if (movedIndex >= 0) {
    const dateOverrides = [...config.dateOverrides];
    dateOverrides[movedIndex] = {
      ...dateOverrides[movedIndex]!,
      newDate,
    };
    return { ...config, dateOverrides };
  }

  return applyDateOverride(config, gameNightId, targetDate, newDate);
};

const appendProposal = async (
  dataDirectory: string,
  proposal: Proposal,
): Promise<void> => {
  await changeProposals(dataDirectory, (file) => {
    if (file.proposals.length >= MAX_TOTAL_PROPOSALS) {
      throw new ConfigError("Too many proposals", "INVALID_PROPOSAL");
    }
    const forNight = file.proposals.filter(
      (item) => item.gameNight === proposal.gameNight,
    ).length;
    if (forNight >= MAX_PROPOSALS_PER_NIGHT) {
      throw new ConfigError(
        "This game night already has enough proposals",
        "INVALID_PROPOSAL",
      );
    }
    if (file.proposals.some((item) => item.id === proposal.id)) {
      throw new ConfigError("Proposal ID already exists", "INVALID_PROPOSAL");
    }
    return { proposals: [...file.proposals, proposal] };
  });
};

export async function createSwapProposal(
  dataDirectory: string,
  input: CreateSwapProposalInput,
): Promise<string> {
  const { config } = await loadConfig(dataDirectory);
  const night = requireGameNight(config, input.gameNightId);
  const today = todayInTimezone(config.site.timezone);

  if (!night.people.includes(input.createdBy)) {
    throw new ConfigError("Unknown proposer", "INVALID_PROPOSAL");
  }
  if (
    !isValidCalendarDate(input.targetDate) ||
    !dateIsOccupied(config, night, input.targetDate)
  ) {
    throw new ConfigError(
      "The date to move is not on the schedule",
      "INVALID_PROPOSAL",
    );
  }
  if (
    !isValidCalendarDate(input.newDate) ||
    input.newDate < today ||
    input.newDate === input.targetDate ||
    dateIsOccupied(config, night, input.newDate)
  ) {
    throw new ConfigError(
      "The proposed new date is not available",
      "INVALID_PROPOSAL",
    );
  }

  const id = newProposalId("swap");
  const proposal: Proposal = {
    id,
    gameNight: night.id,
    type: "swap",
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    targetDate: input.targetDate,
    newDate: input.newDate,
    votes: [],
    ...(input.title ? { title: input.title } : {}),
  };
  await appendProposal(dataDirectory, proposal);
  return id;
}

export async function createPlannerProposal(
  dataDirectory: string,
  input: CreatePlannerProposalInput,
): Promise<string> {
  const { config } = await loadConfig(dataDirectory);
  const night = requireGameNight(config, input.gameNightId);
  const today = todayInTimezone(config.site.timezone);

  if (!night.people.includes(input.createdBy)) {
    throw new ConfigError("Unknown proposer", "INVALID_PROPOSAL");
  }

  if (new Set(input.candidates).size !== input.candidates.length) {
    throw new ConfigError(
      "Candidate dates must be unique",
      "INVALID_PROPOSAL",
    );
  }
  if (
    input.candidates.some(
      (date) => !isValidCalendarDate(date) || date < today,
    )
  ) {
    throw new ConfigError(
      "Candidate dates must be valid future dates",
      "INVALID_PROPOSAL",
    );
  }
  const candidates = [...input.candidates].sort();
  if (candidates.length === 0) {
    throw new ConfigError("Pick at least one future date", "INVALID_PROPOSAL");
  }
  if (candidates.length > MAX_PROPOSAL_CANDIDATES) {
    throw new ConfigError("Too many dates in one proposal", "INVALID_PROPOSAL");
  }
  if (
    input.unavailableThreshold !== undefined &&
    (!Number.isInteger(input.unavailableThreshold) ||
      input.unavailableThreshold < 1)
  ) {
    throw new ConfigError("Invalid unavailable threshold", "INVALID_PROPOSAL");
  }

  const id = newProposalId("planner");
  const proposal: Proposal = {
    id,
    gameNight: night.id,
    type: "planner",
    createdBy: input.createdBy,
    createdAt: new Date().toISOString(),
    candidates,
    votes: [],
    ...(input.unavailableThreshold !== undefined
      ? { unavailableThreshold: input.unavailableThreshold }
      : {}),
    ...(input.title ? { title: input.title } : {}),
  };
  await appendProposal(dataDirectory, proposal);
  return id;
}

export async function castVote(
  dataDirectory: string,
  input: CastVoteInput,
): Promise<void> {
  const { config } = await loadConfig(dataDirectory);
  await changeProposals(dataDirectory, (current) => {
    const proposal = current.proposals.find(
      (item) => item.id === input.proposalId,
    );
    if (!proposal) {
      throw new ConfigError("Unknown proposal", "UNKNOWN_PROPOSAL");
    }
    const night = requireGameNight(config, proposal.gameNight);
    if (!night.people.includes(input.person)) {
      throw new ConfigError("Unknown voter", "INVALID_VOTE");
    }
    const validDate =
      proposal.type === "swap"
        ? input.date === proposal.newDate
        : proposal.candidates.includes(input.date);
    if (!validDate) {
      throw new ConfigError("Unknown date", "INVALID_VOTE");
    }

    return {
      proposals: current.proposals.map((item) =>
        item.id === input.proposalId
          ? { ...item, votes: applyVote(item.votes, input) }
          : item,
      ),
    };
  });
}

export async function approveProposal(
  dataDirectory: string,
  input: ApproveProposalInput,
): Promise<void> {
  const file = await loadProposals(dataDirectory);
  const proposal = file.proposals.find((item) => item.id === input.id);
  if (!proposal) {
    throw new ConfigError("Unknown proposal", "UNKNOWN_PROPOSAL");
  }

  const loaded = await loadConfig(dataDirectory);
  const night = requireGameNight(loaded.config, proposal.gameNight);

  // Apply to the schedule first; only remove the proposal after that succeeds.
  if (proposal.type === "swap") {
    const targetExists = dateIsOccupied(
      loaded.config,
      night,
      proposal.targetDate,
    );
    const replacementExists = dateIsOccupied(
      loaded.config,
      night,
      proposal.newDate,
    );
    if (!targetExists && !replacementExists) {
      throw new ConfigError(
        "The date to move is no longer on the schedule",
        "INVALID_PROPOSAL",
      );
    }
    if (targetExists && replacementExists) {
      throw new ConfigError(
        "The proposed new date is no longer available",
        "INVALID_PROPOSAL",
      );
    }
    // A missing target plus an occupied replacement is the idempotent retry
    // shape after the schedule save succeeded but proposal removal failed.
    if (targetExists) {
      await changeConfig(dataDirectory, loaded.version, (config) =>
        applySwap(config, night.id, proposal.targetDate, proposal.newDate),
      );
    }
  } else {
    const today = todayInTimezone(loaded.config.site.timezone);
    const eliminated = eliminatedCandidates(proposal);
    const requested =
      input.dates ?? proposal.candidates.filter((date) => !eliminated.has(date));
    if (requested.some((date) => !proposal.candidates.includes(date))) {
      throw new ConfigError(
        "An approval date is not part of this proposal",
        "INVALID_PROPOSAL",
      );
    }
    const toApply = datesToApply(loaded.config, night, requested, today);
    if (toApply.length > 0) {
      await changeConfig(dataDirectory, loaded.version, (config) => {
        let next = config;
        for (const date of toApply) {
          next = applyAddExtraDay(next, night.id, date, "Planned via proposal");
        }
        return next;
      });
    }
  }

  // Approving applies the dates, then removes the proposal (approve == done).
  await deleteProposal(dataDirectory, input.id);
}

export async function deleteProposal(
  dataDirectory: string,
  id: string,
): Promise<void> {
  await changeProposals(dataDirectory, (file) => ({
    proposals: file.proposals.filter((item) => item.id !== id),
  }));
}
