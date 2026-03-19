/**
 * Simple CSV parser for survey data import.
 * No external dependencies — handles quoted fields, escaped quotes, and newlines within quotes.
 */

interface ColumnMapping {
  titleColumn: string;
  contentColumn: string;
  caseColumn?: string;
}

interface ParsedRow {
  title: string;
  content: string;
  caseId?: string;
}

/**
 * Parse a raw CSV string into rows of field arrays.
 * Handles RFC 4180: quoted fields, escaped double-quotes, newlines in quoted values.
 */
function parseCSVRows(csvContent: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < csvContent.length; i++) {
    const ch = csvContent[i];
    const next = csvContent[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else if (ch === '"') {
        // End of quoted field
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"' && current.length === 0) {
        // Start of quoted field
        inQuotes = true;
      } else if (ch === ',') {
        row.push(current.trim());
        current = '';
      } else if (ch === '\r' && next === '\n') {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = '';
        i++; // skip \n
      } else if (ch === '\n') {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = '';
      } else {
        current += ch;
      }
    }
  }

  // Last field/row
  if (current.length > 0 || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }

  return rows;
}

/**
 * Parse survey CSV content with a column mapping, returning structured rows.
 *
 * @param csvContent  Raw CSV string
 * @param columnMapping  Which columns to use for title, content, and (optionally) case
 * @returns Array of parsed rows suitable for creating transcripts
 */
export function parseSurveyCSV(
  csvContent: string,
  columnMapping: ColumnMapping,
): ParsedRow[] {
  const rows = parseCSVRows(csvContent);
  if (rows.length < 2) {
    throw new Error('CSV must contain at least a header row and one data row');
  }

  const headers = rows[0].map(h => h.toLowerCase().trim());
  const titleIdx = headers.indexOf(columnMapping.titleColumn.toLowerCase().trim());
  const contentIdx = headers.indexOf(columnMapping.contentColumn.toLowerCase().trim());
  const caseIdx = columnMapping.caseColumn
    ? headers.indexOf(columnMapping.caseColumn.toLowerCase().trim())
    : -1;

  if (titleIdx === -1) {
    throw new Error(`Title column "${columnMapping.titleColumn}" not found in CSV headers: ${rows[0].join(', ')}`);
  }
  if (contentIdx === -1) {
    throw new Error(`Content column "${columnMapping.contentColumn}" not found in CSV headers: ${rows[0].join(', ')}`);
  }

  const results: ParsedRow[] = [];

  for (let i = 1; i < rows.length; i++) {
    const fields = rows[i];
    const title = fields[titleIdx] || '';
    const content = fields[contentIdx] || '';

    // Skip empty rows
    if (!title && !content) continue;

    const parsed: ParsedRow = {
      title: title || `Response ${i}`,
      content,
    };

    if (caseIdx !== -1 && fields[caseIdx]) {
      parsed.caseId = fields[caseIdx];
    }

    results.push(parsed);
  }

  return results;
}
