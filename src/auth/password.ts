import {
  randomBytes,
  scrypt as nodeScrypt,
  timingSafeEqual,
} from "node:crypto";
import {
  parseScryptHash,
  SCRYPT_BLOCK_SIZE,
  SCRYPT_COST,
  SCRYPT_KEY_LENGTH,
  SCRYPT_PARALLELIZATION,
  serializeScryptHash,
} from "./password-format.js";

const derive = (
  password: string,
  salt: Buffer,
  length: number,
  cost: number,
  blockSize: number,
  parallelization: number,
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    nodeScrypt(
      password,
      salt,
      length,
      { N: cost, r: blockSize, p: parallelization },
      (error, key) => {
        if (error) {
          reject(error);
        } else {
          resolve(key);
        }
      },
    );
  });
};

export async function hashPassword(password: string): Promise<string> {
  if (!password) {
    throw new Error("Password must not be empty");
  }
  const salt = randomBytes(16);
  const derived = await derive(
    password,
    salt,
    SCRYPT_KEY_LENGTH,
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
  );
  return serializeScryptHash(salt, derived);
}

export async function verifyPassword(
  password: string,
  encoded: string,
): Promise<boolean> {
  try {
    const parsed = parseScryptHash(encoded);
    if (!parsed) {
      return false;
    }
    const actual = await derive(
      password,
      parsed.salt,
      parsed.hash.length,
      SCRYPT_COST,
      SCRYPT_BLOCK_SIZE,
      SCRYPT_PARALLELIZATION,
    );
    return timingSafeEqual(actual, parsed.hash);
  } catch {
    return false;
  }
}
