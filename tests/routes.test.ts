import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { createApp } from "../src/index.js";
import { fixtureConfig, fixtureYaml } from "./fixtures.js";
import { hashPassword } from "../src/auth/password.js";
import { createTestWorkspace } from "./test-workspace.js";

let activeDirectory: string | undefined;

const app = async (config = fixtureConfig()) => {
  const directory = await createTestWorkspace("rations-route-", config);
  activeDirectory = directory;
  return createApp(directory);
};

describe("HTTP routes", () => {
  it("accepts separate list and game passwords in the URL", async () => {
    const server = await app();
    const listLogin = await server.request("/");
    expect(listLogin.status).toBe(401);
    const listLoginHtml = await listLogin.text();
    expect(listLoginHtml).toContain("/public/logo-192.png");
    expect(listLoginHtml).not.toContain('<header class="site-header">');
    expect((await server.request("/?password=wrong")).status).toBe(401);
    const overview = await server.request("/?password=list-secret");
    expect(overview.status).toBe(200);
    const overviewHtml = await overview.text();
    expect(overviewHtml).toContain("Friday D&amp;D");
    expect(overviewHtml).toContain("3 players");
    expect(overviewHtml).toContain(
      '<a class="card-link" href="/night/friday-dnd?password=dnd-secret"',
    );
    expect(overviewHtml).toContain(
      '<div class="card-actions"><button class="share-link" type="button" data-share-url="/night/friday-dnd?password=dnd-secret"',
    );
    expect(overviewHtml).toMatch(
      /<script src="\/public\/app\.js\?v=[^"]+" defer=""><\/script>/,
    );
    const nightLogin = await server.request("/night/friday-dnd");
    expect(nightLogin.status).toBe(401);
    const nightLoginHtml = await nightLogin.text();
    expect(nightLoginHtml).toContain("/public/logo-192.png");
    expect(nightLoginHtml).not.toContain('<header class="site-header">');
    expect(
      (await server.request("/night/friday-dnd?password=wrong")).status,
    ).toBe(401);
    const detail = await server.request(
      "/night/friday-dnd?password=dnd-secret",
    );
    expect(detail.status).toBe(200);
    expect(detail.headers.get("cache-control")).toBe("private, no-store");
    expect(detail.headers.get("referrer-policy")).toBe("no-referrer");
    const detailHtml = await detail.text();
    expect(detailHtml).toContain("Friday D&amp;D");
    expect(detailHtml).not.toContain(">Previous<");
    expect(detailHtml).not.toContain("First snack duty");
    expect(detailHtml).toContain(
      '<details class="night-panel"><summary>Schedule</summary>',
    );
    expect(detailHtml).not.toContain('class="description"');
  });

  it("makes list and game pages public when their passwords are empty", async () => {
    const config = fixtureConfig();
    config.site.password = "";
    config.gameNights[0]!.password = "";
    const server = await app(config);
    expect((await server.request("/")).status).toBe(200);
    expect((await server.request("/night/friday-dnd")).status).toBe(200);
    const overview = await server.request("/");
    const overviewHtml = await overview.text();
    expect(overviewHtml).toContain(
      '<a class="card-link" href="/night/friday-dnd"',
    );
    expect(overviewHtml).toContain('data-share-url="/night/friday-dnd"');
  });

  it("shows the original date when a game night is rescheduled", async () => {
    const config = fixtureConfig();
    config.gameNights[0]!.anchorDate = "2099-07-17";
    config.dateOverrides = [
      {
        gameNight: "friday-dnd",
        oldDate: "2099-07-17",
        newDate: "2099-07-19",
      },
    ];
    const server = await app(config);
    const overview = await server.request("/?password=list-secret");
    expect(await overview.text()).toContain(
      '<small class="original-date">Originally',
    );
    const detail = await server.request(
      "/night/friday-dnd?password=dnd-secret",
    );
    const detailHtml = await detail.text();
    expect(detailHtml).toContain('<html lang="nl-NL">');
    expect(detailHtml).toContain("Zondag 19 juli");
    expect(detailHtml).toContain(
      '<small class="original-date">Originally Vrijdag 17 juli</small>',
    );
  });

  it("returns styled not-found pages", async () => {
    const server = await app();
    const response = await server.request("/night/missing");
    expect(response.status).toBe(404);
    expect(await response.text()).toContain("Game night not found");
  });

  it("protects admin and reports health", async () => {
    const server = await app();
    expect((await server.request("/admin")).status).toBe(303);
    const login = await server.request("/admin/login");
    const loginHtml = await login.text();
    expect(loginHtml).toContain("/public/logo-192.png");
    expect(loginHtml).not.toContain('<header class="site-header">');
    expect(await (await server.request("/health")).json()).toEqual({
      status: "ok",
    });
  });

  it("does not expose invalid active configuration details publicly", async () => {
    const server = await app();
    const directory = activeDirectory!;
    await writeFile(join(directory, "config.yml"), "invalid: true");
    const response = await server.request(
      "/night/friday-dnd?password=dnd-secret",
    );
    expect(response.status).toBe(503);
    const body = await response.text();
    expect(body).toContain("temporarily unavailable");
    expect(body).not.toContain("site: Invalid input");
    expect((await server.request("/health")).status).toBe(503);
  });

  it("authenticates the administrator and requires CSRF on mutations", async () => {
    const previousSecret = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "0123456789012345678901234567890123456789";
    try {
      const config = fixtureConfig();
      config.admin.passwordHash = await hashPassword("dev");
      config.gameNights[0]!.anchorDate = "2099-07-17";
      const server = await app(config);
      const login = await server.request("/admin/login", {
        method: "POST",
        headers: { "content-type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ password: "dev" }),
      });
      expect(login.status).toBe(303);
      const cookie = login.headers.get("set-cookie")?.split(";")[0];
      expect(cookie).toContain("rations_session=");
      const dashboard = await server.request("/admin", {
        headers: { cookie: cookie! },
      });
      expect(dashboard.status).toBe(200);
      const dashboardHtml = await dashboard.text();
      expect(dashboardHtml).toContain("Control room");
      expect(dashboardHtml.indexOf("Saturday Games")).toBeLessThan(
        dashboardHtml.indexOf("Friday D&amp;D"),
      );
      expect(dashboardHtml).toContain(
        "original-date original-date-placeholder",
      );
      expect(dashboardHtml).toContain(
        '<nav class="header-actions" aria-label="Admin actions">',
      );
      expect(dashboardHtml.match(/>Log out<\/button>/g)).toHaveLength(1);
      expect(dashboardHtml).toContain(
        '<details class="admin-section editor-section" id="editor">',
      );
      expect(dashboardHtml).toContain(
        'action="/admin/night/friday-dnd/delay-once"',
      );
      expect(dashboardHtml).toContain(
        'action="/admin/night/friday-dnd/reschedule"',
      );
      expect(dashboardHtml).toContain(
        'name="newDate" type="date" value="2099-07-17"',
      );
      const csrfToken = dashboardHtml.match(
        /name="csrfToken" value="([^"]+)"/,
      )?.[1];
      const expectedVersion = dashboardHtml.match(
        /name="expectedVersion" value="([^"]+)"/,
      )?.[1];
      expect(csrfToken).toBeTruthy();
      expect(expectedVersion).toBeTruthy();

      const rescheduled = await server.request(
        "/admin/night/friday-dnd/reschedule",
        {
          method: "POST",
          headers: {
            cookie: cookie!,
            "content-type": "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            csrfToken: csrfToken!,
            expectedVersion: expectedVersion!,
            oldDate: "2099-07-17",
            newDate: "2099-07-19",
          }),
        },
      );
      expect(rescheduled.status).toBe(303);
      expect(rescheduled.headers.get("location")).toBe(
        "/admin?status=rescheduled",
      );
      const updatedDashboard = await server.request("/admin", {
        headers: { cookie: cookie! },
      });
      const updatedDashboardHtml = await updatedDashboard.text();
      expect(updatedDashboardHtml).toContain(
        'name="newDate" type="date" value="2099-07-19"',
      );
      expect(updatedDashboardHtml).toContain('name="reset" value="true"');

      const updatedVersion = updatedDashboardHtml.match(
        /name="expectedVersion" value="([^"]+)"/,
      )?.[1];
      const reset = await server.request("/admin/night/friday-dnd/reschedule", {
        method: "POST",
        headers: {
          cookie: cookie!,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({
          csrfToken: csrfToken!,
          expectedVersion: updatedVersion!,
          oldDate: "2099-07-17",
          newDate: "2099-07-19",
          reset: "true",
        }),
      });
      expect(reset.status).toBe(303);
      const resetDashboard = await server.request("/admin", {
        headers: { cookie: cookie! },
      });
      expect(await resetDashboard.text()).not.toContain(
        'name="reset" value="true"',
      );

      const adminDetail = await server.request("/night/friday-dnd", {
        headers: { cookie: cookie! },
      });
      const adminDetailHtml = await adminDetail.text();
      expect(adminDetailHtml).not.toContain(
        'action="/admin/night/friday-dnd/delay-once"',
      );
      expect(adminDetailHtml).not.toContain(">Delay once</button>");

      const homepage = await server.request("/", {
        headers: { cookie: cookie! },
      });
      expect(homepage.status).toBe(200);
      expect(await homepage.text()).toContain(
        "/night/friday-dnd?password=dnd-secret",
      );
      const noCsrf = await server.request("/admin/config/validate", {
        method: "POST",
        headers: {
          cookie: cookie!,
          "content-type": "application/x-www-form-urlencoded",
        },
        body: new URLSearchParams({ rawYaml: fixtureYaml() }),
      });
      expect(noCsrf.status).toBe(403);
    } finally {
      if (previousSecret === undefined) {
        delete process.env.SESSION_SECRET;
      } else {
        process.env.SESSION_SECRET = previousSecret;
      }
    }
  });
});
