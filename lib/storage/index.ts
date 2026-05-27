import { LocalStorage } from './local';

export interface Storage {
  save(key: string, data: Buffer): Promise<void>;
  read(key: string): Promise<{ buffer: Buffer; contentType: string }>;
  delete(key: string): Promise<void>;
}

let instance: Storage | null = null;
export function getStorage(): Storage {
  if (instance) return instance;
  const backend = process.env.STORAGE ?? 'local';
  if (backend === 'local') {
    instance = new LocalStorage(process.env.UPLOAD_DIR ?? '.data/uploads');
    return instance;
  }
  throw new Error(`STORAGE inconnu : ${backend}`);
}
