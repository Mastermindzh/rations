import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach } from "vitest";
import type { AppConfig } from "../src/config/types.js";
import { fixtureConfig, fixtureYaml } from "./fixtures.js";

const directories: string[] = [];

afterEach(async () => {
  await Promise.all(
    directories
      .splice(0)
      .map((directory) => rm(directory, { recursive: true, force: true })),
  );
});

export async function createTestWorkspace(
  prefix: string,
  config: AppConfig = fixtureConfig(),
): Promise<string> {
  const directory = await mkdtemp(join(tmpdir(), prefix));
  directories.push(directory);
  await mkdir(join(directory, "images"));
  await writeFile(join(directory, "config.yml"), fixtureYaml(config));
  return directory;
}
