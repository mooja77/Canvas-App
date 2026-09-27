import { describe, it, expect } from 'vitest';
import { parseCsvRecords } from '../../../utils/csv';
import { agreementReportCsv, kappaReportCsv } from './intercoderExport';

// The landing page promises a "methods-paper-ready CSV export"; both intercoder
// reports used to download plain-text .txt files.
describe('intercoder CSV export', () => {
  it('agreement report is a real two-column CSV with numbers as numbers', () => {
    const csv = agreementReportCsv({
      method: "Krippendorff's alpha (nominal)",
      alpha: 0.81234,
      interpretation: 'Almost Perfect',
      nCoders: 2,
      coderNames: ['You', 'Seán Ó Briain'],
      transcriptTitle: 'Interview, clinic "B"',
      nUnits: 40,
      nObservations: 80,
      nSegments: 20,
      unattributedCodings: 3,
    });
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('\r\n');
    const rows = parseCsvRecords(csv);
    expect(rows[0]).toEqual(['Measure', 'Value']);
    const map = new Map(rows.map((r) => [r[0], r[1]]));
    expect(map.get('Score')).toBe('0.812');
    expect(map.get('Coder names')).toBe('You; Seán Ó Briain');
    expect(map.get('Transcript')).toBe('Interview, clinic "B"');
    expect(map.get('Unattributed codings excluded')).toBe('3');
    expect(map.get('Coverage caveat')).toMatch(/excluded/);
    expect(rows.every((r) => r.length === 2)).toBe(true);
  });

  it('kappa report has one row per transcript plus a total, keeps negative kappa numeric, defuses formulas', () => {
    const csv = kappaReportCsv({
      codeA: '=HYPERLINK("http://evil.example")',
      codeB: 'Staffing',
      unit: 'paragraph',
      kappa: -0.25,
      interpretation: 'Poor',
      observedAgreement: 0.5,
      expectedAgreement: 0.6,
      totalUnits: 10,
      both: 2,
      onlyA: 3,
      onlyB: 2,
      neither: 3,
      perTranscript: [
        { title: 'T1', segments: 6, both: 1, onlyA: 2, onlyB: 1, neither: 2, kappa: -0.2 },
        { title: 'T2', segments: 4, both: 1, onlyA: 1, onlyB: 1, neither: 1, kappa: 0 },
      ],
    });
    const rows = parseCsvRecords(csv);
    expect(rows).toHaveLength(4);
    expect(rows[0][0]).toBe('Transcript');
    expect(rows[0]).toContain("Cohen's kappa");
    const width = rows[0].length;
    expect(rows.every((r) => r.length === width)).toBe(true);
    const kappaCol = rows[0].indexOf("Cohen's kappa");
    expect(rows[1][kappaCol]).toBe('-0.2');
    expect(rows[3][0]).toBe('All transcripts');
    expect(rows[3][kappaCol]).toBe('-0.25');
    // A code name that looks like a formula is written as inert text.
    expect(rows[1][1].startsWith("'=")).toBe(true);
    // The raw file quotes text but not numbers.
    expect(csv).toContain(',-0.25,');
  });
});
