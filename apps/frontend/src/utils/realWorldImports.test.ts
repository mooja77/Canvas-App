import { describe, it, expect } from 'vitest';
import { parseTranscriptFile } from './transcriptFiles';

/**
 * Files a researcher actually has, through the entry point the upload modal
 * calls (FileUploadModal.tsx -> parseTranscriptFile).
 *
 * The unit tests beside each helper pin the individual defects. This file asks
 * a different question: does a real export from Excel, Qualtrics, Zoom or Otter
 * survive the whole path? It exists because the activation funnel showed the
 * product losing nearly half its users at exactly this step (11 created a
 * project, 6 ever added a transcript), and every blocking defect found in the
 * 2026-09-02 bug hunt was on this path.
 *
 * A byte-order mark is written explicitly as ﻿ rather than pasted, so the
 * fixture cannot be silently normalised away by an editor.
 */
const BOM = '﻿';

describe('real-world transcript imports', () => {
  it('imports an Excel "CSV UTF-8" export (BOM, every field quoted, CRLF)', () => {
    // Until 2026-09-03 this failed outright: the BOM stopped the opening quote
    // being recognised, so the header cell read as `"Title` and no row matched.
    const text =
      BOM +
      '"Title","Content"\r\n' +
      '"Interview 01","I felt the support was there when I needed it."\r\n' +
      '"Interview 02","Nobody explained what would happen next."\r\n';

    expect(parseTranscriptFile('interviews.csv', text)).toEqual([
      { title: 'Interview 01', content: 'I felt the support was there when I needed it.' },
      { title: 'Interview 02', content: 'Nobody explained what would happen next.' },
    ]);
  });

  it('imports a Qualtrics export: quoted commas and a newline inside one response', () => {
    const text =
      BOM +
      '"ResponseId","Q1 - What worked?"\r\n' +
      '"R_1abc","The training, especially the first week, was useful."\r\n' +
      '"R_2def","Two things.\nFirst the pace. Second the people."\r\n';

    const parsed = parseTranscriptFile('qualtrics.csv', text);
    expect(parsed).toHaveLength(2);
    // The comma inside the quoted answer must not split the field.
    expect(parsed[0].content).toBe('The training, especially the first week, was useful.');
    // The embedded newline must survive as part of the same response.
    expect(parsed[1].content).toBe('Two things.\nFirst the pace. Second the people.');
    // "ResponseId" / "Q1 - What worked?" is a header, not a participant.
    expect(parsed.map((p) => p.title)).not.toContain('ResponseId');
  });

  it('keeps every row of a CSV containing an inch mark', () => {
    // An unquoted " used to open a quoted field mid-value and swallow the rest
    // of the file: three participants became one.
    const text =
      'Title,Content\n' +
      'P1,I am 6" tall and the desk did not fit\n' +
      'P2,The second response must survive\n' +
      'P3,And the third\n';

    const parsed = parseTranscriptFile('measurements.csv', text);
    expect(parsed.map((p) => p.title)).toEqual(['P1', 'P2', 'P3']);
    expect(parsed[0].content).toContain('6" tall');
  });

  it('imports a Zoom VTT without eating caption text that starts with Note or Style', () => {
    const text =
      'WEBVTT\n\nNOTE recorded by Zoom\n\n' +
      '1\n00:00:01.000 --> 00:00:04.000\nSpeaker 1: Note that I was fourteen at the time.\n\n' +
      '2\n00:00:04.000 --> 00:00:07.000\nSpeaker 2: Style of management mattered more than pay.\n\n' +
      '3\n00:00:07.000 --> 00:00:09.000\nSpeaker 1: We went A --> B quickly, if a < b then c > d.\n';

    const [parsed] = parseTranscriptFile('zoom-call.vtt', text);
    // The real NOTE header block is still dropped.
    expect(parsed.content).not.toContain('recorded by Zoom');
    // Everything a participant said is kept, including the awkward shapes.
    expect(parsed.content).toContain('Note that I was fourteen at the time.');
    expect(parsed.content).toContain('Style of management mattered more than pay.');
    expect(parsed.content).toContain('We went A --> B quickly, if a < b then c > d.');
  });

  it('imports an SRT and keeps an answer that is only a number', () => {
    const text =
      '1\n00:00:01,000 --> 00:00:03,000\nHow many staff were there?\n\n' +
      '2\n00:00:03,000 --> 00:00:05,000\n14\n\n' +
      '3\n00:00:05,000 --> 00:00:07,000\nAnd that was enough?\n';

    const [parsed] = parseTranscriptFile('otter.srt', text);
    expect(parsed.content).toContain('How many staff were there?');
    // "14" is the answer, not a cue index.
    expect(parsed.content).toContain('14');
    expect(parsed.content).toContain('And that was enough?');
  });

  it('imports plain text unchanged, including smart quotes and a formula-looking line', () => {
    const text =
      'Interviewer: How did you find it?\n\n' +
      'P1: It was — how do I put this — “fine”, mostly.\n' +
      '=SUM(A1:A2) was in my notes, do not evaluate it.\n';

    const [parsed] = parseTranscriptFile('interview.txt', text);
    expect(parsed.content).toContain('“fine”');
    expect(parsed.content).toContain('—');
    // Nothing on the import side may mangle a line that looks like a formula;
    // neutralising belongs to CSV export, not to stored research text.
    expect(parsed.content).toContain('=SUM(A1:A2)');
  });
});
