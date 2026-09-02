import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { parse, stringify } from "yaml";
import type { ZodError } from "zod";
import { ConfigError } from "../config/config-error.js";
import { configuredDataDirectory, loadConfig } from "../config/file.js";
import type { AppConfig } from "../config/types.js";
import {
  createSerialQueue,
  writeFileAtomically,
} from "../storage/atomic-file.js";
import { proposalsFileSchema } from "./schema.js";
import type { ProposalsFile } from "./types.js";
import { MAX_PROPOSALS_PER_NIGHT } from "./constraints.js";

export type ProposalsRepairIssue = {
  message: string;
  details: string[];
};

export type ProposalsLoadState = {
  file: ProposalsFile;
  repairIssue?: ProposalsRepairIssue;
};

const runExclusive = createSerialQueue();
const loggedRepairIssues = new Map<string, string>();

function proposalsPath(dataDirectory: string): string {
  return join(dataDirectory, "proposals.yml");
}

function issues(error: ZodError): string[] {
  return error.issues.map(
    (issue) => `${issue.path.join(".") || "proposals"}: ${issue.message}`,
  );
}

function parseProposals(raw: string): ProposalsFile {
  let data: unknown;
  try {
    data = parse(raw) ?? {};
  } catch (error) {
    throw new ConfigError(
      "proposals.yml is not valid YAML",
      "INVALID_PROPOSALS",
      [error instanceof Error ? error.message : String(error)],
    );
  }
  const result = proposalsFileSchema.safeParse(data);
  if (!result.success) {
    throw new ConfigError(
      "proposals.yml failed validation",
      "INVALID_PROPOSALS",
      issues(result.error),
    );
  }
  return result.data;
}

function semanticIssues(file: ProposalsFile, config: AppConfig): string[] {
  const result: string[] = [];
  const perNight = new Map<string, number>();
  file.proposals.forEach((proposal, proposalIndex) => {
    perNight.set(
      proposal.gameNight,
      (perNight.get(proposal.gameNight) ?? 0) + 1,
    );
    const night = config.gameNights.find(
      (candidate) => candidate.id === proposal.gameNight,
    );
    if (!night) {
      result.push(`proposals.${proposalIndex}.gameNight: Unknown game night`);
      return;
    }
    if (!night.people.includes(proposal.createdBy)) {
      result.push(`proposals.${proposalIndex}.createdBy: Unknown proposer`);
    }
    proposal.votes.forEach((entry, voteIndex) => {
      if (!night.people.includes(entry.person)) {
        result.push(
          `proposals.${proposalIndex}.votes.${voteIndex}.person: Unknown voter`,
        );
      }
    });
  });
  for (const [gameNight, count] of perNight) {
    if (count > MAX_PROPOSALS_PER_NIGHT) {
      result.push(
        `proposals: At most ${MAX_PROPOSALS_PER_NIGHT} proposals per game night (${gameNight} has ${count})`,
      );
    }
  }
  return result;
}

function assertSemantic(file: ProposalsFile, config: AppConfig): void {
  const semantic = semanticIssues(file, config);
  if (semantic.length > 0) {
    throw new ConfigError(
      "proposals.yml failed semantic validation",
      "INVALID_PROPOSALS",
      semantic,
    );
  }
}

async function loadProposalsStrict(
  dataDirectory = configuredDataDirectory(),
  knownConfig?: AppConfig,
): Promise<ProposalsFile> {
  let raw: string;
  try {
    raw = await readFile(proposalsPath(dataDirectory), "utf8");
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "ENOENT"
    ) {
      return { proposals: [] };
    }
    throw error;
  }
  const file = parseProposals(raw);
  const config = knownConfig ?? (await loadConfig(dataDirectory)).config;
  assertSemantic(file, config);
  return file;
}

/** Reads proposals.yml without allowing transient planning data to take down the app. */
export async function loadProposalsState(
  dataDirectory = configuredDataDirectory(),
): Promise<ProposalsLoadState> {
  try {
    const file = await loadProposalsStrict(dataDirectory);
    loggedRepairIssues.delete(proposalsPath(dataDirectory));
    return { file };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Could not read proposals.yml";
    const details = error instanceof ConfigError ? error.details : [];
    const path = proposalsPath(dataDirectory);
    const fingerprint = `${message}\0${details.join("\0")}`;
    if (loggedRepairIssues.get(path) !== fingerprint) {
      console.error("Could not load proposals.yml:", message);
      loggedRepairIssues.set(path, fingerprint);
    }
    return { file: { proposals: [] }, repairIssue: { message, details } };
  }
}

/** Reads proposals.yml; missing or invalid transient data is treated as empty. */
export async function loadProposals(
  dataDirectory = configuredDataDirectory(),
): Promise<ProposalsFile> {
  return (await loadProposalsState(dataDirectory)).file;
}

/** Applies a mutation to the proposals file under a serial lock and saves atomically. */
export async function changeProposals(
  dataDirectory: string,
  mutate: (current: ProposalsFile) => ProposalsFile,
): Promise<ProposalsFile> {
  return runExclusive(async () => {
    const { config } = await loadConfig(dataDirectory);
    const current = await loadProposalsStrict(dataDirectory, config);
    const next = mutate(structuredClone(current));
    const validated = proposalsFileSchema.safeParse(next);
    if (!validated.success) {
      throw new ConfigError(
        "The proposed change is invalid",
        "INVALID_PROPOSALS",
        issues(validated.error),
      );
    }
    assertSemantic(validated.data, config);
    await writeFileAtomically(
      proposalsPath(dataDirectory),
      stringify(validated.data, { lineWidth: 0 }),
    );
    return validated.data;
  });
}
