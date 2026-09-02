import { readFile, readdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { stringify } from "yaml";
import { fixtureConfig, futureProposalConfig } from "./fixtures.js";
import { createTestWorkspace } from "./test-workspace.js";
import {
  applyVote,
  datesToApply,
  eliminatedCandidates,
  voteTally,
} from "../src/proposals/helpers.js";
import { dateIsOccupied } from "../src/schedule/date-occupancy.js";
import type { PlannerProposal } from "../src/proposals/types.js";
import {
  approveProposal,
  castVote,
  createPlannerProposal,
  createSwapProposal,
  deleteProposal,
} from "../src/proposals/service.js";
import {
  changeProposals,
  loadProposals,
  loadProposalsState,
} from "../src/proposals/store.js";
import { loadConfig } from "../src/config/file.js";
import { rescheduleNight } from "../src/services/reschedule-night.js";
import { addExtraDay } from "../src/services/add-extra-day.js";

// A far-future night so proposed dates are always after "today".
const setup = () =>
  createTestWorkspace("rations-proposals-", futureProposalConfig());

function planner(votes: PlannerProposal["votes"]): PlannerProposal {
  return {
    id: "planner-x",
    gameNight: "friday-dnd",
    type: "planner",
    createdBy: "rick",
    createdAt: "2099-01-01T00:00:00Z",
    unavailableThreshold: 2,
    candidates: ["2099-02-01", "2099-02-02"],
    votes,
  };
}

describe("proposal helpers", () => {
  it("tallies up and down votes per date", () => {
    const proposal = planner([
      { date: "2099-02-01", person: "a", vote: "up" },
      { date: "2099-02-01", person: "b", vote: "down" },
      { date: "2099-02-02", person: "a", vote: "up" },
    ]);
    expect(voteTally(proposal, "2099-02-01")).toEqual({ up: 1, down: 1 });
    expect(voteTally(proposal, "2099-02-02")).toEqual({ up: 1, down: 0 });
  });

  it("upserts a person's vote", () => {
    let votes = applyVote([], { person: "a", date: "d", vote: "up" });
    expect(votes).toHaveLength(1);
    votes = applyVote(votes, { person: "a", date: "d", vote: "down" });
    expect(votes).toEqual([{ person: "a", date: "d", vote: "down" }]);
    votes = applyVote(votes, { person: "a", date: "d", vote: "down" });
    expect(votes).toEqual([{ person: "a", date: "d", vote: "down" }]);
  });

  it("eliminates a candidate once the threshold of down-votes is met", () => {
    const proposal = planner([
      { date: "2099-02-01", person: "a", vote: "down" },
      { date: "2099-02-01", person: "b", vote: "down" },
      { date: "2099-02-02", person: "a", vote: "down" },
    ]);
    expect([...eliminatedCandidates(proposal)]).toEqual(["2099-02-01"]);
  });

  it("never eliminates without a threshold", () => {
    const { unavailableThreshold, ...rest } = planner([
      { date: "2099-02-01", person: "a", vote: "down" },
      { date: "2099-02-01", person: "b", vote: "down" },
    ]);
    void unavailableThreshold;
    expect(eliminatedCandidates(rest).size).toBe(0);
  });

  it("detects occupied dates and filters dates to apply", () => {
    const config = fixtureConfig();
    const night = config.gameNights[0]!; // friday-dnd, anchor 2026-07-17, weekly
    expect(dateIsOccupied(config, night, "2026-07-24")).toBe(true); // scheduled
    expect(dateIsOccupied(config, night, "2026-07-25")).toBe(false);
    const toApply = datesToApply(
      config,
      night,
      ["2026-07-24", "2026-07-25", "2000-01-01"],
      "2026-07-20",
    );
    expect(toApply).toEqual(["2026-07-25"]); // scheduled + past dropped
  });
});

describe("proposal store", () => {
  it("treats a missing proposals file as empty", async () => {
    const directory = await setup();

    expect(await loadProposals(directory)).toEqual({ proposals: [] });
  });

  it("commits a complete proposals file without leaving a temp file", async () => {
    const directory = await setup();
    const id = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-01"],
    });

    expect(await loadProposals(directory)).toMatchObject({
      proposals: [{ id }],
    });
    expect(await readdir(directory)).not.toContain("proposals.yml.tmp");
  });

  it("returns an empty degraded state for an invalid proposals file", async () => {
    const directory = await setup();
    await writeFile(join(directory, "proposals.yml"), "proposals: [");

    const loaded = await loadProposalsState(directory);

    expect(loaded.file).toEqual({ proposals: [] });
    expect(loaded.repairIssue?.message).toContain("not valid YAML");
    expect(await loadProposals(directory)).toEqual({ proposals: [] });
  });

  it("refuses to overwrite an invalid proposals file during a mutation", async () => {
    const directory = await setup();
    const invalid = "proposals: [";
    await writeFile(join(directory, "proposals.yml"), invalid);

    await expect(deleteProposal(directory, "anything")).rejects.toThrow(
      "not valid YAML",
    );

    expect(await readFile(join(directory, "proposals.yml"), "utf8")).toBe(
      invalid,
    );
  });

  it("rejects a mutation whose result does not match the current config", async () => {
    const directory = await setup();

    await expect(
      changeProposals(directory, () => ({
        proposals: [
          {
            id: "planner-unknown-proposer",
            gameNight: "friday-dnd",
            type: "planner",
            createdBy: "nobody",
            createdAt: "2099-01-01T00:00:00Z",
            candidates: ["2099-03-01"],
            votes: [],
          },
        ],
      })),
    ).rejects.toThrow("semantic validation");

    expect(await loadProposals(directory)).toEqual({ proposals: [] });
  });

  it("rejects persisted voters who are not on the game-night roster", async () => {
    const directory = await setup();
    await writeFile(
      join(directory, "proposals.yml"),
      `proposals:
  - id: planner-unknown-voter
    gameNight: friday-dnd
    type: planner
    createdBy: rick
    createdAt: 2099-01-01T00:00:00Z
    candidates: [2099-02-01]
    votes:
      - { date: 2099-02-01, person: nobody, vote: down }
`,
    );

    const loaded = await loadProposalsState(directory);

    expect(loaded.file).toEqual({ proposals: [] });
    expect(loaded.repairIssue?.details.join(" ")).toContain("Unknown voter");
  });

  it("rejects duplicate persisted planner candidates", async () => {
    const directory = await setup();
    await writeFile(
      join(directory, "proposals.yml"),
      `proposals:
  - id: planner-duplicates
    gameNight: friday-dnd
    type: planner
    createdBy: rick
    createdAt: 2099-01-01T00:00:00Z
    candidates: [2099-02-01, 2099-02-01]
    votes: []
`,
    );

    const loaded = await loadProposalsState(directory);

    expect(loaded.file.proposals).toEqual([]);
    expect(loaded.repairIssue?.details.join(" ")).toContain(
      "Candidate dates must be unique",
    );
  });

  it("rejects duplicate persisted votes for one person and date", async () => {
    const directory = await setup();
    await writeFile(
      join(directory, "proposals.yml"),
      `proposals:
  - id: planner-duplicate-votes
    gameNight: friday-dnd
    type: planner
    createdBy: rick
    createdAt: 2099-01-01T00:00:00Z
    candidates: [2099-02-01]
    votes:
      - { date: 2099-02-01, person: alice, vote: up }
      - { date: 2099-02-01, person: alice, vote: down }
`,
    );

    const loaded = await loadProposalsState(directory);

    expect(loaded.file.proposals).toEqual([]);
    expect(loaded.repairIssue?.details.join(" ")).toContain(
      "Only one vote per person and date",
    );
  });

  it("rejects persisted votes for dates outside the proposal", async () => {
    const directory = await setup();
    await writeFile(
      join(directory, "proposals.yml"),
      `proposals:
  - id: planner-off-candidate-vote
    gameNight: friday-dnd
    type: planner
    createdBy: rick
    createdAt: 2099-01-01T00:00:00Z
    candidates: [2099-02-01]
    votes:
      - { date: 2099-02-02, person: alice, vote: up }
`,
    );

    const loaded = await loadProposalsState(directory);

    expect(loaded.file.proposals).toEqual([]);
    expect(loaded.repairIssue?.details.join(" ")).toContain(
      "Vote date must be a candidate",
    );
  });

  it("rejects duplicate persisted proposal IDs", async () => {
    const directory = await setup();
    const proposal = {
      id: "planner-same-id",
      gameNight: "friday-dnd",
      type: "planner",
      createdBy: "rick",
      createdAt: "2099-01-01T00:00:00Z",
      candidates: ["2099-02-01"],
      votes: [],
    } as const;
    await writeFile(
      join(directory, "proposals.yml"),
      `proposals:\n${[proposal, proposal]
        .map(
          () => `  - id: planner-same-id
    gameNight: friday-dnd
    type: planner
    createdBy: rick
    createdAt: 2099-01-01T00:00:00Z
    candidates: [2099-02-01]
    votes: []`,
        )
        .join("\n")}\n`,
    );

    const loaded = await loadProposalsState(directory);

    expect(loaded.file.proposals).toEqual([]);
    expect(loaded.repairIssue?.details.join(" ")).toContain(
      "Proposal IDs must be unique",
    );
  });

  it("rejects a persisted proposal ID that is not a slug", async () => {
    const directory = await setup();
    await writeFile(
      join(directory, "proposals.yml"),
      `proposals:
  - id: Not_A_Slug
    gameNight: friday-dnd
    type: planner
    createdBy: rick
    createdAt: 2099-01-01T00:00:00Z
    candidates: [2099-02-01]
    votes: []
`,
    );

    const loaded = await loadProposalsState(directory);

    expect(loaded.file.proposals).toEqual([]);
    expect(loaded.repairIssue?.message).toContain("failed validation");
  });

  it("rejects persisted dates that are not real calendar dates", async () => {
    const directory = await setup();
    await writeFile(
      join(directory, "proposals.yml"),
      `proposals:
  - id: planner-invalid-date
    gameNight: friday-dnd
    type: planner
    createdBy: rick
    createdAt: 2099-01-01T00:00:00Z
    candidates: [2099-02-30]
    votes: []
`,
    );

    const loaded = await loadProposalsState(directory);

    expect(loaded.file.proposals).toEqual([]);
    expect(loaded.repairIssue?.details.join(" ")).toContain(
      "Must be a real calendar date",
    );
  });

  it("rejects a persisted planner with more than 62 candidates", async () => {
    const directory = await setup();
    const dates = Array.from({ length: 63 }, (_, index) => {
      const date = new Date("2099-03-01T00:00:00Z");
      date.setUTCDate(date.getUTCDate() + index);
      return date.toISOString().slice(0, 10);
    });
    await writeFile(
      join(directory, "proposals.yml"),
      `proposals:
  - id: planner-too-many-dates
    gameNight: friday-dnd
    type: planner
    createdBy: rick
    createdAt: 2099-01-01T00:00:00Z
    candidates: [${dates.join(", ")}]
    votes: []
`,
    );

    const loaded = await loadProposalsState(directory);

    expect(loaded.file.proposals).toEqual([]);
    expect(loaded.repairIssue?.details.join(" ")).toContain(
      "At most 62 candidate dates",
    );
  });

  it("rejects more than 100 persisted proposals", async () => {
    const directory = await setup();
    const proposals = Array.from({ length: 101 }, (_, index) => ({
      id: `planner-${index}`,
      gameNight: "friday-dnd",
      type: "planner" as const,
      createdBy: "rick",
      createdAt: "2099-01-01T00:00:00Z",
      candidates: ["2099-02-01"],
      votes: [],
    }));
    await writeFile(
      join(directory, "proposals.yml"),
      stringify({ proposals }),
    );

    const loaded = await loadProposalsState(directory);

    expect(loaded.file.proposals).toEqual([]);
    expect(loaded.repairIssue?.details.join(" ")).toContain(
      "At most 100 proposals",
    );
  });

  it("rejects more than five persisted proposals for one game night", async () => {
    const directory = await setup();
    const proposals = Array.from({ length: 6 }, (_, index) => ({
      id: `planner-night-cap-${index}`,
      gameNight: "friday-dnd",
      type: "planner" as const,
      createdBy: "rick",
      createdAt: "2099-01-01T00:00:00Z",
      candidates: [`2099-03-0${index + 1}`],
      votes: [],
    }));
    await writeFile(
      join(directory, "proposals.yml"),
      stringify({ proposals }),
    );

    const loaded = await loadProposalsState(directory);

    expect(loaded.file.proposals).toEqual([]);
    expect(loaded.repairIssue?.details.join(" ")).toContain(
      "At most 5 proposals per game night",
    );
  });
});

