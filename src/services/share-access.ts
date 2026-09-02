import { createHash, timingSafeEqual } from "node:crypto";

const passwordMatches = (submitted: string, expected: string): boolean => {
  const submittedHash = createHash("sha256").update(submitted).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(submittedHash, expectedHash);
};

export function shareAccessGranted(
  isAdmin: boolean,
  expected: string | undefined,
  submitted: string,
): boolean {
  if (isAdmin || !expected) {
    return true;
  }
  return passwordMatches(submitted, expected);
}

export function withSharePassword(path: string, password?: string): string {
  return password
    ? `${path}?${new URLSearchParams({ password }).toString()}`
    : path;
}
