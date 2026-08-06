import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { bodyLimit } from "hono/body-limit";
import type { AppEnv } from "./env.js";
import { configuredDataDirectory } from "./config/file.js";
import { ConfigError } from "./config/config-error.js";
import {
  identifyAdmin,
  requireAdmin,
  requireCsrf,
} from "./middleware/admin-auth.js";
import { securityHeaders } from "./middleware/security.js";
import { publicRoutes } from "./routes/public.js";
import { authRoutes } from "./routes/auth.js";
import { adminRoutes } from "./routes/admin.js";
import { healthRoutes } from "./routes/health.js";
import { imageRoutes } from "./routes/images.js";
import { ErrorPage } from "./views/error-page.js";

export function createApp(dataDirectory = configuredDataDirectory()) {
  const app = new Hono<AppEnv>();

  app.use("*", securityHeaders);
  app.use("*", identifyAdmin);
  app.use(
    "/admin/login",
    bodyLimit({
      maxSize: 16 * 1024,
      onError: (c) => c.text("Request body too large", 413),
    }),
  );
  app.use(
    "/admin/*",
    bodyLimit({
      maxSize: 512 * 1024,
      onError: (c) => c.text("Request body too large", 413),
    }),
  );
  app.use("/admin", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });
  app.use("/admin/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });
  app.use("/admin", requireAdmin);
  app.use("/admin/*", async (c, next) => {
    if (c.req.path === "/admin/login") return next();
    return c.req.method === "GET"
      ? requireAdmin(c, next)
      : requireCsrf(c, next);
  });
  app.use("/styles/*", async (c, next) => {
    await next();
    c.header(
      "Cache-Control",
      "public, max-age=3600, stale-while-revalidate=86400",
    );
  });
  app.use("/public/*", async (c, next) => {
    await next();
    c.header(
      "Cache-Control",
      "public, max-age=86400, stale-while-revalidate=604800",
    );
  });
  app.use("/night/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "private, no-store");
  });
  app.get("/styles/*", serveStatic({ root: "./src" }));
  app.get("/public/*", serveStatic({ root: "./" }));
  app.route("/", imageRoutes(dataDirectory));
  app.route("/", healthRoutes(dataDirectory));
  app.route("/", authRoutes(dataDirectory));
  app.route("/", adminRoutes(dataDirectory));
  app.route("/", publicRoutes(dataDirectory));

  app.notFound((c) => {
    const csrfToken = c.get("csrfToken");
    return c.html(
      <ErrorPage
        title="Page not found"
        message="That page wandered off on an adventure."
        status={404}
        admin={c.get("isAdmin")}
        {...(csrfToken ? { csrfToken } : {})}
      />,
      404,
    );
  });
  app.onError((error, c) => {
    console.error("Request failed:", error);
    const unavailable =
      error instanceof ConfigError && error.code === "INVALID_CONFIG";
    const admin = c.get("isAdmin");
    const csrfToken = c.get("csrfToken");
    return c.html(
      <ErrorPage
        title={
          unavailable
            ? "Rations is temporarily unavailable"
            : "Something went wrong"
        }
        message={
          unavailable
            ? "The schedule configuration needs attention. An administrator can inspect the details."
            : "The request could not be completed. Please try again."
        }
        details={admin && error instanceof ConfigError ? error.details : []}
        status={unavailable ? 503 : 500}
        admin={admin}
        {...(csrfToken ? { csrfToken } : {})}
      />,
      unavailable ? 503 : 500,
    );
  });
  return app;
}

const isMain =
  process.argv[1] &&
  import.meta.url === new URL(`file://${process.argv[1]}`).href;
if (isMain) {
  const port = Number(process.env.PORT ?? 3000);
  // Dual-stack: `::` accepts both IPv6 and IPv4 so `localhost` resolves either way.
  serve({ fetch: createApp().fetch, port, hostname: "::" }, (info) => {
    console.log(`Rations listening on port ${info.port}`);
  });
}
