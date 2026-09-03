import { describe, it, expect } from 'vitest';
import { parseSurveyCSV } from './csvParser.js';

const mapping = { titleColumn: 'id', contentColumn: 'answer' };

describe('parseSurveyCSV - encoding and line-ending variants', () => {
  it('parses a plain LF file', () => {
    const rows = parseSurveyCSV('id,answer\nr1,Yes\nr2,No\n', mapping);
    expect(rows).toEqual([
      { title: 'r1', content: 'Yes' },
      { title: 'r2', content: 'No' },
    ]);
  });

  it('parses a CRLF file', () => {
    const rows = parseSurveyCSV('id,answer\r\nr1,Yes\r\nr2,No\r\n', mapping);
    expect(rows.map((r) => r.title)).toEqual(['r1', 'r2']);
  });

  it('imports an Excel "CSV UTF-8" / Qualtrics file: BOM followed by a quoted header (H6)', () => {
    const csv = '\uFEFF"id","answer"\r\n"r1","Yes, definitely"\r\n"r2","No"\r\n';
    const rows = parseSurveyCSV(csv, mapping);
    expect(rows).toEqual([
      { title: 'r1', content: 'Yes, definitely' },
      { title: 'r2', content: 'No' },
    ]);
  });

  it('imports a BOM-prefixed file with an unquoted header', () => {
    const rows = parseSurveyCSV('\uFEFFid,answer\nr1,Yes\n', mapping);
    expect(rows).toEqual([{ title: 'r1', content: 'Yes' }]);
  });

  it('treats a lone CR as a row separator (classic Mac line endings) (L11)', () => {
    const rows = parseSurveyCSV('id,answer\rr1,Yes\rr2,No\r', mapping);
    expect(rows).toEqual([
      { title: 'r1', content: 'Yes' },
      { title: 'r2', content: 'No' },
    ]);
  });

  it('keeps a newline inside a quoted field', () => {
    const rows = parseSurveyCSV('id,answer\nr1,"line one\nline two"\n', mapping);
    expect(rows).toEqual([{ title: 'r1', content: 'line one\nline two' }]);
  });

  it('normalises a CRLF inside a quoted field to LF (documented, harmless)', () => {
    const rows = parseSurveyCSV('id,answer\r\nr1,"line one\r\nline two"\r\n', mapping);
    expect(rows).toEqual([{ title: 'r1', content: 'line one\nline two' }]);
  });

  it('reads the case column when mapped', () => {
    const rows = parseSurveyCSV('id,answer,case\nr1,Yes,C1\n', { ...mapping, caseColumn: 'case' });
    expect(rows).toEqual([{ title: 'r1', content: 'Yes', caseId: 'C1' }]);
  });

  it('names a missing column in the error, listing the headers it saw', () => {
    expect(() => parseSurveyCSV('id,answer\nr1,Yes\n', { titleColumn: 'nope', contentColumn: 'answer' })).toThrow(
      /Title column "nope" not found in CSV headers: id, answer/,
    );
  });
});
