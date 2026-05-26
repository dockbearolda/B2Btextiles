type Entry = { count: number; resetAt: number };
const store = new Map<string, Entry>();

export function hit(key: string, limit: number, windowMs: number): boolean {
  const now = Date.now();
  const e = store.get(key);
  if (!e || now >= e.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (e.count >= limit) return false;
  e.count += 1;
  return true;
}
