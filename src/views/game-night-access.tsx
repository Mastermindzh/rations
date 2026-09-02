import type { AppConfig, GameNightConfig } from "../config/types.js";
import { Layout } from "./layout.js";
import { PasswordAccessCard } from "./password-access.js";

type GameNightAccessPageProps = {
  config: AppConfig;
  night: GameNightConfig;
  error?: string;
};

export const GameNightAccessPage = ({
  config,
  night,
  error,
}: GameNightAccessPageProps) => (
  <Layout title={night.name} siteTitle={config.site.title} showHeader={false}>
    <PasswordAccessCard
      title={night.name}
      description="Enter the game-night password to see who brings the snacks."
      action={`/night/${encodeURIComponent(night.id)}`}
      inputId="game-password"
      {...(error ? { error } : {})}
    />
  </Layout>
);
