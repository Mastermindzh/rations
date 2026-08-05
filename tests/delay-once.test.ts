import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { describe, expect, it } from "vitest";
import { ConfigError } from "../src/config/config-error.js";
import { applyDelayOnce, delayOnce } from "../src/services/delay-once.js";
import { resolveRelevantTurn } from "../src/schedule/resolve-turn.js";
import { fixtureConfig, fixtureYaml } from "./fixtures.js";

describe("delay once", () => {
  it("swaps current and next people without changing later turns", () => {
    const config = fixtureConfig();
    const updated = applyDelayOnce(config, "friday-dnd", "2026-07-17");
    const night = updated.gameNights[0]!;
    expect(resolveRelevantTurn(updated, night, "2026-07-17").personId).toBe(
      "alice",
    );
    expect(resolveRelevantTurn(updated, night, "2026-07-24").personId).toBe(
      "rick",
    );
    expect(resolveRelevantTurn(updated, night, "2026-07-31").personId).toBe(
      "bob",
    );
    expect(config.overrides).toEqual([]);
  });

  it("respects existing current and next overrides", () => {
    const config = fixtureConfig();
    config.overrides = [
      {
        gameNight: "friday-dnd",
        date: "2026-07-17",
        person: "bob",
        reason: "Existing current",
      },
      {
        gameNight: "friday-dnd",
        date: "2026-07-24",
        person: "rick",
        reason: "Existing next",
      },
    ];
    const updated = applyDelayOnce(config, "friday-dnd", "2026-07-17");
    expect(
      resolveRelevantTurn(updated, updated.gameNights[0]!, "2026-07-17")
        .personId,
    ).toBe("rick");
    expect(
      resolveRelevantTurn(updated, updated.gameNights[0]!, "2026-07-24")
        .personId,
    ).toBe("bob");
  });

  it("preserves unrelated overrides", () => {
    const config = fixtureConfig();
    const unrelated = {
      gameNight: "saturday-games",
      date: "2026-07-18",
      person: "rick",
      reason: "Other night",
    };
    config.overrides = [unrelated];
    expect(
      applyDelayOnce(config, "friday-dnd", "2026-07-17").overrides,
    ).toContainEqual(unrelated);
  });

  it("swaps assignments by scheduled date when occurrences are moved", () => {
    const config = fixtureConfig();
    config.dateOverrides = [
      { gameNight: "friday-dnd", oldDate: "2026-07-17", newDate: "2026-07-19" },
      { gameNight: "friday-dnd", oldDate: "2026-07-24", newDate: "2026-07-26" },
    ];
    const updated = applyDelayOnce(config, "friday-dnd", "2026-07-17");
    expect(updated.overrides).toEqual([
      expect.objectContaining({ date: "2026-07-17", person: "alice" }),
      expect.objectContaining({ date: "2026-07-24", person: "rick" }),
    ]);
    expect(
      resolveRelevantTurn(updated, updated.gameNights[0]!, "2026-07-17"),
    ).toMatchObject({
      date: "2026-07-19",
      originalDate: "2026-07-17",
      personId: "alice",
    });
  });

  it("rejects one-person rotations and unknown game nights", () => {
    const config = fixtureConfig();
    config.gameNights[0]!.people = ["rick"];
    expect(() => applyDelayOnce(config, "friday-dnd", "2026-07-17")).toThrow(
      ConfigError,
    );
    expect(() =>
      applyDelayOnce(fixtureConfig(), "missing", "2026-07-17"),
    ).toThrow("Unknown game night");
  });

  it("rejects a date that is not the start of the resolved turn", () => {
    expect(() =>
      applyDelayOnce(fixtureConfig(), "friday-dnd", "2026-07-18"),
    ).toThrow("no longer current");
  });

  it("rejects a stale file version through the shared write pipeline", async () => {
    const directory = await mkdtemp(join(tmpdir(), "rations-delay-"));
    try {
      await mkdir(join(directory, "images"));
      await writeFile(join(directory, "config.yml"), fixtureYaml());
      await expect(
        delayOnce(directory, {
          gameNightId: "friday-dnd",
          currentDate: "2026-07-17",
          expectedVersion: "stale",
        }),
      ).rejects.toMatchObject({ code: "STALE_VERSION" });
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });
});
