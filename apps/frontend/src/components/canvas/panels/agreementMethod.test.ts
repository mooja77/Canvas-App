import { describe, it, expect } from 'vitest';
import { chooseAgreementMethod } from './agreementMethod';

describe('chooseAgreementMethod', () => {
  it('needs at least 2 coders', () => {
    expect(chooseAgreementMethod(0).canCompute).toBe(false);
    expect(chooseAgreementMethod(1).canCompute).toBe(false);
  });

  it('uses Cohen’s κ for exactly 2 coders', () => {
    const m = chooseAgreementMethod(2);
    expect(m.canCompute).toBe(true);
    expect(m.method).toBe('cohen');
    expect(m.label).toContain('Cohen');
  });

  it('uses Krippendorff’s α for 3 or more coders', () => {
    const m = chooseAgreementMethod(3);
    expect(m.canCompute).toBe(true);
    expect(m.method).toBe('krippendorff');
    expect(m.label).toContain('Krippendorff');
    expect(chooseAgreementMethod(7).method).toBe('krippendorff');
  });
});
