import type * as FsPromises from "node:fs/promises";
import type { PathLike } from "node:fs";
import { afterEach, describe, expect, it, vi } from "vitest";
import { futureProposalConfig } from "./fixtures.js";
import { createTestWorkspace } from "./test-workspace.js";

const injectedFailure = vi.hoisted(() => ({ proposalsRename: false }));

vi.mock("node:fs/promises", async (importOriginal) => {
  const actual = await importOriginal<typeof FsPromises>();
  return {
    ...actual,
    async rename(oldPath: PathLike, newPath: PathLike) {
      if (
        injectedFailure.proposalsRename &&
        String(newPath).endsWith("/proposals.yml")
      ) {
        throw new Error("injected proposals rename failure");
      }
      return actual.rename(oldPath, newPath);
    },
  };
});

import { loadConfig } from "../src/config/file.js";
import { loadProposals } from "../src/proposals/store.js";
import {
  approveProposal,
  createPlannerProposal,
  createSwapProposal,
} from "../src/proposals/service.js";

const setup = () =>
  createTestWorkspace("rations-partial-failure-", futureProposalConfig());

afterEach(() => {
  injectedFailure.proposalsRename = false;
});

describe("proposal approval partial failure", () => {
  it("keeps an applied proposal when its removal cannot be saved", async () => {
    const directory = await setup();
    const id = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-01"],
    });

    injectedFailure.proposalsRename = true;
    await expect(
      approveProposal(directory, { id, dates: ["2099-03-01"] }),
    ).rejects.toThrow("injected proposals rename failure");

    expect((await loadConfig(directory)).config.extraDays).toContainEqual({
      gameNight: "friday-dnd",
      date: "2099-03-01",
      reason: "Planned via proposal",
    });
    expect(
      (await loadProposals(directory)).proposals.map((item) => item.id),
    ).toEqual([id]);
  });

  it("can retry a swap after applying it but failing to remove it", async () => {
    const directory = await setup();
    const id = await createSwapProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      targetDate: "2099-01-12",
      newDate: "2099-01-14",
    });

    injectedFailure.proposalsRename = true;
    await expect(approveProposal(directory, { id })).rejects.toThrow(
      "injected proposals rename failure",
    );
    expect((await loadProposals(directory)).proposals).toHaveLength(1);

    injectedFailure.proposalsRename = false;
    await approveProposal(directory, { id });

    expect((await loadConfig(directory)).config.dateOverrides).toEqual([
      {
        gameNight: "friday-dnd",
        oldDate: "2099-01-12",
        newDate: "2099-01-14",
      },
    ]);
    expect((await loadProposals(directory)).proposals).toEqual([]);
  });
});
