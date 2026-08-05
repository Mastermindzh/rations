import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
const KEY_LENGTH = 64;
const COST = 16384;
const BLOCK_SIZE = 8;
const PARALLELIZATION = 1;

function derive(
  password: string,
  salt: Buffer,
  length: number,
  cost: number,
  blockSize: number,
  parallelization: number,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      length,
      { N: cost, r: blockSize, p: parallelization },
      (error, key) => {
        if (error) reject(error);
        else resolve(key);
      },
    );
  });
}

export async function hashPassword(password: string): Promise<string> {
  if (!password) throw new Error("Password must not be empty");
  const salt = randomBytes(16);
  const derived = await derive(
    password,
    salt,
    KEY_LENGTH,
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
  );
  return [
    "scrypt",
    COST,
    BLOCK_SIZE,
    PARALLELIZATION,
    salt.toString("base64url"),
    derived.toString("base64url"),
  ].join("$");
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  try {
    const [algorithm, costText, blockText, parallelText, saltText, hashText] =
      encoded.split("$");
    if (
      algorithm !== "scrypt" ||
      !costText ||
      !blockText ||
      !parallelText ||
      !saltText ||
      !hashText
    ) {
      return false;
    }
    const cost = Number(costText);
    const blockSize = Number(blockText);
    const parallelization = Number(parallelText);
    if (
      cost !== COST ||
      blockSize !== BLOCK_SIZE ||
      parallelization !== PARALLELIZATION
    )
      return false;
    const expected = Buffer.from(hashText, "base64url");
    if (expected.length !== KEY_LENGTH) return false;
    const actual = await derive(
      password,
      Buffer.from(saltText, "base64url"),
      expected.length,
      cost,
      blockSize,
      parallelization,
    );
    return timingSafeEqual(actual, expected);
  } catch {
    return false;
  }
}
