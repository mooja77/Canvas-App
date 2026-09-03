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

  // M9: a bare inch mark mid-field must not open a quoted field. Before the
  // fix `6" tall` swallowed every following row into one field (3 -> 1).
  it('treats a double quote inside an unquoted field as a literal character', () => {
    expect(parseCsvRecords('Title,Content\nP1,I am 6" tall\nP2,second\nP3,third')).toEqual([
      ['Title', 'Content'],
      ['P1', 'I am 6" tall'],
      ['P2', 'second'],
      ['P3', 'third'],
    ]);
  });

  it('still opens a quoted field when the quote is the first character', () => {
    expect(parseCsvRecords('P1,"a, b"\nP2,c')).toEqual([
      ['P1', 'a, b'],
      ['P2', 'c'],
    ]);
  });
});
