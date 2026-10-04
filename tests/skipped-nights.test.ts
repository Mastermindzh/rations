import { describe, expect, it } from "vitest";
import { fixtureConfig, futureProposalConfig } from "./fixtures.js";
import { createTestWorkspace } from "./test-workspace.js";
import { resolveNightSchedule } from "../src/schedule/resolve-turn.js";
import {
  applySkipNight,
  applyRestoreNight,
} from "../src/services/skip-night.js";
import { applyDelayOnce } from "../src/services/delay-once.js";
import { validateConfig } from "../src/config/validation.js";
import { loadConfig, changeConfig } from "../src/config/file.js";
import {
  createSkipProposal,
  createSwapProposal,
  createPlannerProposal,
  approveProposal,
  castVote,
} from "../src/proposals/service.js";
import { loadProposals } from "../src/proposals/store.js";
import { createApp } from "../src/index.js";
import { hashPassword } from "../src/auth/password.js";

describe("skipped nights", () => {
  it("rejects extras as skip targets", () => {
    const config = fixtureConfig();
    config.extraDays.push({ gameNight: "friday-dnd", date: "2026-07-18" });
    expect(() => applySkipNight(config, "friday-dnd", "2026-07-18")).toThrow(
      "extra days must be removed separately",
    );
  });

  it("rejects a swap from a moved occurrence that was subsequently skipped", async () => {
    const config = futureProposalConfig();
    config.dateOverrides.push({
      gameNight: "friday-dnd",
      oldDate: "2099-01-05",
      newDate: "2099-01-06",
    });
    const directory = await createTestWorkspace("rations-skips-", config);
    const id = await createSwapProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      targetDate: "2099-01-06",
      newDate: "2099-01-07",
    });
    const loaded = await loadConfig(directory);
    await changeConfig(directory, loaded.version, (current) => ({
      ...applySkipNight(current, "friday-dnd", "2099-01-06"),
      extraDays: [{ gameNight: "friday-dnd", date: "2099-01-07" }],
    }));
    await expect(approveProposal(directory, { id })).rejects.toThrow(
      "skipped night",
    );
  });
  it("carries turns forward, preserves page length, and isolates other nights", () => {
    let config = fixtureConfig();
    config = applySkipNight(config, "friday-dnd", "2026-07-17");
    config = applySkipNight(config, "friday-dnd", "2026-07-31");
    const schedule = resolveNightSchedule(
      config,
      config.gameNights[0]!,
      "2026-07-17",
      3,
    );
    expect(
      [schedule.current, ...schedule.upcoming].map((turn) => [
        turn.date,
        turn.personId,
      ]),
    ).toEqual([
      ["2026-07-24", "rick"],
      ["2026-08-07", "alice"],
      ["2026-08-14", "bob"],
      ["2026-08-21", "rick"],
    ]);
    expect(
      resolveNightSchedule(config, config.gameNights[1]!, "2026-07-17").current
        .personId,
    ).toBe("charlie");
    const delayed = applyDelayOnce(config, "friday-dnd", "2026-07-24");
    expect(delayed.overrides.map((item) => [item.date, item.person])).toEqual([
      ["2026-07-24", "alice"],
      ["2026-08-07", "rick"],
    ]);
  });

  it.each(["2026-07-16", "2026-07-18"])(
    "handles an extra day on %s around a skip",
    (date) => {
      const config = applySkipNight(
        fixtureConfig(),
        "friday-dnd",
        "2026-07-17",
      );
      config.extraDays.push({ gameNight: "friday-dnd", date });
      const schedule = resolveNightSchedule(
        config,
        config.gameNights[0]!,
        "2026-07-16",
        1,
      );
      expect(schedule.current).toMatchObject({
        date,
        personId: "rick",
        isExtra: true,
      });
      expect(schedule.upcoming[0]).toMatchObject({
        date: "2026-07-24",
        personId: "alice",
      });
    },
  );

  it("skips moved nights by visible date and clears conflicting overrides", () => {
    const config = fixtureConfig();
    config.dateOverrides.push({
      gameNight: "friday-dnd",
      oldDate: "2026-07-17",
      newDate: "2026-07-20",
    });
    config.overrides.push({
      gameNight: "friday-dnd",
      date: "2026-07-17",
      person: "bob",
    });
    const updated = applySkipNight(config, "friday-dnd", "2026-07-20", "Away");
    expect(updated.skippedDays).toEqual([
      { gameNight: "friday-dnd", date: "2026-07-17", reason: "Away" },
    ]);
    expect(updated.dateOverrides).toEqual([]);
    expect(updated.overrides).toEqual([]);
    expect(validateConfig(updated).success).toBe(true);
  });

  it.each([
    { gameNight: "unknown", date: "2026-07-17" },
    { gameNight: "friday-dnd", date: "2026-02-30" },
    { gameNight: "friday-dnd", date: "2026-07-18" },
    { gameNight: "friday-dnd", date: "2026-07-10" },
  ])("rejects invalid skip %j", (skip) => {
    const config = fixtureConfig();
    config.skippedDays.push(skip);
    expect(validateConfig(config).success).toBe(false);
  });

  it("rejects duplicate and conflicting adjustments in YAML", () => {
    const config = applySkipNight(fixtureConfig(), "friday-dnd", "2026-07-17");
    for (const adjustment of [
      { skippedDays: [...config.skippedDays, ...config.skippedDays] },
      {
        overrides: [
          { gameNight: "friday-dnd", date: "2026-07-17", person: "rick" },
        ],
      },
      {
        dateOverrides: [
          {
            gameNight: "friday-dnd",
            oldDate: "2026-07-17",
            newDate: "2026-07-18",
          },
        ],
      },
      {
        dateOverrides: [
          {
            gameNight: "friday-dnd",
            oldDate: "2026-07-24",
            newDate: "2026-07-17",
          },
        ],
      },
      { extraDays: [{ gameNight: "friday-dnd", date: "2026-07-17" }] },
    ])
      expect(validateConfig({ ...config, ...adjustment }).success).toBe(false);
  });

  it("restores future skips and prohibits rewriting historical rotation", () => {
    const config = futureProposalConfig();
    const skipped = applySkipNight(config, "friday-dnd", "2099-01-05");
    expect(applyRestoreNight(skipped, "friday-dnd", "2099-01-05")).toEqual(
      config,
    );
    const historical = applySkipNight(
      fixtureConfig(),
      "friday-dnd",
      "2026-07-17",
    );
    expect(() =>
      applyRestoreNight(historical, "friday-dnd", "2026-07-17"),
    ).toThrow("Past skips");
    const night = historical.gameNights[0]!;
    expect(
      resolveNightSchedule(historical, night, "2026-07-24").current.personId,
    ).toBe("rick");
    expect(
      resolveNightSchedule(
        { ...historical, skippedDays: [] },
        night,
        "2026-07-24",
      ).current.personId,
    ).toBe("alice");
  });

  it("blocks skipped swap sources/destinations and planner recreation", async () => {
    const directory = await createTestWorkspace(
      "rations-skips-",
      futureProposalConfig(),
    );
    const staleSwap = await createSwapProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      targetDate: "2099-01-05",
      newDate: "2099-01-06",
    });
    const skip = await createSkipProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "alice",
      targetDate: "2099-01-05",
    });
    await castVote(directory, {
      proposalId: skip,
      person: "rick",
      date: "2099-01-05",
      vote: "up",
    });
    await approveProposal(directory, { id: skip });
    await expect(approveProposal(directory, { id: staleSwap })).rejects.toThrow(
      "skipped night",
    );
    await expect(
      createSwapProposal(directory, {
        gameNightId: "friday-dnd",
        createdBy: "rick",
        targetDate: "2099-01-05",
        newDate: "2099-01-06",
      }),
    ).rejects.toThrow("not on the schedule");
    await expect(
      createSwapProposal(directory, {
        gameNightId: "friday-dnd",
        createdBy: "rick",
        targetDate: "2099-01-12",
        newDate: "2099-01-05",
      }),
    ).rejects.toThrow("not available");
    const planner = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-01-05"],
    });
    await approveProposal(directory, { id: planner });
    expect((await loadConfig(directory)).config.extraDays).toEqual([]);
  });

  it("rejects a changed proposal target and tolerates approval retries", async () => {
    const directory = await createTestWorkspace(
      "rations-skips-",
      futureProposalConfig(),
    );
    const input = {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      targetDate: "2099-01-05",
    };
    const id = await createSkipProposal(directory, input);
    let loaded = await loadConfig(directory);
    await changeConfig(directory, loaded.version, (config) => ({
      ...config,
      dateOverrides: [
        {
          gameNight: "friday-dnd",
          oldDate: "2099-01-05",
          newDate: "2099-01-06",
        },
      ],
    }));
    await expect(approveProposal(directory, { id })).rejects.toThrow(
      "has changed",
    );
    loaded = await loadConfig(directory);
    await changeConfig(directory, loaded.version, (config) =>
      applySkipNight(config, "friday-dnd", "2099-01-06"),
    );
    await approveProposal(directory, { id });
    expect((await loadConfig(directory)).config.skippedDays).toHaveLength(1);
    expect((await loadProposals(directory)).proposals).toEqual([]);
  });

  it("offers a protected GUI proposal and requires admin approval with CSRF", async () => {
    const config = futureProposalConfig();
    config.admin.passwordHash = await hashPassword("dev");
    const directory = await createTestWorkspace("rations-skips-", config);
    const app = createApp(directory);
    const url = "/night/friday-dnd/date/2099-01-05/propose-skip";
    expect((await app.request(url)).status).toBe(401);
    expect(
      await (await app.request(`${url}?password=dnd-secret`)).text(),
    ).toContain("Next actual night");
    const post = (path: string, body: Record<string, string>, cookie = "") =>
      app.request(path, {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
          cookie,
        },
        body: new URLSearchParams(body),
      });
    expect(
      (await post(url, { password: "dnd-secret", person: "rick" })).status,
    ).toBe(303);
    expect((await loadConfig(directory)).config.skippedDays).toEqual([]);
    const proposal = (await loadProposals(directory)).proposals[0]!;
    const approveUrl = `/admin/proposals/${proposal.id}/approve`;
    expect((await post(approveUrl, {})).status).toBe(303);
    const login = await post("/admin/login", { password: "dev" });
    const cookie = login.headers.get("set-cookie")!.split(";")[0]!;
    expect((await post(approveUrl, {}, cookie)).status).toBe(403);
    const html = await (
      await app.request("/admin", { headers: { cookie } })
    ).text();
    const csrfToken = html.match(/name="csrfToken" value="([^"]+)"/)![1]!;
    expect((await post(approveUrl, { csrfToken }, cookie)).status).toBe(303);
    expect((await loadConfig(directory)).config.skippedDays).toEqual([
      { gameNight: "friday-dnd", date: "2099-01-05" },
    ]);
    const publicPage = await (
      await app.request("/night/friday-dnd?password=dnd-secret")
    ).text();
    expect(publicPage).not.toContain("/date/2099-01-05/");
    expect(publicPage).toContain("/date/2099-01-12/propose-skip");
    let loaded = await loadConfig(directory);
    expect(
      (
        await post(
          "/admin/night/friday-dnd/restore",
          { csrfToken, date: "2099-01-05", expectedVersion: loaded.version },
          cookie,
        )
      ).status,
    ).toBe(303);
    loaded = await loadConfig(directory);
    expect(loaded.config.skippedDays).toEqual([]);
    await changeConfig(directory, loaded.version, (current) => ({
      ...current,
      extraDays: [{ gameNight: "friday-dnd", date: "2099-01-06" }],
      overrides: [
        {
          gameNight: "friday-dnd",
          date: "2099-01-06",
          person: "bob",
          isExtra: true,
        },
      ],
    }));
    loaded = await loadConfig(directory);
    expect(
      (
        await post(
          "/admin/night/friday-dnd/remove-extra",
          { csrfToken, date: "2099-01-06", expectedVersion: loaded.version },
          cookie,
        )
      ).status,
    ).toBe(303);
    loaded = await loadConfig(directory);
    expect(loaded.config.extraDays).toEqual([]);
    expect(loaded.config.overrides).toEqual([]);
    expect(
      resolveNightSchedule(
        loaded.config,
        loaded.config.gameNights[0]!,
        "2099-01-12",
      ).current.personId,
    ).toBe("alice");
  });
});
