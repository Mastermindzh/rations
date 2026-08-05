/**
 * Error raised anywhere in the configuration layer (loading, saving, or
 * applying changes). `code` classifies the failure so routes can map it to an
 * HTTP status (e.g. STALE_VERSION -> 409), and `details` carries human-readable
 * validation messages for display.
 */
export class ConfigError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly details: string[] = [],
  ) {
    super(message);
  }
}
