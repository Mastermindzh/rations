export type SiteConfig = {
  title: string;
  password?: string;
  timezone: string;
};

export type AdminConfig = {
  passwordHash: string;
};

export type PersonConfig = {
  name: string;
  image?: string;
};

export type GameNightConfig = {
  id: string;
  name: string;
  password?: string;
  description?: string;
  anchorDate: string;
  intervalDays: number;
  people: string[];
};

export type OverrideConfig = {
  gameNight: string;
  date: string;
  person: string;
  reason?: string;
};

export type DateOverrideConfig = {
  gameNight: string;
  oldDate: string;
  newDate: string;
};

export type AppConfig = {
  site: SiteConfig;
  admin: AdminConfig;
  people: Record<string, PersonConfig>;
  gameNights: GameNightConfig[];
  overrides: OverrideConfig[];
  dateOverrides: DateOverrideConfig[];
};

export type ValidationIssue = {
  path: string;
  message: string;
};

export type ValidationResult =
  | { success: true; config: AppConfig; normalizedYaml: string }
  | { success: false; errors: ValidationIssue[] };

export type LoadedConfig = {
  config: AppConfig;
  rawYaml: string;
  version: string;
  modifiedAt: Date;
};

export type RawConfigFile = Omit<LoadedConfig, "config">;
