import ExcelJS from 'exceljs';

// ─── Types for canvas data passed from route ───

interface CanvasQuestion {
  id: string;
  text: string;
  color: string;
  parentQuestionId: string | null;
}

interface CanvasTranscript {
  id: string;
  title: string;
  content: string;
  caseId: string | null;
}

interface CanvasTextCoding {
  id: string;
  transcriptId: string;
  questionId: string;
  startOffset: number;
  endOffset: number;
  codedText: string;
  note: string | null;
  annotation: string | null;
}

interface CanvasCase {
  id: string;
  name: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  attributes: any;
}

interface CanvasData {
  name: string;
  questions: CanvasQuestion[];
  transcripts: CanvasTranscript[];
  codings: CanvasTextCoding[];
  cases: CanvasCase[];
}

// ─── Style constants ───

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: 'FFFFFFFF' },
  size: 11,
};

const HEADER_FILL: ExcelJS.FillPattern = {
  type: 'pattern',
  pattern: 'solid',
  fgColor: { argb: 'FF4F46E5' }, // indigo-600
};

const HEADER_ALIGNMENT: Partial<ExcelJS.Alignment> = {
  vertical: 'middle',
  horizontal: 'left',
  wrapText: true,
};

const THIN_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  bottom: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  left: { style: 'thin', color: { argb: 'FFE5E7EB' } },
  right: { style: 'thin', color: { argb: 'FFE5E7EB' } },
};

/** Convert a hex color like "#3B82F6" to ARGB like "FF3B82F6" */
function hexToArgb(hex: string): string {
  const clean = hex.replace('#', '');
  return `FF${clean.toUpperCase()}`;
}

/** Apply header styling to the first row of a worksheet */
function styleHeaderRow(ws: ExcelJS.Worksheet): void {
  const headerRow = ws.getRow(1);
  headerRow.font = HEADER_FONT;
  headerRow.fill = HEADER_FILL;
  headerRow.alignment = HEADER_ALIGNMENT;
  headerRow.height = 28;
  headerRow.eachCell(cell => {
    cell.border = THIN_BORDER;
  });
}

/** Auto-fit column widths based on content (approximate) */
function autoFitColumns(ws: ExcelJS.Worksheet): void {
  ws.columns.forEach(col => {
    let maxLen = 10;
    col.eachCell?.({ includeEmpty: false }, cell => {
      const val = cell.value?.toString() || '';
      maxLen = Math.max(maxLen, Math.min(val.length + 2, 60));
    });
    col.width = maxLen;
  });
}

/** Enable auto-filter on the header row */
function addAutoFilter(ws: ExcelJS.Worksheet, colCount: number): void {
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: colCount },
  };
}

// ─── Sheet builders ───

function buildCodebookSheet(wb: ExcelJS.Workbook, data: CanvasData): void {
  const ws = wb.addWorksheet('Codebook');

  // Build question lookup
  const questionMap = new Map<string, CanvasQuestion>();
  data.questions.forEach(q => questionMap.set(q.id, q));

  // Count codings per question
  const freqMap = new Map<string, number>();
  data.codings.forEach(c => {
    freqMap.set(c.questionId, (freqMap.get(c.questionId) || 0) + 1);
  });

  ws.columns = [
    { header: 'Code Name', key: 'name', width: 30 },
    { header: 'Color', key: 'color', width: 12 },
    { header: 'Frequency', key: 'frequency', width: 12 },
    { header: 'Parent Code', key: 'parent', width: 30 },
  ];

  data.questions.forEach(q => {
    const parent = q.parentQuestionId ? questionMap.get(q.parentQuestionId) : null;
    const row = ws.addRow({
      name: q.text,
      color: q.color,
      frequency: freqMap.get(q.id) || 0,
      parent: parent?.text || '',
    });

    // Color the code name cell with the code's color
    const nameCell = row.getCell('name');
    nameCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(q.color) },
    };
    // Pick white or black text based on luminance
    const hex = q.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    nameCell.font = { color: { argb: luminance > 0.5 ? 'FF000000' : 'FFFFFFFF' }, bold: true };

    // Color swatch in color column
    const colorCell = row.getCell('color');
    colorCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(q.color) },
    };
    colorCell.font = { color: { argb: luminance > 0.5 ? 'FF000000' : 'FFFFFFFF' }, size: 10 };

    row.eachCell(cell => {
      cell.border = THIN_BORDER;
    });
  });

  styleHeaderRow(ws);
  addAutoFilter(ws, 4);
}

