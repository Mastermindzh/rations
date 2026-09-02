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
  resolveExtraDay,
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

  it("assigns people after moving a later occurrence ahead of another", () => {
    const config = fixtureConfig();
    config.dateOverrides.push({
      gameNight: "friday-dnd",
      oldDate: "2026-07-31",
      newDate: "2026-07-23",
    });
    const schedule = resolveNightSchedule(
      config,
      config.gameNights[0]!,
      "2026-07-17",
      3,
    );

    expect([schedule.current, ...schedule.upcoming]).toMatchObject([
      { date: "2026-07-17", personId: "rick" },
      {
        date: "2026-07-23",
        originalDate: "2026-07-31",
        personId: "alice",
      },
      { date: "2026-07-24", personId: "bob" },
      { date: "2026-08-07", personId: "rick" },
    ]);
  });

  it("assigns people after moving an occurrence behind another", () => {
    const config = fixtureConfig();
    config.dateOverrides.push({
      gameNight: "friday-dnd",
      oldDate: "2026-07-24",
      newDate: "2026-08-01",
    });
    const schedule = resolveNightSchedule(
      config,
      config.gameNights[0]!,
      "2026-07-17",
      3,
    );

    expect([schedule.current, ...schedule.upcoming]).toMatchObject([
      { date: "2026-07-17", personId: "rick" },
      { date: "2026-07-31", personId: "alice" },
      {
        date: "2026-08-01",
        originalDate: "2026-07-24",
        personId: "bob",
      },
      { date: "2026-08-07", personId: "rick" },
    ]);
  });

  it("combines extra and moved nights before assigning the rotation", () => {
    const config = fixtureConfig();
    config.extraDays.push({ gameNight: "friday-dnd", date: "2026-07-20" });
    config.dateOverrides.push({
      gameNight: "friday-dnd",
      oldDate: "2026-07-31",
      newDate: "2026-07-23",
    });
    const schedule = resolveNightSchedule(
      config,
      config.gameNights[0]!,
      "2026-07-17",
      3,
    );

    expect([schedule.current, ...schedule.upcoming]).toMatchObject([
      { date: "2026-07-17", personId: "rick" },
      { date: "2026-07-20", personId: "alice", isExtra: true },
      {
        date: "2026-07-23",
        originalDate: "2026-07-31",
        personId: "bob",
      },
      { date: "2026-07-24", personId: "rick" },
    ]);
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

  it("surfaces an extra day ahead of the next scheduled night", () => {
    const config = fixtureConfig();
    config.extraDays.push({
      gameNight: "friday-dnd",
      date: "2026-07-20",
      reason: "Bonus session",
    });
    expect(
      resolveRelevantTurn(config, config.gameNights[0]!, "2026-07-18"),
    ).toMatchObject({
      date: "2026-07-20",
      personId: "alice",
      isExtra: true,
      reason: "Bonus session",
    });
  });

  it("shifts later occurrences forward when an extra day is inserted", () => {
    const config = fixtureConfig();
    config.extraDays.push({ gameNight: "friday-dnd", date: "2026-07-20" });
    const night = config.gameNights[0]!;
    // Extra day takes the next person (alice); the following turns shift on.
    expect(resolveExtraDay(config, night, config.extraDays[0]!)).toMatchObject({
      personId: "alice",
    });
    expect(resolveTurnNumber(config, night, 1)).toMatchObject({
      date: "2026-07-24",
      personId: "bob",
    });
    expect(resolveTurnNumber(config, night, 2)).toMatchObject({
      date: "2026-07-31",
      personId: "rick",
    });
  });

  it("shifts the rotation but hides the extra day in the rotation-only view", () => {
    const config = fixtureConfig();
    config.extraDays.push({ gameNight: "friday-dnd", date: "2026-07-20" });
    const rotationOnly = resolveNightSchedule(
      config,
      config.gameNights[0]!,
      "2026-07-18",
      1,
      false,
    );
    expect(rotationOnly.current).toMatchObject({
      date: "2026-07-24",
      personId: "bob",
      isExtra: false,
    });
  });

  it("keeps extra days scoped to their own game night", () => {
    const config = fixtureConfig();
    config.extraDays.push({
      gameNight: "friday-dnd",
      date: "2026-07-20",
    });
    expect(
      resolveRelevantTurn(config, config.gameNights[1]!, "2026-07-18").isExtra,
    ).toBe(false);
  });

  it("always keeps upcoming extra days beyond the render limit", () => {
    const config = fixtureConfig();
    config.extraDays.push({ gameNight: "friday-dnd", date: "2026-12-26" });
    const schedule = resolveNightSchedule(
      config,
      config.gameNights[0]!,
      "2026-07-17",
    );
    expect(
      schedule.upcoming.some(
        (turn) => turn.date === "2026-12-26" && turn.isExtra,
      ),
    ).toBe(true);
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
