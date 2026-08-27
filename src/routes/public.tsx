import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { loadConfig } from "../config/file.js";
import { todayInTimezone } from "../schedule/calendar-date.js";
import { resolveNightSchedule } from "../schedule/resolve-turn.js";
import { buildOverviewEntries } from "../queries/overview.js";
import { shareAccessGranted } from "../services/share-access.js";
import { loadProposals } from "../proposals/store.js";
import { OverviewPage } from "../views/overview.js";
import { GameNightPage } from "../views/game-night.js";
import { ErrorPage } from "../views/error-page.js";
import { GameNightAccessPage } from "../views/game-night-access.js";
import { OverviewAccessPage } from "../views/overview-access.js";

export function publicRoutes(dataDirectory: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const loaded = await loadConfig(dataDirectory);
    c.header("Cache-Control", "private, no-store");
    const submittedPassword = c.req.query("password") ?? "";
    if (
      !shareAccessGranted(
        c.get("isAdmin"),
        loaded.config.site.password,
        submittedPassword,
      )
    ) {
      return c.html(
        <OverviewAccessPage
          config={loaded.config}
          {...(submittedPassword
            ? { error: "That password is not correct." }
            : {})}
        />,
        401,
      );
    }
    const today = todayInTimezone(loaded.config.site.timezone);
    const entries = buildOverviewEntries(loaded.config, today);
    const proposalCounts = await openProposalCounts(dataDirectory);
    const csrfToken = c.get("csrfToken");
    return c.html(
      <OverviewPage
        config={loaded.config}
        entries={entries}
        admin={c.get("isAdmin")}
        proposalCounts={proposalCounts}
        {...(csrfToken ? { csrfToken } : {})}
      />,
    );
  });

  app.get("/night/:id", async (c) => {
    const id = c.req.param("id");
    const loaded = await loadConfig(dataDirectory);
    const night = loaded.config.gameNights.find((item) => item.id === id);
    if (!night) {
      const csrfToken = c.get("csrfToken");
      return c.html(
        <ErrorPage
          title="Game night not found"
          message="That gathering is not in the current schedule."
          status={404}
          admin={c.get("isAdmin")}
          {...(csrfToken ? { csrfToken } : {})}
        />,
        404,
      );
    }
    const submittedPassword = c.req.query("password") ?? "";
    if (
      !shareAccessGranted(c.get("isAdmin"), night.password, submittedPassword)
    ) {
      return c.html(
        <GameNightAccessPage
          config={loaded.config}
          night={night}
          {...(submittedPassword
            ? { error: "That password is not correct." }
            : {})}
        />,
        401,
      );
    }
    const today = todayInTimezone(loaded.config.site.timezone);
    const schedule = resolveNightSchedule(loaded.config, night, today);
    const openProposals = (await loadProposals(dataDirectory)).proposals.filter(
      (item) => item.gameNight === night.id,
    );
    const csrfToken = c.get("csrfToken");
    const pageProps = {
      config: loaded.config,
      night,
      schedule,
      admin: c.get("isAdmin"),
      openProposals,
      ...(csrfToken ? { csrfToken } : {}),
      ...(submittedPassword ? { password: submittedPassword } : {}),
    };
    return c.html(<GameNightPage {...pageProps} />);
  });

  return app;
}

// Counts open proposals per game-night id (empty on any read failure).
async function openProposalCounts(
  dataDirectory: string,
): Promise<Record<string, number>> {
  const { proposals } = await loadProposals(dataDirectory);
  const counts: Record<string, number> = {};
  for (const proposal of proposals) {
    counts[proposal.gameNight] = (counts[proposal.gameNight] ?? 0) + 1;
  }
  return counts;
}
