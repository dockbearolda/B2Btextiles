import { describe, it, expect } from 'vitest';
import { newImageKey, thumbKey, publicUrl, thumbUrlFromUrl } from './keys';

describe('image keys', () => {
  it('génère une clé .webp unique', () => {
    const k = newImageKey();
    expect(k).toMatch(/^[a-z0-9]+\.webp$/);
    expect(newImageKey()).not.toBe(k);
  });
  it('dérive la clé thumb', () => {
    expect(thumbKey('abc.webp')).toBe('abc.thumb.webp');
  });
  it('construit l’URL publique', () => {
    expect(publicUrl('abc.webp')).toBe('/uploads/abc.webp');
  });
  it('dérive l’URL thumb depuis l’URL full', () => {
    expect(thumbUrlFromUrl('/uploads/abc.webp')).toBe('/uploads/abc.thumb.webp');
  });
});
