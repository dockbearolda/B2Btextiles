import { randomBytes } from 'crypto';

export function newImageKey(): string {
  return `${Date.now().toString(36)}${randomBytes(6).toString('hex')}.webp`;
}
export function thumbKey(key: string): string {
  return key.replace(/\.webp$/, '.thumb.webp');
}
export function publicUrl(key: string): string {
  return `/uploads/${key}`;
}
export function thumbUrlFromUrl(url: string): string {
  return url.replace(/\.webp$/, '.thumb.webp');
}
