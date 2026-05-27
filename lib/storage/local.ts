import { mkdir, readFile, writeFile, unlink } from 'fs/promises';
import { resolve, extname } from 'path';
import type { Storage } from './index';

const CT: Record<string, string> = { '.webp': 'image/webp' };

export class LocalStorage implements Storage {
  constructor(private root: string) {}

  private resolveSafe(key: string): string {
    const root = resolve(this.root);
    const p = resolve(root, key);
    if (p !== root && !p.startsWith(root + '/')) throw new Error('Chemin invalide');
    return p;
  }
  async save(key: string, data: Buffer): Promise<void> {
    const p = this.resolveSafe(key);
    await mkdir(resolve(this.root), { recursive: true });
    await writeFile(p, data);
  }
  async read(key: string): Promise<{ buffer: Buffer; contentType: string }> {
    const p = this.resolveSafe(key);
    const buffer = await readFile(p);
    return { buffer, contentType: CT[extname(p)] ?? 'application/octet-stream' };
  }
  async delete(key: string): Promise<void> {
    const p = this.resolveSafe(key);
    await unlink(p).catch((e: NodeJS.ErrnoException) => {
      if (e.code !== 'ENOENT') throw e;
    });
  }
}
