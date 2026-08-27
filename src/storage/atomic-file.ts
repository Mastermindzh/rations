import { mkdir, open, rename, unlink } from "node:fs/promises";
import { dirname } from "node:path";

// Durably replaces a file: write temp, fsync, rename over target, sync the dir.
// Readers never observe a partial write; the temp file is removed on failure.
export async function writeFileAtomically(
  targetPath: string,
  contents: string,
): Promise<void> {
  const temporaryPath = `${targetPath}.tmp`;
  await mkdir(dirname(targetPath), { recursive: true });
  let temporaryCreated = false;
  try {
    const handle = await open(temporaryPath, "w", 0o600);
    temporaryCreated = true;
    try {
      await handle.writeFile(contents, "utf8");
      await handle.sync();
    } finally {
      await handle.close();
    }
    await rename(temporaryPath, targetPath);
    temporaryCreated = false;
    await syncDirectory(dirname(targetPath));
  } finally {
    if (temporaryCreated) {
      await unlink(temporaryPath).catch(() => undefined);
    }
  }
}

// Best-effort directory fsync so the rename survives a crash; logs on failure.
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
      "Could not fsync directory:",
      error instanceof Error ? error.message : error,
    );
  }
}

// Serialises async operations into a single-file queue so writes never interleave.
export function createSerialQueue(): <T>(op: () => Promise<T>) => Promise<T> {
  let queue: Promise<void> = Promise.resolve();
  return async (operation) => {
    const previous = queue;
    let release!: () => void;
    queue = new Promise<void>((resolve) => {
      release = resolve;
    });
    await previous;
    try {
      return await operation();
    } finally {
      release();
    }
  };
}
