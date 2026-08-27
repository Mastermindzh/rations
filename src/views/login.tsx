import { Layout } from "./layout.js";
import { ErrorNotice } from "./notice-banner.js";

type LoginPageProps = {
  error?: string;
};

export const LoginPage = ({ error }: LoginPageProps) => (
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
      <ErrorNotice message={error} />
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
