type Window = { startedAt: number; count: number };

export type RequestThrottle = {
  allow(key: string): boolean;
};

export function createRequestThrottle(
  maximum: number,
  windowMs: number,
): RequestThrottle {
  const windows = new Map<string, Window>();
  return {
    allow(key) {
      const now = Date.now();
      const current = windows.get(key);
      if (!current || current.startedAt <= now - windowMs) {
        windows.set(key, { startedAt: now, count: 1 });
        return true;
      }
      if (current.count >= maximum) {
        return false;
      }
      current.count += 1;
      return true;
    },
  };
}
