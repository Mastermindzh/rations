import { Layout } from "./layout.js";

export const LoginPage = ({ error }: { error?: string }) => (
  <Layout title="Admin login" showHeader={false}>
    <section class="auth-card">
      <img
        class="login-logo"
        src="/public/logo-192.png"
        width="128"
        height="128"
        alt=""
      />
      <span class="eyebrow">Keeper of the snacks</span>
      <h1>Admin login</h1>
      <p>Sign in to change the rotation or edit the configuration.</p>
      {error ? (
        <div class="notice notice-error" role="alert">
          {error}
        </div>
      ) : null}
      <form method="post" action="/admin/login" class="stack-form">
        <label for="password">Password</label>
        <input
          id="password"
          name="password"
          type="password"
          required
          autocomplete="current-password"
          autofocus
        />
        <button class="button button-accent" type="submit">
          Sign in
        </button>
      </form>
    </section>
  </Layout>
);
