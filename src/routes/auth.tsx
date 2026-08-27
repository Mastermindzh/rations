import { Hono } from "hono";
import type { AppEnv } from "../env.js";
import { createSession, clearSession } from "../auth/session.js";
import { verifyPassword } from "../auth/password.js";
import { LoginPage } from "../views/login.js";
import { loadConfig } from "../config/file.js";
import { clientIp, createLoginThrottle } from "../services/login-throttle.js";
import { stringField } from "./form-fields.js";

export function authRoutes(dataDirectory: string): Hono<AppEnv> {
  const app = new Hono<AppEnv>();
  const throttle = createLoginThrottle();

  app.get("/admin/login", async (c) => {
    if (c.get("isAdmin")) {
      return c.redirect("/admin", 303);
    }
    return c.html(<LoginPage />);
  });

  app.post("/admin/login", async (c) => {
    const ip = clientIp(
      c.req.header("x-forwarded-for") ?? c.req.header("x-real-ip"),
    );
    if (throttle.isBlocked(ip)) {
      return c.html(
        <LoginPage error="Too many failed attempts. Try again later." />,
        429,
      );
    }
    const body = await c.req.parseBody();
    const password = stringField(body.password);
    const configuredHash = (await loadConfig(dataDirectory)).config.admin
      .passwordHash;
    const valid =
      configuredHash.length > 0 &&
      (await verifyPassword(password, configuredHash));
    if (!valid) {
      throttle.recordFailure(ip);
      return c.html(<LoginPage error="The password was not accepted." />, 401);
    }
    throttle.reset(ip);
    await createSession(c);
    return c.redirect("/admin", 303);
  });

  app.post("/admin/logout", (c) => {
    clearSession(c);
    return c.redirect("/", 303);
  });
  return app;
}
