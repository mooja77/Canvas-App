import { describe, it, expect } from 'vitest';
import { METHODOLOGY_PARADIGMS, getParadigm } from './methodologyParadigms';

describe('METHODOLOGY_PARADIGMS', () => {
  it('covers the main qualitative paradigms', () => {
    const keys = METHODOLOGY_PARADIGMS.map((p) => p.key);
    for (const expected of [
      'reflexive-ta',
      'grounded-theory',
      'framework',
      'ipa',
      'content-analysis',
      'discourse-narrative',
      'phenomenology',
      'mixed-methods',
    ]) {
      expect(keys).toContain(expected);
    }
  });

  it('has unique keys', () => {
    const keys = METHODOLOGY_PARADIGMS.map((p) => p.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('every paradigm is well-formed with non-empty steps', () => {
    for (const p of METHODOLOGY_PARADIGMS) {
      expect(p.name.length).toBeGreaterThan(0);
      expect(p.tagline.length).toBeGreaterThan(0);
      expect(p.bestFor.length).toBeGreaterThan(0);
      expect(p.icrNote.length).toBeGreaterThan(0);
      expect(p.steps.length).toBeGreaterThanOrEqual(3);
      for (const s of p.steps) {
        expect(s.title.trim().length).toBeGreaterThan(0);
        expect(s.guidance.trim().length).toBeGreaterThan(0);
        expect(s.inCanvas.trim().length).toBeGreaterThan(0);
      }
    }
  });

  it('getParadigm resolves by key and returns undefined for unknown', () => {
    expect(getParadigm('ipa')?.name).toContain('IPA');
    expect(getParadigm('nope')).toBeUndefined();
  });
});
