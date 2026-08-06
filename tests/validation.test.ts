import { describe, expect, it } from "vitest";
import { validateConfig } from "../src/config/validation.js";
import { fixtureConfig } from "./fixtures.js";

function messages(config: unknown): string {
  const result = validateConfig(config);
  return result.success
    ? ""
    : result.errors
        .map((error) => `${error.path}: ${error.message}`)
        .join("\n");
}

describe("configuration validation", () => {
  it("allows an empty or omitted password for the list view", () => {
    const config = fixtureConfig();
    config.site.password = "";
    expect(messages(config)).toBe("");
    delete config.site.password;
    expect(messages(config)).toBe("");
  });

  it("allows an empty or omitted password for a game night", () => {
    const config = fixtureConfig();
    config.gameNights[0]!.password = "";
    expect(messages(config)).toBe("");
    delete config.gameNights[0]!.password;
    expect(messages(config)).toBe("");
  });

  it("rejects an invalid administrator password hash", () => {
    const config = fixtureConfig();
    config.admin.passwordHash = "plaintext-password";
    expect(messages(config)).toContain("scrypt hash");
  });

  it("rejects duplicate game-night IDs", () => {
    const config = fixtureConfig();
    config.gameNights[1]!.id = config.gameNights[0]!.id;
    expect(messages(config)).toContain("Duplicate game-night ID");
  });

  it("rejects missing people and empty rotations", () => {
    const missing = fixtureConfig();
    missing.gameNights[0]!.people = ["missing"];
    expect(messages(missing)).toContain("Unknown person");
    const empty = fixtureConfig();
    empty.gameNights[0]!.people = [];
    expect(messages(empty)).toContain("at least one person");
  });

  it("rejects duplicate people within a rotation", () => {
    const config = fixtureConfig();
    config.gameNights[0]!.people = ["rick", "rick"];
    expect(messages(config)).toContain("Duplicate person");
  });

  it.each([
    "../rick.webp",
    "/rick.webp",
    "folder/rick.png",
    "rick.svg",
    "rick\\photo.jpg",
  ])("rejects the unsafe image path %s", (image) => {
    const config = fixtureConfig();
    config.people.rick!.image = image;
    expect(messages(config)).toContain("Must be a filename");
  });

  it("rejects an invalid timezone", () => {
    const config = fixtureConfig();
    config.site.timezone = "Moon/Sea-of-Tranquility";
    expect(messages(config)).toContain("valid IANA timezone");
  });

  it("rejects misaligned and pre-anchor overrides", () => {
    const config = fixtureConfig();
    config.overrides = [
      { gameNight: "friday-dnd", date: "2026-07-20", person: "rick" },
    ];
    expect(messages(config)).toContain("does not align");
    config.overrides[0]!.date = "2026-07-10";
    expect(messages(config)).toContain("does not align");
  });

  it("rejects duplicate overrides", () => {
    const config = fixtureConfig();
    config.overrides = [
      { gameNight: "friday-dnd", date: "2026-07-17", person: "rick" },
      { gameNight: "friday-dnd", date: "2026-07-17", person: "alice" },
    ];
    expect(messages(config)).toContain("Only one override");
  });

  it("rejects overrides for people outside the game night", () => {
    const config = fixtureConfig();
    config.overrides = [
      { gameNight: "friday-dnd", date: "2026-07-17", person: "charlie" },
    ];
    expect(messages(config)).toContain("does not belong");
  });

  it("accepts a date override for a scheduled game night", () => {
    const config = fixtureConfig();
    config.dateOverrides = [
      {
        gameNight: "friday-dnd",
        oldDate: "2026-07-24",
        newDate: "2026-07-26",
      },
    ];
    expect(messages(config)).toBe("");
  });

  it("rejects invalid and duplicate date overrides", () => {
    const config = fixtureConfig();
    config.dateOverrides = [
      {
        gameNight: "friday-dnd",
        oldDate: "2026-07-20",
        newDate: "2026-07-26",
      },
    ];
    expect(messages(config)).toContain("does not align");

    config.dateOverrides = [
      { gameNight: "friday-dnd", oldDate: "2026-07-24", newDate: "2026-07-26" },
      { gameNight: "friday-dnd", oldDate: "2026-07-24", newDate: "2026-07-27" },
    ];
    expect(messages(config)).toContain("Only one date override");
  });

  it("rejects unchanged or conflicting moved dates", () => {
    const unchanged = fixtureConfig();
    unchanged.dateOverrides = [
      {
        gameNight: "friday-dnd",
        oldDate: "2026-07-24",
        newDate: "2026-07-24",
      },
    ];
    expect(messages(unchanged)).toContain("must differ");

    const conflict = fixtureConfig();
    conflict.dateOverrides = [
      {
        gameNight: "friday-dnd",
        oldDate: "2026-07-24",
        newDate: "2026-07-31",
      },
    ];
    expect(messages(conflict)).toContain("conflicts with another scheduled");
  });

  it("rejects impossible calendar dates", () => {
    const config = fixtureConfig();
    config.gameNights[0]!.anchorDate = "2026-02-30";
    expect(messages(config)).toContain("real ISO calendar date");
  });

  it("accepts an extra day on a free date", () => {
    const config = fixtureConfig();
    config.extraDays = [{ gameNight: "friday-dnd", date: "2026-07-20" }];
    expect(messages(config)).toBe("");
  });

  it("rejects an extra day for an unknown game night", () => {
    const config = fixtureConfig();
    config.extraDays = [{ gameNight: "missing", date: "2026-07-20" }];
    expect(messages(config)).toContain("Unknown game night");
  });

  it("rejects an extra day that lands on a scheduled night", () => {
    const config = fixtureConfig();
    config.extraDays = [{ gameNight: "friday-dnd", date: "2026-07-24" }];
    expect(messages(config)).toContain("already has a scheduled");
  });

  it("rejects duplicate extra days", () => {
    const config = fixtureConfig();
    config.extraDays = [
      { gameNight: "friday-dnd", date: "2026-07-20" },
      { gameNight: "friday-dnd", date: "2026-07-20" },
    ];
    expect(messages(config)).toContain("Only one extra day");
  });
});
