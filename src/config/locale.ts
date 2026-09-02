export const DEFAULT_LOCALE = "nl-NL";

export function configuredLocale(
  value: string | undefined = process.env.LOCALE,
): string {
  const locale = value?.trim() || DEFAULT_LOCALE;
  try {
    if (Intl.DateTimeFormat.supportedLocalesOf([locale]).length > 0) {
      return locale;
    }
  } catch {
    // Fall through to the same configuration error as unsupported locales.
  }
  throw new Error(`Invalid locale: ${locale}`);
}
