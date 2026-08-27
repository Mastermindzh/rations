import { Hono } from "hono";
import type { Context } from "hono";
import type { AppEnv } from "../env.js";
import { loadConfig } from "../config/file.js";
import { ConfigError } from "../config/config-error.js";
import type { GameNightConfig, LoadedConfig } from "../config/types.js";
import { loadProposals } from "../proposals/store.js";
import { createSwapProposal, castVote } from "../proposals/service.js";
import { createPlannerProposal } from "../proposals/service.js";
import {
  shareAccessGranted,
  withSharePassword,
} from "../services/share-access.js";
import { todayInTimezone } from "../schedule/calendar-date.js";
import { expandShortcut, type ShortcutKind } from "../schedule/date-ranges.js";
import {
  SwapProposePage,
  NightProposalsPage,
  PlannerProposePage,
} from "../views/proposals.js";
import { ErrorPage } from "../views/error-page.js";
import { clientIp } from "../services/login-throttle.js";
import {
  createRequestThrottle,
  type RequestThrottle,
} from "../services/request-throttle.js";
import { stringField, stringList } from "./form-fields.js";

type AuthorizedNight = {
  loaded: LoadedConfig;
  night: GameNightConfig;
};

const buildShortcuts = (
  today: string,
  timezone: string,
): Record<ShortcutKind, string[]> => {
  return {
    "this-week": expandShortcut("this-week", today, timezone),
    "next-week": expandShortcut("next-week", today, timezone),
    "this-month": expandShortcut("this-month", today, timezone),
    "next-month": expandShortcut("next-month", today, timezone),
  };
};

const voteValue = (value: unknown): "up" | "down" | undefined =>
  value === "up" || value === "down" ? value : undefined;

const notFound = (
  c: Context<AppEnv>,
  status: 404 | 401 = 404,
): Response | Promise<Response> => {
  const title = status === 401 ? "Password required" : "Not found";
  const message =
    status === 401
      ? "This game night is protected. Use the shared link."
      : "The page you're trying to view wandered off on an adventure.";
  return c.html(
    <ErrorPage title={title} message={message} status={status} admin={false} />,
    status,
  );
};

