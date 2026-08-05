import { Layout } from "./layout.js";

export const ErrorPage = ({
  title,
  message,
  details = [],
  status = 500,
  admin = false,
  csrfToken,
}: {
  title: string;
  message: string;
  details?: string[];
  status?: number;
  admin?: boolean;
  csrfToken?: string;
}) => (
  <Layout title={title} admin={admin} {...(csrfToken ? { csrfToken } : {})}>
    <section class="error-card">
      <span class="error-code">{status}</span>
      <h1>{title}</h1>
      <p>{message}</p>
      {details.length ? (
        <ul class="validation-list">
          {details.map((detail) => (
            <li>{detail}</li>
          ))}
        </ul>
      ) : null}
      <a class="button" href={admin ? "/admin" : "/"}>
        Go back
      </a>
    </section>
  </Layout>
);
