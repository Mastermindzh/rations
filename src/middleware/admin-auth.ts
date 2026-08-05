import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.js";
import { readSession } from "../auth/session.js";

export const identifyAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await readSession(c);
  c.set("isAdmin", Boolean(session));
  if (session) c.set("csrfToken", session.csrfToken);
  await next();
};

export const requireAdmin: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await readSession(c);
  if (!session) return c.redirect("/admin/login", 303);
  c.set("isAdmin", true);
  c.set("csrfToken", session.csrfToken);
  await next();
};

export const requireCsrf: MiddlewareHandler<AppEnv> = async (c, next) => {
  const session = await readSession(c);
  if (!session) return c.redirect("/admin/login", 303);
  const contentType = c.req.header("content-type") ?? "";
  if (
    !contentType.includes("application/x-www-form-urlencoded") &&
    !contentType.includes("multipart/form-data")
  ) {
    return c.text("Unsupported request type", 415);
  }
  const body = await c.req.parseBody();
  if (
    typeof body.csrfToken !== "string" ||
    body.csrfToken !== session.csrfToken
  ) {
    return c.text("Invalid CSRF token", 403);
  }
  c.set("isAdmin", true);
  c.set("csrfToken", session.csrfToken);
  await next();
};
