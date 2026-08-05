import type { AppConfig } from "../config/types.js";
import { Layout } from "./layout.js";

export const OverviewAccessPage = ({
  config,
  error,
}: {
  config: AppConfig;
  error?: string;
}) => (
  <Layout
    title={config.site.title}
    siteTitle={config.site.title}
    showHeader={false}
  >
    <section class="auth-card">
      <img
        class="login-logo"
        src="/public/logo-192.png"
        width="128"
        height="128"
        alt=""
      />
      <h1>{config.site.title}</h1>
      <p>Enter the list password to see all game nights.</p>
      {error ? (
        <div class="notice notice-error" role="alert">
          {error}
        </div>
      ) : null}
      <form method="get" action="/" class="stack-form">
        <label for="list-password">Password</label>
        <input
          id="list-password"
          name="password"
          type="password"
          required
          autocomplete="off"
          autofocus
        />
        <button class="button button-accent" type="submit">
          Continue
        </button>
      </form>
      <a class="admin-login-link" href="/admin/login">
        Admin login
      </a>
    </section>
  </Layout>
);
