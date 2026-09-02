import { describe, expect, it } from "vitest";
import { buildQuickActions } from "../src/queries/dashboard.js";
import { fixtureConfig } from "./fixtures.js";

describe("admin dashboard queries", () => {
  it("uses an extra night as the next delay-once occurrence", () => {
    const config = fixtureConfig();
    config.extraDays.push({ gameNight: "friday-dnd", date: "2026-07-20" });

    const quickNight = buildQuickActions(config, "2026-07-17").find(
      ({ night }) => night.id === "friday-dnd",
    );

    expect(quickNight).toMatchObject({
      current: { date: "2026-07-17", personId: "rick" },
      next: { date: "2026-07-20", personId: "alice", isExtra: true },
      reschedule: { date: "2026-07-17", isExtra: false },
    });
  });

  it("uses an extra night as the current delay-once occurrence", () => {
    const config = fixtureConfig();
    config.extraDays.push({ gameNight: "friday-dnd", date: "2026-07-20" });

    const quickNight = buildQuickActions(config, "2026-07-18").find(
      ({ night }) => night.id === "friday-dnd",
    );

    expect(quickNight).toMatchObject({
      current: { date: "2026-07-20", personId: "alice", isExtra: true },
      next: { date: "2026-07-24", personId: "bob" },
      reschedule: { date: "2026-07-24", isExtra: false },
    });
  });
});
