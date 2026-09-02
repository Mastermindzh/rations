export type ParsedScryptHash = {
  salt: Buffer;
  hash: Buffer;
};

export const SCRYPT_KEY_LENGTH = 64;
export const SCRYPT_COST = 16_384;
export const SCRYPT_BLOCK_SIZE = 8;
export const SCRYPT_PARALLELIZATION = 1;

const BASE64URL_PATTERN = /^[A-Za-z0-9_-]+$/;

export function serializeScryptHash(salt: Buffer, hash: Buffer): string {
  return [
    "scrypt",
    SCRYPT_COST,
    SCRYPT_BLOCK_SIZE,
    SCRYPT_PARALLELIZATION,
    salt.toString("base64url"),
    hash.toString("base64url"),
  ].join("$");
}

export function parseScryptHash(
  encoded: string,
): ParsedScryptHash | undefined {
  const parts = encoded.split("$");
  if (parts.length !== 6) {
    return undefined;
  }
  const [algorithm, costText, blockText, parallelText, saltText, hashText] =
    parts;
  if (
    algorithm !== "scrypt" ||
    Number(costText) !== SCRYPT_COST ||
    Number(blockText) !== SCRYPT_BLOCK_SIZE ||
    Number(parallelText) !== SCRYPT_PARALLELIZATION ||
    !saltText ||
    !hashText ||
    !BASE64URL_PATTERN.test(saltText) ||
    !BASE64URL_PATTERN.test(hashText)
  ) {
    return undefined;
  }
  const salt = Buffer.from(saltText, "base64url");
  const hash = Buffer.from(hashText, "base64url");
  if (salt.length === 0 || hash.length !== SCRYPT_KEY_LENGTH) {
    return undefined;
  }
  return { salt, hash };
}

export function isScryptHash(encoded: string): boolean {
  return parseScryptHash(encoded) !== undefined;
}