describe("proposal bounds", () => {
  it("enforces the per-night cap inside concurrent creation writes", async () => {
    const directory = await setup();

    const results = await Promise.allSettled(
      Array.from({ length: 6 }, (_, index) =>
        createPlannerProposal(directory, {
          gameNightId: "friday-dnd",
          createdBy: "rick",
          candidates: [`2099-03-${String(index + 1).padStart(2, "0")}`],
        }),
      ),
    );

    expect(results.filter((result) => result.status === "fulfilled")).toHaveLength(
      5,
    );
    expect((await loadProposals(directory)).proposals).toHaveLength(5);
  });

  it("applies the per-night cap to swap proposals too", async () => {
    const directory = await setup();
    for (let index = 0; index < 5; index += 1) {
      await createPlannerProposal(directory, {
        gameNightId: "friday-dnd",
        createdBy: "rick",
        candidates: [`2099-03-${String(index + 1).padStart(2, "0")}`],
      });
    }

    await expect(
      createSwapProposal(directory, {
        gameNightId: "friday-dnd",
        createdBy: "rick",
        targetDate: "2099-01-12",
        newDate: "2099-02-01",
      }),
    ).rejects.toThrow("already has enough proposals");
  });
});

describe("proposal concurrency", () => {
  it("serializes concurrent votes without dropping independent voters", async () => {
    const directory = await setup();
    const id = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-01"],
    });

    await Promise.all(
      ["rick", "alice", "bob"].map((person) =>
        castVote(directory, {
          proposalId: id,
          person,
          date: "2099-03-01",
          vote: "up",
        }),
      ),
    );

    const proposal = (await loadProposals(directory)).proposals[0]!;
    expect(proposal.votes.map((vote) => vote.person).sort()).toEqual([
      "alice",
      "bob",
      "rick",
    ]);
  });
});

