import { ErrorNotice } from "./notice-banner.js";

type PasswordAccessCardProps = {
  title: string;
  description: string;
  action: string;
  inputId: string;
  error?: string;
};

export const PasswordAccessCard = ({
  title,
  description,
  action,
  inputId,
  error,
}: PasswordAccessCardProps) => (
  <section class="auth-card">
    <img
      class="login-logo"
      src="/public/logo-192.png"
      width="128"
      height="128"
      alt=""
    />
    <h1>{title}</h1>
    <p>{description}</p>
    <ErrorNotice message={error} />
    <form method="get" action={action} class="stack-form">
      <label for={inputId}>Password</label>
      <input
        id={inputId}
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
);
