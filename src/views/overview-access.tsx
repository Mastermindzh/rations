import type { AppConfig } from "../config/types.js";
import { Layout } from "./layout.js";
import { PasswordAccessCard } from "./password-access.js";

type OverviewAccessPageProps = {
  config: AppConfig;
  error?: string;
};

export const OverviewAccessPage = ({
  config,
  error,
}: OverviewAccessPageProps) => (
  <Layout
    title={config.site.title}
    siteTitle={config.site.title}
    showHeader={false}
  >
    <PasswordAccessCard
      title={config.site.title}
      description="Enter the list password to see all game nights."
      action="/"
      inputId="list-password"
      {...(error ? { error } : {})}
    />
  </Layout>
);
