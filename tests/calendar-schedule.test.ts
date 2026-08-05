import { DateTime } from "luxon";
import { describe, expect, it } from "vitest";
import {
  addCalendarDays,
  calendarDaysBetween,
  todayInTimezone,
} from "../src/schedule/calendar-date.js";
import {
  resolveNightSchedule,
  resolveRelevantTurn,
  resolveTurnNumber,
} from "../src/schedule/resolve-turn.js";
import { fixtureConfig } from "./fixtures.js";

describe("calendar dates and schedule resolution", () => {
  it("selects participant zero on the anchor date", () => {
    const config = fixtureConfig();
    expect(
      resolveRelevantTurn(config, config.gameNights[0]!, "2026-07-17").personId,
    ).toBe("rick");
  });

  it("selects the next participant one interval later", () => {
    const config = fixtureConfig();
    expect(
      resolveRelevantTurn(config, config.gameNights[0]!, "2026-07-24").personId,
    ).toBe("alice");
  });

  it("wraps the rotation", () => {
    const config = fixtureConfig();
    expect(
      resolveRelevantTurn(config, config.gameNights[0]!, "2026-08-07").personId,
    ).toBe("rick");
  });

  it("handles weekly and fortnightly nights independently", () => {
    const config = fixtureConfig();
    expect(
      resolveRelevantTurn(config, config.gameNights[0]!, "2026-08-01"),
    ).toMatchObject({ personId: "rick", date: "2026-08-07" });
    expect(
      resolveRelevantTurn(config, config.gameNights[1]!, "2026-08-01"),
    ).toMatchObject({ personId: "rick", date: "2026-08-01" });
  });

  it("skips past occurrences between scheduled dates", () => {
    const config = fixtureConfig();
    expect(
      resolveRelevantTurn(config, config.gameNights[0]!, "2026-07-18"),
    ).toMatchObject({
      personId: "alice",
      date: "2026-07-24",
    });
  });

  it("shows the first turn before the anchor", () => {
    const config = fixtureConfig();
    const schedule = resolveNightSchedule(
      config,
      config.gameNights[0]!,
      "2026-07-10",
    );
    expect(schedule).toMatchObject({
      current: { date: "2026-07-17", personId: "rick" },
    });
  });

  it("shows one full rotation of upcoming turns by default", () => {
    const config = fixtureConfig();
    const night = config.gameNights[0]!;
    expect(
      resolveNightSchedule(config, night, "2026-07-17").upcoming,
    ).toHaveLength(night.people.length);
  });

  it("applies an override while preserving the base participant", () => {
    const config = fixtureConfig();
    config.overrides.push({
      gameNight: "friday-dnd",
      date: "2026-07-24",
      person: "bob",
      reason: "Swap",
    });
    expect(resolveTurnNumber(config, config.gameNights[0]!, 1)).toMatchObject({
      personId: "bob",
      originalPersonId: "alice",
      isOverride: true,
      reason: "Swap",
    });
  });

  it("maps a scheduled date to its moved date while preserving the old date", () => {
    const config = fixtureConfig();
    config.dateOverrides.push({
      gameNight: "friday-dnd",
      oldDate: "2026-07-24",
      newDate: "2026-07-26",
    });
    expect(resolveTurnNumber(config, config.gameNights[0]!, 1)).toMatchObject({
      date: "2026-07-26",
      originalDate: "2026-07-24",
      personId: "alice",
    });
    expect(resolveTurnNumber(config, config.gameNights[1]!, 1).date).toBe(
      "2026-08-01",
    );
  });

  it("selects the next occurrence by its moved date", () => {
    const config = fixtureConfig();
    config.dateOverrides = [
      { gameNight: "friday-dnd", oldDate: "2026-07-24", newDate: "2026-07-26" },
      { gameNight: "friday-dnd", oldDate: "2026-08-07", newDate: "2026-07-23" },
    ];
    expect(
      resolveRelevantTurn(config, config.gameNights[0]!, "2026-07-22"),
    ).toMatchObject({
      date: "2026-07-23",
      originalDate: "2026-08-07",
    });
    expect(
      resolveRelevantTurn(config, config.gameNights[0]!, "2026-07-27"),
    ).toMatchObject({
      date: "2026-07-31",
    });
  });

  it("keeps assignment overrides attached to a moved occurrence", () => {
    const config = fixtureConfig();
    config.dateOverrides.push({
      gameNight: "friday-dnd",
      oldDate: "2026-07-24",
      newDate: "2026-07-26",
    });
    config.overrides.push({
      gameNight: "friday-dnd",
      date: "2026-07-24",
      person: "bob",
    });
    expect(resolveTurnNumber(config, config.gameNights[0]!, 1)).toMatchObject({
      date: "2026-07-26",
      originalDate: "2026-07-24",
      personId: "bob",
      isOverride: true,
    });
  });

  it("allows different nights to override the same date", () => {
    const config = fixtureConfig();
    config.gameNights[1]!.anchorDate = "2026-07-17";
    config.overrides = [
      { gameNight: "friday-dnd", date: "2026-07-17", person: "bob" },
      { gameNight: "saturday-games", date: "2026-07-17", person: "rick" },
    ];
    expect(
      resolveRelevantTurn(config, config.gameNights[0]!, "2026-07-17").personId,
    ).toBe("bob");
    expect(
      resolveRelevantTurn(config, config.gameNights[1]!, "2026-07-17").personId,
    ).toBe("rick");
  });

  it("does not shift dates over DST boundaries", () => {
    expect(addCalendarDays("2026-03-28", 1)).toBe("2026-03-29");
    expect(addCalendarDays("2026-10-24", 1)).toBe("2026-10-25");
    expect(calendarDaysBetween("2026-03-27", "2026-04-03")).toBe(7);
    expect(
      todayInTimezone(
        "Europe/Amsterdam",
        DateTime.fromISO("2026-03-28T23:30:00Z"),
      ),
    ).toBe("2026-03-29");
  });
});
