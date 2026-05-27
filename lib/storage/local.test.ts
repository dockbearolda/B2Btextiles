import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdtempSync, rmSync, existsSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';
import { LocalStorage } from './local';

let dir: string;
beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'tb2b-'));
});
afterAll(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe('LocalStorage', () => {
  it('écrit, lit puis supprime un fichier', async () => {
    const s = new LocalStorage(dir);
    await s.save('a.webp', Buffer.from('hello'));
    expect(existsSync(join(dir, 'a.webp'))).toBe(true);
    expect((await s.read('a.webp')).buffer.toString()).toBe('hello');
    await s.delete('a.webp');
    expect(existsSync(join(dir, 'a.webp'))).toBe(false);
  });
  it('refuse une traversée de chemin', async () => {
    const s = new LocalStorage(dir);
    await expect(s.read('../secret')).rejects.toThrow();
  });
  it('tolère la suppression d’un fichier absent', async () => {
    const s = new LocalStorage(dir);
    await expect(s.delete('absent.webp')).resolves.toBeUndefined();
  });
});
