import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { loadConfig } from "../config/file.js";

export function healthRoutes(dataDirectory: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  app.get("/health", async (c) => {
    try {
      await loadConfig(dataDirectory);
      return c.json({ status: "ok" });
    } catch {
      return c.json(
        { status: "error", reason: "configuration_unavailable" },
        503,
      );
    }
  });
  return app;
}
