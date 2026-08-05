import { describe, expect, it } from "vitest";
import { ConfigError } from "../src/config/config-error.js";
import { applyDateOverride } from "../src/services/reschedule-night.js";
import { fixtureConfig } from "./fixtures.js";

describe("reschedule game night", () => {
  it("adds and replaces a date override", () => {
    const config = fixtureConfig();
    const added = applyDateOverride(
      config,
      "friday-dnd",
      "2026-07-24",
      "2026-07-26",
    );
    expect(added.dateOverrides).toEqual([
      {
        gameNight: "friday-dnd",
        oldDate: "2026-07-24",
        newDate: "2026-07-26",
      },
    ]);
    const replaced = applyDateOverride(
      added,
      "friday-dnd",
      "2026-07-24",
      "2026-07-27",
    );
    expect(replaced.dateOverrides).toEqual([
      {
        gameNight: "friday-dnd",
        oldDate: "2026-07-24",
        newDate: "2026-07-27",
      },
    ]);
    expect(config.dateOverrides).toEqual([]);
  });

  it("removes a date override when reset to its scheduled date", () => {
    const config = fixtureConfig();
    config.dateOverrides = [
      { gameNight: "friday-dnd", oldDate: "2026-07-24", newDate: "2026-07-26" },
      {
        gameNight: "saturday-games",
        oldDate: "2026-08-01",
        newDate: "2026-08-02",
      },
    ];
    const updated = applyDateOverride(
      config,
      "friday-dnd",
      "2026-07-24",
      "2026-07-24",
    );
    expect(updated.dateOverrides).toEqual([
      {
        gameNight: "saturday-games",
        oldDate: "2026-08-01",
        newDate: "2026-08-02",
      },
    ]);
  });

  it("rejects an unknown game night", () => {
    expect(() =>
      applyDateOverride(fixtureConfig(), "missing", "2026-07-24", "2026-07-26"),
    ).toThrow(ConfigError);
  });
});
