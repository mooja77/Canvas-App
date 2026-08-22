import { describe, it, expect } from 'vitest';
import ExcelJS from 'exceljs';
import { generateExcelExport } from './excelExport';

/**
 * These tests open the produced .xlsx with ExcelJS and inspect the actual cell
 * values / styles, rather than asserting on how the builder was called.
 *
 * Formula-injection handling has two requirements:
 *  1. the researcher's visible text must survive the export byte-for-byte, and
 *  2. a value that looks like a formula must be carried as a *text* cell.
 */

const FORMULA_CODED_TEXT = '=SUM(1+1) said the participant';
const FORMULA_CODE_NAME = '=cmd|calc!A1';
const FORMULA_CASE_NAME = '+lookup(evil)';
const FORMULA_MATRIX_CODE = '@risky code';

function makeData() {
  return {
    name: 'Injection Canvas',
    questions: [
      { id: 'q1', text: FORMULA_CODE_NAME, color: '#3B82F6', parentQuestionId: null },
      { id: 'q2', text: FORMULA_MATRIX_CODE, color: '#10B981', parentQuestionId: 'q1' },
    ],
    transcripts: [{ id: 't1', title: '-Interview 1', content: 'hello world', caseId: 'c1' }],
    codings: [
      {
        id: 'x1',
        transcriptId: 't1',
        questionId: 'q1',
        startOffset: 0,
        endOffset: 5,
        codedText: FORMULA_CODED_TEXT,
        note: '=note()',
        annotation: '=annotation()',
      },
    ],
    cases: [{ id: 'c1', name: FORMULA_CASE_NAME, attributes: null }],
  };
}

async function loadExport() {
  const buffer = await generateExcelExport(makeData());
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  return wb;
}

describe('generateExcelExport formula-injection handling', () => {
  it('keeps the Codings sheet text exactly as the researcher wrote it', async () => {
    const wb = await loadExport();
    const ws = wb.getWorksheet('Codings')!;
    const row = ws.getRow(2);
    expect(row.getCell(3).value).toBe(FORMULA_CODED_TEXT);
    expect(row.getCell(1).value).toBe('-Interview 1');
    expect(row.getCell(6).value).toBe('=note()');
    expect(row.getCell(7).value).toBe('=annotation()');
  });

  it('marks risky Codings cells as text so they are never evaluated', async () => {
    const wb = await loadExport();
    const ws = wb.getWorksheet('Codings')!;
    const cell = ws.getRow(2).getCell(3);
    expect(cell.type).toBe(ExcelJS.ValueType.String);
    expect(cell.formula).toBeUndefined();
    expect(cell.numFmt).toBe('@');
  });

  it('guards the Codebook sheet the same way it guards Codings', async () => {
    const wb = await loadExport();
    const ws = wb.getWorksheet('Codebook')!;
    const nameCell = ws.getRow(2).getCell(1);
    expect(nameCell.value).toBe(FORMULA_CODE_NAME);
    expect(nameCell.formula).toBeUndefined();
    expect(nameCell.numFmt).toBe('@');

    // The child code's parent column carries the same untrusted text.
    const parentCell = ws.getRow(3).getCell(4);
    expect(parentCell.value).toBe(FORMULA_CODE_NAME);
    expect(parentCell.numFmt).toBe('@');
  });

  it('guards Case Matrix headers and case names', async () => {
    const wb = await loadExport();
    const ws = wb.getWorksheet('Case Matrix')!;
    const header = ws.getRow(1);
    expect(header.getCell(2).value).toBe(FORMULA_CODE_NAME);
    expect(header.getCell(2).numFmt).toBe('@');
    expect(header.getCell(3).value).toBe(FORMULA_MATRIX_CODE);
    expect(header.getCell(3).numFmt).toBe('@');

    const caseCell = ws.getRow(2).getCell(1);
    expect(caseCell.value).toBe(FORMULA_CASE_NAME);
    expect(caseCell.numFmt).toBe('@');
  });

  it('never emits a formula cell anywhere in the workbook', async () => {
    const wb = await loadExport();
    wb.eachSheet((ws) => {
      ws.eachRow((row) => {
        row.eachCell((cell) => {
          expect(cell.type).not.toBe(ExcelJS.ValueType.Formula);
        });
      });
    });
  });

  it('still counts codings per case in the matrix', async () => {
    const wb = await loadExport();
    const ws = wb.getWorksheet('Case Matrix')!;
    expect(ws.getRow(2).getCell(2).value).toBe(1);
    expect(ws.getRow(2).getCell(3).value).toBe(0);
  });
});
