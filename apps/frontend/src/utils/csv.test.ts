import { describe, expect, it } from 'vitest';
import { parseCsvRecords } from './csv';

describe('parseCsvRecords', () => {
  it('parses quoted commas and escaped quotes', () => {
    expect(parseCsvRecords('"Participant, A","said ""hello"""')).toEqual([['Participant, A', 'said "hello"']]);
  });

  it('keeps newlines inside quoted fields', () => {
    expect(parseCsvRecords('Title,"line one\nline two"\nNext,plain')).toEqual([
      ['Title', 'line one\nline two'],
      ['Next', 'plain'],
    ]);
  });

  it('ignores empty rows', () => {
    expect(parseCsvRecords('\nA,B\r\n\r\nC,D\n')).toEqual([
      ['A', 'B'],
      ['C', 'D'],
    ]);
  });
});
