export function parseCsvRecords(source: string): string[][] {
  // Excel's "CSV UTF-8" and Qualtrics both write a byte-order mark, and both
  // quote every field. The mark sits before the first field's opening quote, so
  // `field.length === 0` was false when that quote arrived and the field became
  // the literal `"Title"`. Header detection then failed and the header row was
  // imported as a transcript, which is the first thing a researcher saw. The
  // backend survey parser already strips it; this path never did.
  const text = source.charCodeAt(0) === 0xfeff ? source.slice(1) : source;
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;

  const pushField = () => {
    row.push(field.trim());
    field = '';
  };

  const pushRow = () => {
    pushField();
    if (row.some((value) => value.length > 0)) {
      rows.push(row);
    }
    row = [];
  };

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }

    // RFC 4180: a quote only opens a quoted field at the very start of the
    // field. Mid-field quotes (an inch mark in `6" tall`) are literal; treating
    // them as openers swallowed every following row into one field.
    if (ch === '"' && field.length === 0) {
      inQuotes = true;
    } else if (ch === ',') {
      pushField();
    } else if (ch === '\n') {
      pushRow();
    } else if (ch !== '\r') {
      field += ch;
    }
  }

  if (field.length > 0 || row.length > 0) {
    pushRow();
  }

  return rows;
}
