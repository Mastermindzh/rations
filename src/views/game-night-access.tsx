import type { AppConfig, GameNightConfig } from "../config/types.js";
import { Layout } from "./layout.js";

export const GameNightAccessPage = ({
  config,
  night,
  error,
}: {
  config: AppConfig;
  night: GameNightConfig;
  error?: string;
}) => (
  <Layout title={night.name} siteTitle={config.site.title} showHeader={false}>
    <section class="auth-card">
      <img
        class="login-logo"
        src="/public/logo-192.png"
        width="128"
        height="128"
        alt=""
      />
      <h1>{night.name}</h1>
      <p>Enter the game-night password to see who brings the snacks.</p>
      {error ? (
        <div class="notice notice-error" role="alert">
          {error}
        </div>
      ) : null}
      <form
        method="get"
        action={`/night/${encodeURIComponent(night.id)}`}
        class="stack-form"
      >
        <label for="game-password">Password</label>
        <input
          id="game-password"
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
