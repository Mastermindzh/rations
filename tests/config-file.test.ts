import {
  access,
  mkdir,
  mkdtemp,
  readFile,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
  loadConfig,
  readConfigFile,
  saveConfigFile,
} from "../src/config/file.js";
import { ConfigError } from "../src/config/config-error.js";
import { fixtureConfig, fixtureYaml } from "./fixtures.js";

const directories: string[] = [];
async function setup() {
  const directory = await mkdtemp(join(tmpdir(), "rations-test-"));
  directories.push(directory);
  await mkdir(join(directory, "images"));
  await writeFile(join(directory, "config.yml"), fixtureYaml());
  return directory;
}

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

describe("configuration file", () => {
  it("saves valid YAML without creating extra persistent files", async () => {
    const directory = await setup();
    const loaded = await loadConfig(directory);
    const changed = fixtureConfig();
    changed.site.title = "Changed";
    const saved = await saveConfigFile(
      directory,
      fixtureYaml(changed),
      loaded.version,
    );
    expect(saved.config.site.title).toBe("Changed");
    await expect(
      access(join(directory, "config.yml.backup")),
    ).rejects.toThrow();
  });

  it("never replaces the config with invalid YAML or invalid data", async () => {
    const directory = await setup();
    const loaded = await loadConfig(directory);
    await expect(
      saveConfigFile(directory, "site: [", loaded.version),
    ).rejects.toBeInstanceOf(ConfigError);
    const invalid = fixtureConfig();
    invalid.gameNights[0]!.people = [];
    await expect(
      saveConfigFile(directory, fixtureYaml(invalid), loaded.version),
    ).rejects.toBeInstanceOf(ConfigError);
    expect(await readFile(join(directory, "config.yml"), "utf8")).toBe(
      loaded.rawYaml,
    );
  });

  it("rejects stale versions and serializes concurrent writes", async () => {
    const directory = await setup();
    const loaded = await loadConfig(directory);
    const one = fixtureConfig();
    one.site.title = "One";
    const two = fixtureConfig();
    two.site.title = "Two";
    const results = await Promise.allSettled([
      saveConfigFile(directory, fixtureYaml(one), loaded.version),
      saveConfigFile(directory, fixtureYaml(two), loaded.version),
    ]);
    expect(
      results.filter((result) => result.status === "fulfilled"),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toBeInstanceOf(
      ConfigError,
    );
  });

  it("replaces an externally invalid active file with a valid edit", async () => {
    const directory = await setup();
    await writeFile(join(directory, "config.yml"), "externally: broken");
    const invalid = await readConfigFile(directory);
    const repaired = fixtureConfig();
    repaired.site.title = "Repaired";
    const saved = await saveConfigFile(
      directory,
      fixtureYaml(repaired),
      invalid.version,
    );
    expect(saved.config.site.title).toBe("Repaired");
  });
});
