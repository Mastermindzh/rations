import type { FC, PropsWithChildren } from "hono/jsx";
import { configuredLocale } from "../config/locale.js";
import { appScriptUrl, appStyleUrl } from "./assets.js";

type LayoutProps = PropsWithChildren<{
  title: string;
  siteTitle?: string;
  admin?: boolean;
  csrfToken?: string;
  scripts?: boolean;
  showHeader?: boolean;
  mainClass?: string;
}>;

export const Layout: FC<LayoutProps> = ({
  title,
  siteTitle = "Rations",
  admin,
  csrfToken,
  scripts,
  showHeader = true,
  mainClass,
  children,
}) => (
  <html lang={configuredLocale()}>
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <meta name="theme-color" content="#10131a" />
      <title>{title === siteTitle ? title : `${title} · ${siteTitle}`}</title>
      <link rel="icon" href="/public/favicon.ico" sizes="any" />
      <link
        rel="icon"
        type="image/png"
        sizes="32x32"
        href="/public/favicon-32x32.png"
      />
      <link
        rel="apple-touch-icon"
        sizes="180x180"
        href="/public/apple-touch-icon.png"
      />
      <link rel="stylesheet" href={appStyleUrl} />
      {scripts ? <script src={appScriptUrl} defer></script> : null}
    </head>
    <body>
      <div class="ambient ambient-one" aria-hidden="true"></div>
      <div class="ambient ambient-two" aria-hidden="true"></div>
      {showHeader ? (
        <header class="site-header">
          <a class="brand" href="/" aria-label={`${siteTitle} home`}>
            <img
              class="brand-logo"
              src="/public/logo-64.png"
              width="44"
              height="44"
              alt=""
            />
            <span>{siteTitle}</span>
          </a>
          {admin ? (
            <nav class="header-actions" aria-label="Admin actions">
              <a class="admin-link" href="/admin">
                Admin
              </a>
              {csrfToken ? (
                <form method="post" action="/admin/logout">
                  <input type="hidden" name="csrfToken" value={csrfToken} />
                  <button class="header-action" type="submit">
                    Log out
                  </button>
                </form>
              ) : null}
            </nav>
          ) : null}
        </header>
      ) : null}
      <main class={`page-shell${mainClass ? ` ${mainClass}` : ""}`}>
        {children}
      </main>
    </body>
  </html>
);
