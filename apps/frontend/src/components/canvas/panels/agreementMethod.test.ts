import { describe, it, expect } from 'vitest';
import { chooseAgreementMethod } from './agreementMethod';

describe('chooseAgreementMethod', () => {
  it('needs at least 2 coders', () => {
    expect(chooseAgreementMethod(0).canCompute).toBe(false);
    expect(chooseAgreementMethod(1).canCompute).toBe(false);
  });

  // This test previously asserted `method === 'cohen'` and a label containing
  // "Cohen" for two coders. It was asserting a promise the product never kept:
  // the server calls computeKrippendorffAlpha for every request and returns
  // "Krippendorff's α" regardless of coder count. The panel therefore named a
  // coefficient that was never computed, in the commonest case there is, and a
  // researcher could carry that name into a methods section.
  it('names Krippendorff’s α for exactly 2 coders, because that is what the server computes', () => {
    const m = chooseAgreementMethod(2);
    expect(m.canCompute).toBe(true);
    expect(m.method).toBe('krippendorff');
    expect(m.label).toContain('Krippendorff');
    expect(m.label).not.toContain('Cohen');
  });

  it('names Krippendorff’s α for 3 or more coders', () => {
    const m = chooseAgreementMethod(3);
    expect(m.canCompute).toBe(true);
    expect(m.method).toBe('krippendorff');
    expect(m.label).toContain('Krippendorff');
    expect(chooseAgreementMethod(7).method).toBe('krippendorff');
  });

  it('never claims a coefficient the backend does not implement', () => {
    for (let n = 2; n <= 10; n++) {
      expect(chooseAgreementMethod(n).label).not.toContain('Cohen');
    }
  });
});
