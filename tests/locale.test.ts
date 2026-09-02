import { describe, expect, it } from "vitest";
import {
  configuredLocale,
  DEFAULT_LOCALE,
} from "../src/config/locale.js";
import { formatTurnDate } from "../src/views/shared.js";

describe("locale configuration", () => {
  it("uses the application default when the environment value is empty", () => {
    expect(configuredLocale("")).toBe(DEFAULT_LOCALE);
  });

  it("accepts supported BCP 47 locales", () => {
    expect(configuredLocale("nl-NL")).toBe("nl-NL");
    expect(configuredLocale("de-DE")).toBe("de-DE");
  });

  it("uses the configured locale and capitalizes by default", () => {
    expect(
      formatTurnDate("2026-07-17", "Europe/Amsterdam", true, true, "nl-NL"),
    ).toBe("Vrijdag 17 juli");
  });

  it("can preserve the locale's lowercase weekday", () => {
    expect(
      formatTurnDate("2026-07-17", "Europe/Amsterdam", true, false, "nl-NL"),
    ).toBe("vrijdag 17 juli");
  });

  it("rejects unsupported locales", () => {
    expect(() => configuredLocale("not_a_locale")).toThrow("Invalid locale");
  });
});