describe("swap proposals", () => {
  it("creates, votes, and approves into a date override", async () => {
    const directory = await setup();
    const id = await createSwapProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      targetDate: "2099-01-12",
      newDate: "2099-01-14",
    });

    await castVote(directory, {
      proposalId: id,
      person: "alice",
      date: "2099-01-14",
      vote: "up",
    });
    let file = await loadProposals(directory);
    expect(file.proposals[0]!.votes).toEqual([
      { date: "2099-01-14", person: "alice", vote: "up" },
    ]);

    await approveProposal(directory, { id });
    const { config } = await loadConfig(directory);
    expect(config.dateOverrides).toContainEqual({
      gameNight: "friday-dnd",
      oldDate: "2099-01-12",
      newDate: "2099-01-14",
    });
    // Approving removes the proposal.
    expect((await loadProposals(directory)).proposals).toHaveLength(0);
  });

  it("rejects a swap onto an occupied date", async () => {
    const directory = await setup();
    await expect(
      createSwapProposal(directory, {
        gameNightId: "friday-dnd",
        createdBy: "rick",
        targetDate: "2099-01-12",
        newDate: "2099-01-19", // also a scheduled date
      }),
    ).rejects.toThrow();
  });

  it("keeps a swap proposal when its target occurrence has moved", async () => {
    const directory = await setup();
    const id = await createSwapProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      targetDate: "2099-01-12",
      newDate: "2099-01-14",
    });
    const loaded = await loadConfig(directory);
    await rescheduleNight(directory, {
      gameNightId: "friday-dnd",
      expectedVersion: loaded.version,
      oldDate: "2099-01-12",
      newDate: "2099-01-13",
    });

    await expect(approveProposal(directory, { id })).rejects.toThrow(
      "no longer on the schedule",
    );
    expect((await loadProposals(directory)).proposals).toHaveLength(1);
  });

  it("moves an extra occurrence when its swap is approved", async () => {
    const directory = await setup();
    const loaded = await loadConfig(directory);
    await addExtraDay(directory, {
      gameNightId: "friday-dnd",
      expectedVersion: loaded.version,
      date: "2099-01-10",
      reason: "Special session",
    });
    const id = await createSwapProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      targetDate: "2099-01-10",
      newDate: "2099-01-11",
    });

    await approveProposal(directory, { id });

    expect((await loadConfig(directory)).config.extraDays).toContainEqual({
      gameNight: "friday-dnd",
      date: "2099-01-11",
      reason: "Special session",
    });
    expect((await loadProposals(directory)).proposals).toEqual([]);
  });

  it("deletes proposals", async () => {
    const directory = await setup();
    const id = await createSwapProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      targetDate: "2099-01-12",
      newDate: "2099-01-14",
    });
    await deleteProposal(directory, id);
    expect((await loadProposals(directory)).proposals).toHaveLength(0);
  });
});

