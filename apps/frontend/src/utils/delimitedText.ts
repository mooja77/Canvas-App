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

/** RFC 4180 field: always quoted, embedded quotes doubled. */
export function escapeCsvField(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

/**
 * Tab-separated field for the clipboard. Excel and Sheets honour quoting on
 * paste, which is the only way an excerpt containing a tab or a line break can
 * land in a single cell. Ordinary values are left bare so pasting into a text
 * editor still looks like a table.
 */
export function escapeTsvField(value: string): string {
  return /[\t\n\r"]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}
