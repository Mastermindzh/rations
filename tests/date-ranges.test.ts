import { describe, expect, it } from "vitest";
import { expandShortcut } from "../src/schedule/date-ranges.js";

describe("shortcut date ranges", () => {
  it("returns today through the end of this week (Sunday)", () => {
    // 2026-08-24 is a Monday.
    expect(
      expandShortcut("this-week", "2026-08-24", "Europe/Amsterdam"),
    ).toEqual([
      "2026-08-24",
      "2026-08-25",
      "2026-08-26",
      "2026-08-27",
      "2026-08-28",
      "2026-08-29",
      "2026-08-30",
    ]);
  });

  it("returns the seven days of next week", () => {
    const dates = expandShortcut(
      "next-week",
      "2026-08-27",
      "Europe/Amsterdam",
    ); // Thursday
    expect(dates).toHaveLength(7);
    expect(dates[0]).toBe("2026-08-31"); // Monday
    expect(dates[6]).toBe("2026-09-06"); // Sunday
  });

  it("returns today through the end of this month", () => {
    const dates = expandShortcut(
      "this-month",
      "2026-08-24",
      "Europe/Amsterdam",
    );
    expect(dates[0]).toBe("2026-08-24");
    expect(dates.at(-1)).toBe("2026-08-31");
    expect(dates).toHaveLength(8);
  });

  it("returns every day of next month", () => {
    const dates = expandShortcut(
      "next-month",
      "2026-08-24",
      "Europe/Amsterdam",
    );
    expect(dates[0]).toBe("2026-09-01");
    expect(dates.at(-1)).toBe("2026-09-30");
    expect(dates).toHaveLength(30);
  });

  it("crosses a year boundary in the configured timezone", () => {
    const dates = expandShortcut(
      "next-month",
      "2099-12-15",
      "Pacific/Kiritimati",
    );
    expect(dates[0]).toBe("2100-01-01");
    expect(dates.at(-1)).toBe("2100-01-31");
  });

  it("keeps calendar dates stable across a DST transition", () => {
    expect(
      expandShortcut("this-week", "2026-03-28", "Europe/Amsterdam"),
    ).toEqual(["2026-03-28", "2026-03-29"]);
  });

  it("rejects an invalid timezone", () => {
    expect(expandShortcut("this-week", "2026-08-24", "Not/AZone")).toEqual(
      [],
    );
  });
});
