import { createHash } from "node:crypto";
import { mkdir, open, readFile, rename, stat, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { stringify } from "yaml";
import { parseAndValidateYaml } from "./yaml.js";
import { ConfigError } from "./config-error.js";
import type {
  AppConfig,
  LoadedConfig,
  RawConfigFile,
  ValidationResult,
} from "./types.js";

let writeQueue: Promise<void> = Promise.resolve();

/** Resolves the data directory from DATA_DIRECTORY, falling back to ./data. */
export function configuredDataDirectory(): string {
  return process.env.DATA_DIRECTORY ?? join(process.cwd(), "data");
}

/** Parses and validates raw YAML in memory without touching disk. */
export function validateConfigYaml(rawYaml: string): ValidationResult {
  return parseAndValidateYaml(rawYaml);
}

/** Reads config.yml and derives a content-hash version; does not validate. */
export async function readConfigFile(
  dataDirectory = configuredDataDirectory(),
): Promise<RawConfigFile> {
  const configPath = join(dataDirectory, "config.yml");
  const [rawYaml, fileStat] = await Promise.all([
    readFile(configPath, "utf8"),
    stat(configPath),
  ]);
  return {
    rawYaml,
    version: createHash("sha256").update(rawYaml).digest("hex"),
    modifiedAt: fileStat.mtime,
  };
}

/** Reads and validates config.yml; throws ConfigError(INVALID_CONFIG) if invalid. */
export async function loadConfig(
  dataDirectory = configuredDataDirectory(),
): Promise<LoadedConfig> {
  const raw = await readConfigFile(dataDirectory);
  const validated = validateConfigYaml(raw.rawYaml);
  if (!validated.success) {
    throw new ConfigError(
      "The active configuration is invalid",
      "INVALID_CONFIG",
      validated.errors.map((error) => `${error.path}: ${error.message}`),
    );
  }
  return { ...raw, config: validated.config };
}

/**
 * Atomically saves raw YAML after checking it against the expected version.
 * Throws ConfigError(STALE_VERSION) if the file changed underneath, or
 * ConfigError(INVALID_CONFIG) if the submitted YAML fails validation.
 */
export async function saveConfigFile(
  dataDirectory: string,
  rawYaml: string,
  expectedVersion: string,
): Promise<LoadedConfig> {
  return withWriteLock(async () => {
    const current = await readConfigFile(dataDirectory);
    assertVersion(current.version, expectedVersion);
    const validated = validateConfigYaml(rawYaml);
    if (!validated.success) {
      throw new ConfigError(
        "Configuration validation failed",
        "INVALID_CONFIG",
        validated.errors.map((error) => `${error.path}: ${error.message}`),
      );
    }
    return atomicReplace(dataDirectory, validated.normalizedYaml);
  });
}

/**
 * Applies a mutation to the current config under the write lock, validating the
 * result before an atomic save. The change receives a clone, so callers may
 * mutate it freely. Throws ConfigError on a stale version or invalid result.
 */
export async function changeConfig(
  dataDirectory: string,
  expectedVersion: string,
  change: (config: AppConfig) => AppConfig | Promise<AppConfig>,
): Promise<LoadedConfig> {
  return withWriteLock(async () => {
    const current = await loadConfig(dataDirectory);
    assertVersion(current.version, expectedVersion);
    const proposed = await change(structuredClone(current.config));
    const validated = validateConfigYaml(stringify(proposed, { lineWidth: 0 }));
    if (!validated.success) {
      throw new ConfigError(
        "Updated configuration is invalid",
        "INVALID_CONFIG",
        validated.errors.map((error) => `${error.path}: ${error.message}`),
      );
    }
    return atomicReplace(dataDirectory, validated.normalizedYaml);
  });
}

/** Guards optimistic concurrency: rejects empty or mismatched versions. */
function assertVersion(actual: string, expected: string): void {
  if (!expected || actual !== expected) {
    throw new ConfigError(
      "The configuration changed since this page was loaded. Reload and try again.",
      "STALE_VERSION",
    );
  }
}

/**
 * Durably replaces config.yml by writing a temp file, fsyncing it, then renaming
 * over the target so readers never observe a partial write. Returns the reloaded
 * config and removes the temp file if anything fails before the rename.
 */
async function atomicReplace(
  dataDirectory: string,
  rawYaml: string,
): Promise<LoadedConfig> {
  const configPath = join(dataDirectory, "config.yml");
  const temporaryPath = `${configPath}.tmp`;
  await mkdir(dirname(configPath), { recursive: true });
  let temporaryCreated = false;
  try {
    const handle = await open(temporaryPath, "w", 0o600);
    temporaryCreated = true;
    try {
      await handle.writeFile(rawYaml, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }

    await rename(temporaryPath, configPath);
    temporaryCreated = false;
    await syncDirectory(dirname(configPath));
    return loadConfig(dataDirectory);
  } finally {
    if (temporaryCreated) await unlink(temporaryPath).catch(() => undefined);
  }
}

/** Best-effort fsync of the directory so the rename survives a crash; logs on failure. */
async function syncDirectory(directory: string): Promise<void> {
  try {
    const handle = await open(directory, "r");
    try {
      await handle.sync();
    } finally {
      await handle.close();
    }
  } catch (error) {
    console.warn(
      "Could not fsync configuration directory:",
      error instanceof Error ? error.message : error,
    );
  }
}

/** Serialises writes into a single-file queue so saves never interleave. */
async function withWriteLock<T>(operation: () => Promise<T>): Promise<T> {
  const previous = writeQueue;
  let release!: () => void;
  writeQueue = new Promise<void>((resolve) => {
    release = resolve;
  });
  await previous;
  try {
    return await operation();
  } finally {
    release();
  }
}