describe("planner proposals", () => {
  it("creates a proposal and approves selected dates into extra days", async () => {
    const directory = await setup();
    const id = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-02", "2099-03-01"],
      unavailableThreshold: 2,
    });
    const created = (await loadProposals(directory)).proposals[0]!;
    expect(created.type).toBe("planner");
    expect(created.type === "planner" && created.candidates).toEqual([
      "2099-03-01",
      "2099-03-02",
    ]);

    await approveProposal(directory, { id, dates: ["2099-03-01"] });
    const { config } = await loadConfig(directory);
    expect(config.extraDays).toContainEqual({
      gameNight: "friday-dnd",
      date: "2099-03-01",
      reason: "Planned via proposal",
    });
    expect(config.extraDays.some((item) => item.date === "2099-03-02")).toBe(
      false,
    );
  });

  it("rejects an empty candidate list", async () => {
    const directory = await setup();
    await expect(
      createPlannerProposal(directory, {
        gameNightId: "friday-dnd",
        createdBy: "rick",
        candidates: [],
      }),
    ).rejects.toThrow();
  });

  it("rejects unknown nights, proposers, and past dates", async () => {
    const directory = await setup();

    await expect(
      createPlannerProposal(directory, {
        gameNightId: "missing",
        createdBy: "rick",
        candidates: ["2099-03-01"],
      }),
    ).rejects.toThrow("Unknown game night");
    await expect(
      createPlannerProposal(directory, {
        gameNightId: "friday-dnd",
        createdBy: "nobody",
        candidates: ["2099-03-01"],
      }),
    ).rejects.toThrow("Unknown proposer");
    await expect(
      createPlannerProposal(directory, {
        gameNightId: "friday-dnd",
        createdBy: "rick",
        candidates: ["2000-01-01"],
      }),
    ).rejects.toThrow("valid future dates");
  });

  it("rejects duplicate candidate input instead of silently changing it", async () => {
    const directory = await setup();

    await expect(
      createPlannerProposal(directory, {
        gameNightId: "friday-dnd",
        createdBy: "rick",
        candidates: ["2099-03-01", "2099-03-01"],
      }),
    ).rejects.toThrow("Candidate dates must be unique");
  });

  it("rejects proposal titles longer than the UI limit", async () => {
    const directory = await setup();

    await expect(
      createPlannerProposal(directory, {
        gameNightId: "friday-dnd",
        createdBy: "rick",
        candidates: ["2099-03-01"],
        title: "x".repeat(81),
      }),
    ).rejects.toThrow();
    expect((await loadProposals(directory)).proposals).toEqual([]);
  });

  it("rejects approval dates that are not candidates", async () => {
    const directory = await setup();
    const id = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-01"],
    });

    await expect(
      approveProposal(directory, { id, dates: ["2099-03-02"] }),
    ).rejects.toThrow("not part of this proposal");

    expect((await loadProposals(directory)).proposals).toHaveLength(1);
    expect((await loadConfig(directory)).config.extraDays).toEqual([]);
  });

  it("defaults service approval to non-eliminated planner candidates", async () => {
    const directory = await setup();
    const id = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-03", "2099-03-04"],
      unavailableThreshold: 1,
    });
    await castVote(directory, {
      proposalId: id,
      person: "alice",
      date: "2099-03-03",
      vote: "down",
    });

    await approveProposal(directory, { id });

    expect((await loadConfig(directory)).config.extraDays).toEqual([
      {
        gameNight: "friday-dnd",
        date: "2099-03-04",
        reason: "Planned via proposal",
      },
    ]);
  });

  it("resolves cleanly when a selected date was already added", async () => {
    const directory = await setup();
    const id = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-01"],
    });
    const loaded = await loadConfig(directory);
    await addExtraDay(directory, {
      gameNightId: "friday-dnd",
      expectedVersion: loaded.version,
      date: "2099-03-01",
      reason: "Added elsewhere",
    });

    await approveProposal(directory, { id, dates: ["2099-03-01"] });

    expect((await loadConfig(directory)).config.extraDays).toEqual([
      {
        gameNight: "friday-dnd",
        date: "2099-03-01",
        reason: "Added elsewhere",
      },
    ]);
    expect((await loadProposals(directory)).proposals).toEqual([]);
  });
});
