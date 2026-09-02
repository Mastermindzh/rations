const WINDOW_MS = 15 * 60 * 1000;
const BLOCK_MS = 15 * 60 * 1000;
const MAX_FAILURES = 5;

type Attempt = { failures: number[]; blockedUntil: number };

export type LoginThrottle = {
  isBlocked(ip: string): boolean;
  recordFailure(ip: string): void;
  reset(ip: string): void;
};

export function clientIp(header: string | undefined): string {
  return header?.split(",")[0]?.trim() || "unknown";
}

export function createLoginThrottle(): LoginThrottle {
  const attempts = new Map<string, Attempt>();
  return {
    isBlocked(ip) {
      return (attempts.get(ip)?.blockedUntil ?? 0) > Date.now();
    },
    recordFailure(ip) {
      const now = Date.now();
      const record = attempts.get(ip) ?? { failures: [], blockedUntil: 0 };
      record.failures = record.failures.filter(
        (time) => time > now - WINDOW_MS,
      );
      record.failures.push(now);
      if (record.failures.length >= MAX_FAILURES) {
        record.blockedUntil = now + BLOCK_MS;
      }
      attempts.set(ip, record);
    },
    reset(ip) {
      attempts.delete(ip);
    },
  };
}