const getClientAddress = (c: Context<AppEnv>): string => {
  return clientIp(c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"));
};

const rateLimited = (
  c: Context<AppEnv>,
  throttle: RequestThrottle,
): Response | null => {
  return throttle.allow(getClientAddress(c))
    ? null
    : c.text("Too many requests. Try again later.", 429);
};

const loadAuthorizedNight = async (
  c: Context<AppEnv>,
  dataDirectory: string,
  gameNightId: string,
  password: string,
): Promise<AuthorizedNight | Response> => {
  const loaded = await loadConfig(dataDirectory);
  const night = loaded.config.gameNights.find(
    (item) => item.id === gameNightId,
  );
  if (!night) {
    return notFound(c);
  }
  if (!shareAccessGranted(c.get("isAdmin"), night.password, password)) {
    return notFound(c, 401);
  }
  return { loaded, night };
};

export function proposalRoutes(dataDirectory: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const creationThrottle = createRequestThrottle(10, 60_000);
  const voteThrottle = createRequestThrottle(60, 60_000);

  app.get("/night/:id/propose", async (c) => {
    const password = c.req.query("password") ?? "";
    const context = await loadAuthorizedNight(
      c,
      dataDirectory,
      c.req.param("id"),
      password,
    );
    if (context instanceof Response) {
      return context;
    }
    const { loaded, night } = context;
    const today = todayInTimezone(loaded.config.site.timezone);
    return c.html(
      <PlannerProposePage
        config={loaded.config}
        night={night}
        today={today}
        shortcuts={buildShortcuts(today, loaded.config.site.timezone)}
        {...(password ? { password } : {})}
      />,
    );
  });

  app.post("/night/:id/propose", async (c) => {
    const body = await c.req.parseBody({ all: true });
    const limited = rateLimited(c, creationThrottle);
    if (limited) {
      return limited;
    }
    const password = stringField(body.password);
    const context = await loadAuthorizedNight(
      c,
      dataDirectory,
      c.req.param("id"),
      password,
    );
    if (context instanceof Response) {
      return context;
    }
    const { loaded, night } = context;
    const thresholdRaw = Number.parseInt(stringField(body.threshold), 10);
    const threshold =
      body.thresholdEnabled === "on" && Number.isInteger(thresholdRaw)
        ? thresholdRaw
        : undefined;
    const title = stringField(body.title).trim();
    try {
      await createPlannerProposal(dataDirectory, {
        gameNightId: night.id,
        createdBy: stringField(body.person),
        candidates: stringList(body.dates),
        ...(threshold !== undefined ? { unavailableThreshold: threshold } : {}),
        ...(title ? { title } : {}),
      });
    } catch (error) {
      if (!(error instanceof ConfigError)) {
        throw error;
      }
      const today = todayInTimezone(loaded.config.site.timezone);
      return c.html(
        <PlannerProposePage
          config={loaded.config}
          night={night}
          today={today}
          shortcuts={buildShortcuts(today, loaded.config.site.timezone)}
          error={error.message}
          {...(password ? { password } : {})}
        />,
        400,
      );
    }
    return c.redirect(
      withSharePassword(`/night/${night.id}/proposals`, password),
      303,
    );
  });

  app.get("/night/:id/date/:date/propose-swap", async (c) => {
    const password = c.req.query("password") ?? "";
    const context = await loadAuthorizedNight(
      c,
      dataDirectory,
      c.req.param("id"),
      password,
    );
    if (context instanceof Response) {
      return context;
    }
    const { loaded, night } = context;
    return c.html(
      <SwapProposePage
        config={loaded.config}
        night={night}
        targetDate={c.req.param("date")}
        {...(password ? { password } : {})}
      />,
    );
  });

  app.post("/night/:id/date/:date/propose-swap", async (c) => {
    const body = await c.req.parseBody();
    const limited = rateLimited(c, creationThrottle);
    if (limited) {
      return limited;
    }
    const password = stringField(body.password);
    const context = await loadAuthorizedNight(
      c,
      dataDirectory,
      c.req.param("id"),
      password,
    );
    if (context instanceof Response) {
      return context;
    }
    const { loaded, night } = context;
    try {
      await createSwapProposal(dataDirectory, {
        gameNightId: night.id,
        createdBy: stringField(body.person),
        targetDate: c.req.param("date"),
        newDate: stringField(body.newDate),
      });
    } catch (error) {
      if (!(error instanceof ConfigError)) {
        throw error;
      }
      return c.html(
        <SwapProposePage
          config={loaded.config}
          night={night}
          targetDate={c.req.param("date")}
          error={error.message}
          {...(password ? { password } : {})}
        />,
        400,
      );
    }
    return c.redirect(
      withSharePassword(`/night/${night.id}/proposals`, password),
      303,
    );
  });

  app.get("/night/:id/proposals", async (c) => {
    const password = c.req.query("password") ?? "";
    const context = await loadAuthorizedNight(
      c,
      dataDirectory,
      c.req.param("id"),
      password,
    );
    if (context instanceof Response) {
      return context;
    }
    const { loaded, night } = context;
    const all = await loadProposals(dataDirectory);
    const open = all.proposals.filter((item) => item.gameNight === night.id);
    const today = todayInTimezone(loaded.config.site.timezone);
    return c.html(
      <NightProposalsPage
        config={loaded.config}
        night={night}
        proposals={open}
        today={today}
        {...(password ? { password } : {})}
      />,
    );
  });

  app.post("/proposals/:proposalId/vote", async (c) => {
    const body = await c.req.parseBody();
    const limited = rateLimited(c, voteThrottle);
    if (limited) {
      return limited;
    }
    const proposals = await loadProposals(dataDirectory);
    const proposal = proposals.proposals.find(
      (item) => item.id === c.req.param("proposalId"),
    );
    if (!proposal) {
      return notFound(c);
    }
    const password = stringField(body.password);
    const context = await loadAuthorizedNight(
      c,
      dataDirectory,
      proposal.gameNight,
      password,
    );
    if (context instanceof Response) {
      return context;
    }
    const { night } = context;
    const vote = voteValue(body.vote);
    if (vote === undefined) {
      return c.text("Invalid vote", 400);
    }
    try {
      await castVote(dataDirectory, {
        proposalId: proposal.id,
        person: stringField(body.person),
        date: stringField(body.date),
        vote,
      });
    } catch (error) {
      if (!(error instanceof ConfigError)) {
        throw error;
      }
      return c.text(error.message, 400);
    }
    // Fetch callers get a bodyless 204 so the page stays put; forms redirect.
    if (c.req.header("x-requested-with") === "fetch") {
      return c.body(null, 204);
    }
    return c.redirect(
      withSharePassword(`/night/${night.id}/proposals`, password),
      303,
    );
  });

  return app;
}
