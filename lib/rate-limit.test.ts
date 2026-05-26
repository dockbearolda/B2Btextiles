import { describe, it, expect } from 'vitest';
import { hit } from './rate-limit';

describe('hit', () => {
  it('allows up to the limit then blocks', () => {
    const key = 'k1';
    expect(hit(key, 3, 1000)).toBe(true);
    expect(hit(key, 3, 1000)).toBe(true);
    expect(hit(key, 3, 1000)).toBe(true);
    expect(hit(key, 3, 1000)).toBe(false);
  });
  it('resets after the window', () => {
    const key = 'k2';
    expect(hit(key, 1, 0)).toBe(true);
    expect(hit(key, 1, 0)).toBe(true); // 0ms window → already expired
  });
});
