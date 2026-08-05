import { createHash, timingSafeEqual } from "node:crypto";

function passwordMatches(submitted: string, expected: string): boolean {
  const submittedHash = createHash("sha256").update(submitted).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  return timingSafeEqual(submittedHash, expectedHash);
}

export function shareAccessGranted(
  isAdmin: boolean,
  expected: string | undefined,
  submitted: string,
): boolean {
  if (isAdmin || !expected) return true;
  return passwordMatches(submitted, expected);
}
