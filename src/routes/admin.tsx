import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../env.js";
import {
  loadConfig,
  readConfigFile,
  saveConfigFile,
  validateConfigYaml,
} from "../config/file.js";
import { ConfigError } from "../config/config-error.js";
import { todayInTimezone } from "../schedule/calendar-date.js";
import { delayOnce } from "../services/delay-once.js";
import { rescheduleNight } from "../services/reschedule-night.js";
import { addExtraDay } from "../services/add-extra-day.js";
import { buildQuickActions } from "../queries/dashboard.js";
import { AdminDashboardPage } from "../views/admin-dashboard.js";
import { AdminRepairPage } from "../views/admin-repair.js";
import { noticeFromStatus, type Notice } from "../views/notice.js";
import { renderConfigError } from "./config-error.js";
import type { ValidationIssue } from "../config/types.js";

function stringField(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function adminRoutes(dataDirectory: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  async function renderDashboard(
    c: Context<AppEnv>,
    options: {
      rawYaml?: string;
      validationErrors?: ValidationIssue[];
      notice?: Notice;
    } = {},
  ) {
    let loaded;
    try {
      loaded = await loadConfig(dataDirectory);
    } catch (error) {
      if (!(error instanceof ConfigError) || error.code !== "INVALID_CONFIG")
        throw error;
      const raw = await readConfigFile(dataDirectory);
      const validation = validateConfigYaml(options.rawYaml ?? raw.rawYaml);
      const validationErrors =
        options.validationErrors ??
        (validation.success ? [] : validation.errors);
      const notice = options.notice;
      return c.html(
        <AdminRepairPage
          rawYaml={options.rawYaml ?? raw.rawYaml}
          version={raw.version}
          modifiedAt={raw.modifiedAt}
          csrfToken={c.get("csrfToken") ?? ""}
          validationErrors={validationErrors}
          {...(notice ? { notice } : {})}
        />,
      );
    }
    const today = todayInTimezone(loaded.config.site.timezone);
    const quickNights = buildQuickActions(loaded.config, today);
    const notice = options.notice ?? noticeFromStatus(c.req.query("status"));
    return c.html(
      <AdminDashboardPage
        config={loaded.config}
        rawYaml={options.rawYaml ?? loaded.rawYaml}
        version={loaded.version}
        modifiedAt={loaded.modifiedAt}
        csrfToken={c.get("csrfToken") ?? ""}
        quickNights={quickNights}
        validationErrors={options.validationErrors ?? []}
        {...(notice ? { notice } : {})}
      />,
    );
  }

  app.get("/admin", (c) => renderDashboard(c));
  app.get("/admin/config", (c) => c.redirect("/admin#editor", 303));

  app.post("/admin/config/validate", async (c) => {
    const body = await c.req.parseBody();
    const rawYaml = stringField(body.rawYaml);
    const result = validateConfigYaml(rawYaml);
    if (!result.success)
      return renderDashboard(c, { rawYaml, validationErrors: result.errors });
    return renderDashboard(c, {
      rawYaml,
      notice: {
        kind: "success",
        message: "Configuration is valid. Nothing was written.",
      },
    });
  });

  app.post("/admin/config/save", async (c) => {
    const body = await c.req.parseBody();
    const rawYaml = stringField(body.rawYaml);
    const expectedVersion = stringField(body.expectedVersion);
    const validation = validateConfigYaml(rawYaml);
    if (!validation.success)
      return renderDashboard(c, {
        rawYaml,
        validationErrors: validation.errors,
      });
    try {
      await saveConfigFile(dataDirectory, rawYaml, expectedVersion);
      return c.redirect("/admin?status=saved#editor", 303);
    } catch (error) {
      return renderConfigError(c, "Configuration not saved", error);
    }
  });

  app.post("/admin/night/:id/delay-once", async (c) => {
    const body = await c.req.parseBody();
    try {
      await delayOnce(dataDirectory, {
        gameNightId: c.req.param("id"),
        expectedVersion: stringField(body.expectedVersion),
        currentDate: stringField(body.currentDate),
      });
      const returnTo = stringField(body.returnTo);
      const safeReturn =
        returnTo === "/admin" || returnTo === `/night/${c.req.param("id")}`
          ? returnTo
          : "/admin";
      return c.redirect(
        `${safeReturn}${safeReturn.includes("?") ? "&" : "?"}status=delayed`,
        303,
      );
    } catch (error) {
      return renderConfigError(c, "Delay failed", error);
    }
  });

  app.post("/admin/night/:id/reschedule", async (c) => {
    const body = await c.req.parseBody();
    const oldDate = stringField(body.oldDate);
    try {
      await rescheduleNight(dataDirectory, {
        gameNightId: c.req.param("id"),
        expectedVersion: stringField(body.expectedVersion),
        oldDate,
        newDate: stringField(body.reset) ? oldDate : stringField(body.newDate),
      });
      return c.redirect("/admin?status=rescheduled", 303);
    } catch (error) {
      return renderConfigError(c, "Reschedule failed", error);
    }
  });

  app.post("/admin/night/:id/extra-day", async (c) => {
    const body = await c.req.parseBody();
    const reason = stringField(body.reason).trim();
    try {
      await addExtraDay(dataDirectory, {
        gameNightId: c.req.param("id"),
        expectedVersion: stringField(body.expectedVersion),
        date: stringField(body.date),
        ...(reason ? { reason } : {}),
      });
      return c.redirect("/admin?status=extra-added", 303);
    } catch (error) {
      return renderConfigError(c, "Extra day not added", error);
    }
  });
  return app;
}
