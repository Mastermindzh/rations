import type { Context } from "hono";
import type { AppEnv } from "../env.js";
import { ConfigError } from "../config/config-error.js";
import { ErrorPage } from "../views/error-page.js";

// Renders a ConfigError as a styled admin error page; rethrows anything else.
export function renderConfigError(
  c: Context<AppEnv>,
  title: string,
  error: unknown,
): Response | Promise<Response> {
  if (!(error instanceof ConfigError)) throw error;
  const status = error.code === "STALE_VERSION" ? 409 : 400;
  return c.html(
    <ErrorPage
      title={title}
      message={error.message}
      details={error.details}
      status={status}
      admin
      csrfToken={c.get("csrfToken") ?? ""}
    />,
    status,
  );
}
