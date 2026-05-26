import { describe, it, expect } from 'vitest';
import { validateFieldUpdate } from './field-schemas';

describe('validateFieldUpdate', () => {
  it('validates and returns the typed value', () => {
    expect(validateFieldUpdate('product', 'prix', '12.5')).toBe(12.5);
    expect(validateFieldUpdate('genre', 'name', 'Polo')).toBe('Polo');
  });
  it('rejects an unknown entity', () => {
    expect(() => validateFieldUpdate('hacker', 'x', '1')).toThrow();
  });
  it('rejects a non-allowlisted field', () => {
    expect(() => validateFieldUpdate('product', 'passwordHash', 'x')).toThrow();
  });
  it('rejects an invalid value', () => {
    expect(() => validateFieldUpdate('product', 'prix', 'abc')).toThrow();
    expect(() => validateFieldUpdate('genre', 'name', '')).toThrow();
  });
});
