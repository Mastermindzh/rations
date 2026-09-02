import type { MiddlewareHandler } from "hono";
import type { AppEnv } from "../env.js";

export const securityHeaders: MiddlewareHandler<AppEnv> = async (c, next) => {
  await next();
  c.header("X-Content-Type-Options", "nosniff");
  c.header("X-Frame-Options", "DENY");
  c.header("Referrer-Policy", "no-referrer");
  c.header("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  c.header(
    "Content-Security-Policy",
    "default-src 'self'; style-src 'self'; script-src 'self'; img-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'",
  );
  if (process.env.NODE_ENV === "production") {
    c.header(
      "Strict-Transport-Security",
      "max-age=31536000; includeSubDomains",
    );
  }
};
