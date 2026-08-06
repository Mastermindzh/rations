import type { AppConfig } from "../src/config/types.js";
import { stringify } from "yaml";

export function fixtureConfig(): AppConfig {
  return {
    site: {
      title: "Snack Duty",
      password: "list-secret",
      timezone: "Europe/Amsterdam",
    },
    admin: {
      passwordHash:
        "scrypt$16384$8$1$ZPeI0rNhG0nr-4OJtJnmBQ$tntXofo5n-5JGK23yOgFimNqQaO9YBzjoJU2oz3kDNJXO3bGrVC6nDQOeqorfTbeuTeqoIF0zuT8vJBjnyvbVg",
    },
    people: {
      rick: { name: "Rick", image: "rick.webp" },
      alice: { name: "Alice", image: "alice.png" },
      bob: { name: "Bob" },
      charlie: { name: "Charlie" },
    },
    gameNights: [
      {
        id: "friday-dnd",
        name: "Friday D&D",
        password: "dnd-secret",
        anchorDate: "2026-07-17",
        intervalDays: 7,
        people: ["rick", "alice", "bob"],
      },
      {
        id: "saturday-games",
        name: "Saturday Games",
        password: "games-secret",
        anchorDate: "2026-07-18",
        intervalDays: 14,
        people: ["charlie", "rick"],
      },
    ],
    overrides: [],
    dateOverrides: [],
    extraDays: [],
  };
}

export function fixtureYaml(config = fixtureConfig()): string {
  return stringify(config);
}
