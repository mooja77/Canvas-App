import { describe, it, expect } from 'vitest';
import { numericValue } from './canvasGeometry';

describe('numericValue', () => {
  it('returns finite numbers as-is', () => {
    expect(numericValue(0)).toBe(0);
    expect(numericValue(42)).toBe(42);
    expect(numericValue(-3.5)).toBe(-3.5);
  });

  it('parses finite numeric strings', () => {
    expect(numericValue('120')).toBe(120);
    expect(numericValue('12.5px')).toBe(12.5);
  });

  it('rejects non-finite numbers (NaN/Infinity) — they serialize to JSON null and break the strict layout-save schema', () => {
    expect(numericValue(NaN)).toBeUndefined();
    expect(numericValue(Infinity)).toBeUndefined();
    expect(numericValue(-Infinity)).toBeUndefined();
  });

  it('rejects non-numeric inputs', () => {
    expect(numericValue('abc')).toBeUndefined();
    expect(numericValue(undefined)).toBeUndefined();
    expect(numericValue(null)).toBeUndefined();
    expect(numericValue({})).toBeUndefined();
  });
});