function buildCodingsSheet(wb: ExcelJS.Workbook, data: CanvasData): void {
  const ws = wb.addWorksheet('Codings');

  const transcriptMap = new Map<string, CanvasTranscript>();
  data.transcripts.forEach(t => transcriptMap.set(t.id, t));

  const questionMap = new Map<string, CanvasQuestion>();
  data.questions.forEach(q => questionMap.set(q.id, q));

  ws.columns = [
    { header: 'Transcript', key: 'transcript', width: 25 },
    { header: 'Code', key: 'code', width: 25 },
    { header: 'Coded Text', key: 'codedText', width: 50 },
    { header: 'Start Offset', key: 'startOffset', width: 14 },
    { header: 'End Offset', key: 'endOffset', width: 14 },
    { header: 'Note', key: 'note', width: 30 },
    { header: 'Annotation', key: 'annotation', width: 30 },
  ];

  data.codings.forEach(c => {
    const transcript = transcriptMap.get(c.transcriptId);
    const question = questionMap.get(c.questionId);

    const row = ws.addRow({
      transcript: transcript?.title || 'Unknown',
      code: question?.text || 'Unknown',
      codedText: c.codedText,
      startOffset: c.startOffset,
      endOffset: c.endOffset,
      note: c.note || '',
      annotation: c.annotation || '',
    });

    // Color the code cell
    if (question) {
      const codeCell = row.getCell('code');
      codeCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: hexToArgb(question.color) },
      };
      const hex = question.color.replace('#', '');
      const r = parseInt(hex.substring(0, 2), 16);
      const g = parseInt(hex.substring(2, 4), 16);
      const b = parseInt(hex.substring(4, 6), 16);
      const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      codeCell.font = { color: { argb: luminance > 0.5 ? 'FF000000' : 'FFFFFFFF' } };
    }

    // Wrap text for coded text cell
    row.getCell('codedText').alignment = { wrapText: true, vertical: 'top' };

    row.eachCell(cell => {
      cell.border = THIN_BORDER;
    });
  });

  styleHeaderRow(ws);
  addAutoFilter(ws, 7);
}

function buildCaseMatrixSheet(wb: ExcelJS.Workbook, data: CanvasData): void {
  const ws = wb.addWorksheet('Case Matrix');

  if (data.cases.length === 0 || data.questions.length === 0) {
    ws.addRow(['No cases or codes defined']);
    return;
  }

  // Build case-to-transcripts mapping
  const caseTranscripts = new Map<string, Set<string>>();
  data.cases.forEach(c => caseTranscripts.set(c.id, new Set()));
  data.transcripts.forEach(t => {
    if (t.caseId && caseTranscripts.has(t.caseId)) {
      caseTranscripts.get(t.caseId)!.add(t.id);
    }
  });

  // Header row: Case Name | Code1 | Code2 | ...
  const columns: Partial<ExcelJS.Column>[] = [
    { header: 'Case', key: 'case', width: 25 },
  ];
  data.questions.forEach(q => {
    columns.push({ header: q.text, key: q.id, width: 14 });
  });
  ws.columns = columns;

  // Color the code headers
  const headerRow = ws.getRow(1);
  data.questions.forEach((q, i) => {
    const cell = headerRow.getCell(i + 2); // +2 because col 1 is "Case"
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: hexToArgb(q.color) },
    };
    const hex = q.color.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    cell.font = { bold: true, color: { argb: luminance > 0.5 ? 'FF000000' : 'FFFFFFFF' }, size: 11 };
  });

  // Fill data rows
  data.cases.forEach(c => {
    const tIds = caseTranscripts.get(c.id) || new Set();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rowData: Record<string, any> = { case: c.name };

    data.questions.forEach(q => {
      const count = data.codings.filter(
        coding => coding.questionId === q.id && tIds.has(coding.transcriptId)
      ).length;
      rowData[q.id] = count;
    });

    const row = ws.addRow(rowData);
    row.eachCell(cell => {
      cell.border = THIN_BORDER;
    });

    // Highlight non-zero cells
    data.questions.forEach((q, i) => {
      const cell = row.getCell(i + 2);
      const val = cell.value as number;
      if (val > 0) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF0FDF4' }, // light green
        };
        cell.font = { bold: true };
      }
    });
  });

  // Style the "Case" header (first cell gets standard header style)
  const caseHeader = headerRow.getCell(1);
  caseHeader.font = HEADER_FONT;
  caseHeader.fill = HEADER_FILL;
  headerRow.alignment = HEADER_ALIGNMENT;
  headerRow.height = 28;

  addAutoFilter(ws, data.questions.length + 1);
}

// ─── Main export function ───

export async function generateExcelExport(data: CanvasData): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'QualCanvas';
  wb.created = new Date();

  buildCodebookSheet(wb, data);
  buildCodingsSheet(wb, data);
  buildCaseMatrixSheet(wb, data);

  const buffer = await wb.xlsx.writeBuffer();
  return Buffer.from(buffer);
}
