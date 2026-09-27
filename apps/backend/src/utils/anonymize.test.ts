import { describe, it, expect } from 'vitest';
import { anonymizeText } from './anonymize.js';

describe('anonymizeText', () => {
  it('replaces whole words case-insensitively and keeps later offsets aligned', () => {
    const text = 'John said X. Mary said Y. john again.';
    const r = anonymizeText(text, [{ find: 'John', replace: '[P1]' }]);
    expect(r.content).toBe('[P1] said X. Mary said Y. [P1] again.');
    const maryStart = text.indexOf('Mary');
    const s = r.mapStart(maryStart);
    const e = r.mapEnd(maryStart + 'Mary said Y.'.length);
    expect(r.content.slice(s, e)).toBe('Mary said Y.');
    expect(r.replacedCount).toBe(2);
  });

  it('handles accented names that ASCII \b missed', () => {
    const r = anonymizeText('I met Úna and José today, and Áine.', [
      { find: 'Úna', replace: 'P1' },
      { find: 'José', replace: 'P2' },
      { find: 'Áine', replace: 'P3' },
    ]);
    expect(r.content).toBe('I met P1 and P2 today, and P3.');
  });

  it('does not replace inside a longer word', () => {
    expect(anonymizeText('Annabel and Ann', [{ find: 'Ann', replace: 'P1' }]).content).toBe('Annabel and P1');
    expect(anonymizeText('Josélito', [{ find: 'José', replace: 'P1' }]).content).toBe('Josélito');
  });

  it('treats the replacement literally', () => {
    expect(anonymizeText('Bob here', [{ find: 'Bob', replace: '$& [$1]' }]).content).toBe('$& [$1] here');
  });

  it('matches terms ending in punctuation such as "Dr."', () => {
    expect(anonymizeText('Dr. Kelly saw Dr. Kelly', [{ find: 'Dr. Kelly', replace: 'Clinician' }]).content).toBe(
      'Clinician saw Clinician',
    );
  });

  it('prefers the longest term and snaps offsets inside a replaced span outward', () => {
    const text = 'Mary Anne and Mary';
    const r = anonymizeText(text, [
      { find: 'Mary', replace: 'P1' },
      { find: 'Mary Anne', replace: 'P2' },
    ]);
    expect(r.content).toBe('P2 and P1');
    // A coding over "Anne" (inside the replaced span) now covers "P2".
    expect(r.content.slice(r.mapStart(5), r.mapEnd(9))).toBe('P2');
  });

  it('is a no-op for empty search terms', () => {
    const r = anonymizeText('abc', [{ find: '  ', replace: 'x' }]);
    expect(r.content).toBe('abc');
    expect(r.mapStart(2)).toBe(2);
  });
});
