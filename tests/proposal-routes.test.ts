import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hashPassword } from "../src/auth/password.js";
import { createApp } from "../src/index.js";
import {
  castVote,
  createPlannerProposal,
} from "../src/proposals/service.js";
import { futureProposalConfig } from "./fixtures.js";
import { createTestWorkspace } from "./test-workspace.js";
import { todayInTimezone } from "../src/schedule/calendar-date.js";

const setup = async () => {
  const config = futureProposalConfig();
  config.admin.passwordHash = await hashPassword("dev");
  const directory = await createTestWorkspace(
    "rations-proposal-route-",
    config,
  );
  return { directory, server: createApp(directory) };
};

const adminSession = async (server: ReturnType<typeof createApp>) => {
  const login = await server.request("/admin/login", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ password: "dev" }),
  });
  const cookie = login.headers.get("set-cookie")?.split(";")[0];
  expect(cookie).toBeTruthy();
  const dashboard = await server.request("/admin", {
    headers: { cookie: cookie! },
  });
  const html = await dashboard.text();
  const csrfToken = html.match(/name="csrfToken" value="([^"]+)"/)?.[1];
  expect(csrfToken).toBeTruthy();
  return { cookie: cookie!, csrfToken: csrfToken! };
};

describe("proposal HTTP routes", () => {
  it("requires the night share password to read proposals", async () => {
    const { server } = await setup();

    const response = await server.request("/night/friday-dnd/proposals");

    expect(response.status).toBe(401);
  });

  it("allows public proposal creation without an anonymous CSRF token", async () => {
    const { server } = await setup();

    const response = await server.request("/night/friday-dnd/propose", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        password: "dnd-secret",
        person: "rick",
        dates: "2099-03-01",
      }),
    });

    expect(response.status).toBe(303);
  });

  it("allows public voting without an anonymous CSRF token", async () => {
    const { directory, server } = await setup();
    const id = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-01"],
    });

    const response = await server.request(`/proposals/${id}/vote`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        password: "dnd-secret",
        person: "alice",
        date: "2099-03-01",
        vote: "up",
      }),
    });

    expect(response.status).toBe(303);
  });

  it("keeps proposal resolution routes admin-only", async () => {
    const { server } = await setup();

    for (const action of ["approve", "deny", "delete"]) {
      const response = await server.request(
        `/admin/proposals/missing/${action}`,
        { method: "POST" },
      );
      expect(response.status).toBe(303);
      expect(response.headers.get("location")).toBe("/admin/login");
    }
  });

  it("returns 404 when voting on an unknown proposal", async () => {
    const { server } = await setup();

    const response = await server.request("/proposals/missing/vote", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        password: "dnd-secret",
        person: "alice",
        date: "2099-03-01",
        vote: "up",
      }),
    });

    expect(response.status).toBe(404);
  });

  it("rate-limits repeated proposal creation attempts from one address", async () => {
    const { server } = await setup();
    const submit = () =>
      server.request("/night/friday-dnd/propose", {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.0.2.10",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          password: "dnd-secret",
          person: "nobody",
          dates: "2099-03-01",
        }),
      });

    for (let attempt = 0; attempt < 10; attempt += 1) {
      expect((await submit()).status).toBe(400);
    }
    expect((await submit()).status).toBe(429);
  });

  it("accepts only up or down as vote values", async () => {
    const { directory, server } = await setup();
    const id = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-01"],
    });
    for (const vote of ["sideways", ""]) {
      const response = await server.request(`/proposals/${id}/vote`, {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          password: "dnd-secret",
          person: "alice",
          date: "2099-03-01",
          vote,
        }),
      });

      expect(response.status).toBe(400);
    }
  });

  it("rate-limits repeated vote attempts from one address", async () => {
    const { directory, server } = await setup();
    const id = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-01"],
    });
    const submit = () =>
      server.request(`/proposals/${id}/vote`, {
        method: "POST",
        headers: {
          "x-forwarded-for": "192.0.2.20",
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          password: "dnd-secret",
          person: "nobody",
          date: "2099-03-01",
          vote: "up",
        }),
      });

    for (let attempt = 0; attempt < 60; attempt += 1) {
      expect((await submit()).status).toBe(400);
    }
    expect((await submit()).status).toBe(429);
  });

  it("shows proposal metadata and eliminated candidates to the administrator", async () => {
    const { directory, server } = await setup();
    const id = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-01"],
      unavailableThreshold: 1,
    });
    await castVote(directory, {
      proposalId: id,
      person: "alice",
      date: "2099-03-01",
      vote: "down",
    });
    const { cookie } = await adminSession(server);

    const dashboard = await server.request("/admin", { headers: { cookie } });
    const html = await dashboard.text();

    expect(html).toContain("Planner");
    expect(html).toContain("Open");
    expect(html).toContain("by Rick");
    expect(html).toContain('title="Alice"');
    expect(html).toMatch(/<time datetime="[^"]+">/);
    expect(html).toContain("Eliminated");
    expect(html).toContain("Show 1 hidden date");
    expect(html).toContain('<details class="hidden-dates">');
    const eliminatedCheckbox = html.match(
      /<input type="checkbox" name="dates" value="2099-03-01"[^>]*>/,
    )?.[0];
    expect(eliminatedCheckbox).toBeTruthy();
    expect(eliminatedCheckbox).not.toContain("checked");
  });

  it("marks planner lists with more than seven dates as scrollable", async () => {
    const { directory, server } = await setup();
    await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: Array.from(
        { length: 8 },
        (_, index) => `2099-03-${String(index + 1).padStart(2, "0")}`,
      ),
    });
    const { cookie } = await adminSession(server);

    const dashboard = await server.request("/admin", { headers: { cookie } });
    const html = await dashboard.text();

    expect(html).toContain(
      'class="candidate-list admin-candidate-list candidate-list-scroll"',
    );
    expect(html).toContain('class="admin-candidate-option"');
  });

  it("offers swap proposals for the current and every listed upcoming turn", async () => {
    const { server } = await setup();

    const response = await server.request(
      "/night/friday-dnd?password=dnd-secret",
    );
    const html = await response.text();

    expect(html.match(/\/propose-swap\?password=dnd-secret/g)).toHaveLength(4);
  });

  it("scopes the remembered voter identity to one game night", async () => {
    const { directory, server } = await setup();
    await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-01"],
    });

    const creation = await server.request(
      "/night/friday-dnd/propose?password=dnd-secret",
    );
    const voting = await server.request(
      "/night/friday-dnd/proposals?password=dnd-secret",
    );

    const creationHtml = await creation.text();
    expect(creationHtml).toContain(
      'data-voter-cookie-path="/night/friday-dnd"',
    );
    expect(creationHtml).toContain(
      `data-today="${todayInTimezone("Europe/Amsterdam")}"`,
    );
    expect(await voting.text()).toContain(
      'data-voter-cookie-path="/night/friday-dnd"',
    );
  });

  it("hides past planner candidates from voters", async () => {
    const { directory, server } = await setup();
    await writeFile(
      join(directory, "proposals.yml"),
      `proposals:
  - id: planner-with-past-date
    gameNight: friday-dnd
    type: planner
    createdBy: rick
    createdAt: 2026-01-01T00:00:00Z
    candidates: [2026-01-01, 2099-03-01]
    votes: []
`,
    );

    const response = await server.request(
      "/night/friday-dnd/proposals?password=dnd-secret",
    );
    const html = await response.text();

    expect(response.status).toBe(200);
    expect(html).not.toContain('data-date="2026-01-01"');
    expect(html).toContain('data-date="2099-03-01"');
  });

  it("shows an administrator when proposals.yml needs repair", async () => {
    const { directory, server } = await setup();
    await writeFile(join(directory, "proposals.yml"), "proposals: [");

    const { cookie } = await adminSession(server);
    const dashboard = await server.request("/admin", { headers: { cookie } });

    expect(await dashboard.text()).toContain("Date proposals need repair");
  });

  it("approving an empty planner selection adds no dates and resolves it", async () => {
    const { directory, server } = await setup();
    const id = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-01", "2099-03-02"],
    });
    const { cookie, csrfToken } = await adminSession(server);

    const response = await server.request(`/admin/proposals/${id}/approve`, {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrfToken }),
    });
    expect(response.status).toBe(303);

    const dashboard = await server.request("/admin", { headers: { cookie } });
    const html = await dashboard.text();
    expect(html).not.toContain(id);
    expect(html).not.toContain("2099-03-01");
    expect(html).not.toContain("2099-03-02");
  });

  it("denying a proposal resolves it without changing the schedule", async () => {
    const { directory, server } = await setup();
    const id = await createPlannerProposal(directory, {
      gameNightId: "friday-dnd",
      createdBy: "rick",
      candidates: ["2099-03-01"],
    });
    const { cookie, csrfToken } = await adminSession(server);

    const response = await server.request(`/admin/proposals/${id}/deny`, {
      method: "POST",
      headers: {
        cookie,
        "content-type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({ csrfToken }),
    });

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "/admin?status=proposal-denied",
    );
    const dashboard = await server.request("/admin", { headers: { cookie } });
    const html = await dashboard.text();
    expect(html).not.toContain(id);
    expect(html).not.toContain("2099-03-01");
  });
});
