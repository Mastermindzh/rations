import { describe, expect, it } from "vitest";
import { ConfigError } from "../src/config/config-error.js";
import { applyAddExtraDay } from "../src/services/add-extra-day.js";
import { fixtureConfig } from "./fixtures.js";

describe("add extra day", () => {
  it("appends an extra day, optionally with a reason", () => {
    const config = fixtureConfig();
    const added = applyAddExtraDay(config, "friday-dnd", "2026-07-20");
    expect(added.extraDays).toEqual([
      { gameNight: "friday-dnd", date: "2026-07-20" },
    ]);
    const withReason = applyAddExtraDay(
      config,
      "friday-dnd",
      "2026-07-20",
      "Bonus session",
    );
    expect(withReason.extraDays).toEqual([
      { gameNight: "friday-dnd", date: "2026-07-20", reason: "Bonus session" },
    ]);
    expect(config.extraDays).toEqual([]);
  });

  it("rejects an unknown game night", () => {
    expect(() =>
      applyAddExtraDay(fixtureConfig(), "missing", "2026-07-20"),
    ).toThrow(ConfigError);
  });
});
