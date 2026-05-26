import { describe, it, expect } from 'vitest';
import { slugify } from './slug';

describe('slugify', () => {
  it('lowercases and replaces spaces', () => {
    expect(slugify('T-Shirt Premium')).toBe('t-shirt-premium');
  });
  it('strips accents', () => {
    expect(slugify('Étiquette tissée')).toBe('etiquette-tissee');
  });
  it('collapses separators and trims edges', () => {
    expect(slugify('  Polo --- 100% coton !! ')).toBe('polo-100-coton');
  });
  it('returns a default base when empty', () => {
    expect(slugify('!!!')).toBe('item');
  });
});
