import { describe, it, expect } from 'vitest';
import { parseSubtitles, isSubtitleExt } from './subtitles';

describe('parseSubtitles', () => {
  it('parses a basic WebVTT file, dropping header/timestamps', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:04.000',
      'Hello, thanks for joining today.',
      '',
      '00:00:04.500 --> 00:00:07.000',
      'I wanted to ask about your experience.',
      '',
    ].join('\n');
    expect(parseSubtitles(vtt)).toBe('Hello, thanks for joining today.\nI wanted to ask about your experience.');
  });

  it('parses an SRT file, dropping cue indices and timestamps', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:04,000',
      'First line.',
      '',
      '2',
      '00:00:05,000 --> 00:00:08,000',
      'Second line.',
      '',
    ].join('\n');
    expect(parseSubtitles(srt)).toBe('First line.\nSecond line.');
  });

  it('converts <v Speaker> voice tags into "Speaker:" labels', () => {
    const vtt = ['WEBVTT', '', '00:00.000 --> 00:02.000', '<v Alice>I think it went well.', ''].join('\n');
    expect(parseSubtitles(vtt)).toBe('Alice: I think it went well.');
  });

  it('strips inline tags like <c> and timestamp tags', () => {
    const vtt = ['WEBVTT', '', '00:00.000 --> 00:02.000', '<c.yellow>Important</c> <00:00:01.500>point', ''].join('\n');
    expect(parseSubtitles(vtt)).toBe('Important point');
  });

  it('collapses consecutive duplicate caption lines (rolling captions)', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00.000 --> 00:01.000',
      'same line',
      '',
      '00:01.000 --> 00:02.000',
      'same line',
      '',
      '00:02.000 --> 00:03.000',
      'next line',
      '',
    ].join('\n');
    expect(parseSubtitles(vtt)).toBe('same line\nnext line');
  });

  it('skips NOTE blocks and cue settings on the timestamp line', () => {
    const vtt = [
      'WEBVTT',
      '',
      'NOTE this is a comment',
      'spanning two lines',
      '',
      '00:00.000 --> 00:02.000 align:start position:0%',
      'Actual content.',
      '',
    ].join('\n');
    expect(parseSubtitles(vtt)).toBe('Actual content.');
  });

  it('decodes common HTML entities', () => {
    const vtt = ['WEBVTT', '', '00:00.000 --> 00:02.000', 'me &amp; you &lt;3', ''].join('\n');
    expect(parseSubtitles(vtt)).toBe('me & you <3');
  });

  it('handles CRLF line endings', () => {
    const vtt = 'WEBVTT\r\n\r\n00:00.000 --> 00:02.000\r\nWindows line.\r\n';
    expect(parseSubtitles(vtt)).toBe('Windows line.');
  });

  it('returns empty string for content with no captions', () => {
    expect(parseSubtitles('WEBVTT\n\n')).toBe('');
    expect(parseSubtitles('')).toBe('');
  });
});

describe('isSubtitleExt', () => {
  it('recognizes vtt and srt only', () => {
    expect(isSubtitleExt('vtt')).toBe(true);
    expect(isSubtitleExt('srt')).toBe(true);
    expect(isSubtitleExt('txt')).toBe(false);
    expect(isSubtitleExt(undefined)).toBe(false);
  });
});

/**
 * A caption whose text is only digits is an ANSWER, not a cue index. These are
 * headcounts, budgets, ages, years and Likert responses - the answers a
 * researcher is most likely to quote - and they were being deleted silently
 * from every Zoom, Otter and Teams caption file.
 */
describe('numeric caption text survives import', () => {
  it('keeps numeric answers in an SRT while still stripping cue indices', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:03,000',
      'How many staff did you have?',
      '',
      '2',
      '00:00:03,000 --> 00:00:05,000',
      '14',
      '',
      '3',
      '00:00:05,000 --> 00:00:07,000',
      'And the budget?',
      '',
      '4',
      '00:00:07,000 --> 00:00:09,000',
      '250000',
      '',
    ].join('\n');
    expect(parseSubtitles(srt)).toBe('How many staff did you have?\n14\nAnd the budget?\n250000');
  });

  it('keeps numeric answers in WebVTT, which has no cue-index concept at all', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00:01.000 --> 00:00:03.000',
      'How old were you?',
      '',
      '00:00:03.000 --> 00:00:05.000',
      '42',
      '',
      '00:00:05.000 --> 00:00:07.000',
      'And now?',
      '',
    ].join('\n');
    expect(parseSubtitles(vtt)).toBe('How old were you?\n42\nAnd now?');
  });

  it('keeps a numeric answer that is the final cue', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', 'How many?', '', '2', '00:00:03,000 --> 00:00:05,000', '7'].join(
      '\n',
    );
    expect(parseSubtitles(srt)).toBe('How many?\n7');
  });

  it('keeps a multi-line cue whose second line is numeric', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', 'We had roughly', '30', ''].join('\n');
    expect(parseSubtitles(srt)).toBe('We had roughly\n30');
  });
});

// Bug hunt 2026-09-02: some Zoom / Otter SRT exports omit the blank line
// between cues, so the next cue's index sits directly under the previous cue's
// text. Being past a timing line, it was emitted as caption text ("2").
describe('SRT cues without blank separator lines', () => {
  it('drops the cue index that directly follows the previous cue text', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:03,000',
      'First cue.',
      '2',
      '00:00:03,000 --> 00:00:05,000',
      'Second cue.',
      '3',
      '00:00:05,000 --> 00:00:07,000',
      'Third cue.',
    ].join('\n');
    expect(parseSubtitles(srt)).toBe('First cue.\nSecond cue.\nThird cue.');
  });

  it('keeps a numeric answer that is followed by the next cue index', () => {
    const srt = [
      '1',
      '00:00:01,000 --> 00:00:03,000',
      'How many staff did you have?',
      '2',
      '00:00:03,000 --> 00:00:05,000',
      '14',
      '3',
      '00:00:05,000 --> 00:00:07,000',
      'And the budget?',
    ].join('\n');
    expect(parseSubtitles(srt)).toBe('How many staff did you have?\n14\nAnd the budget?');
  });

  it('keeps a numeric caption line that is NOT followed by a timing line', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', 'We had roughly', '30', 'people.', ''].join('\n');
    expect(parseSubtitles(srt)).toBe('We had roughly\n30\npeople.');
  });

  it('handles the same missing separators in a WebVTT file with numeric cue identifiers', () => {
    const vtt = [
      'WEBVTT',
      '',
      '1',
      '00:00:01.000 --> 00:00:03.000',
      'One.',
      '2',
      '00:00:03.000 --> 00:00:05.000',
      'Two.',
    ].join('\n');
    expect(parseSubtitles(vtt)).toBe('One.\nTwo.');
  });
});

// M10: NOTE / STYLE / REGION are case-sensitive WebVTT block keywords and only
// exist between cues. Caption text that happens to start with "Note", "Style"
// or "Region" (or even upper-case NOTE inside a cue) is interview content.
describe('block keywords vs caption text', () => {
  it('keeps cue text starting with "Note" (mixed case) instead of dropping it to the next blank line', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00.000 --> 00:02.000',
      'Note that I was very tired by then.',
      'It was late.',
      '',
      '00:02.000 --> 00:04.000',
      'Style was never the point.',
      '',
      '00:04.000 --> 00:06.000',
      'Region managers were told nothing.',
      '',
    ].join('\n');
    expect(parseSubtitles(vtt)).toBe(
      'Note that I was very tired by then.\nIt was late.\nStyle was never the point.\nRegion managers were told nothing.',
    );
  });

  it('keeps upper-case NOTE when it is inside cue text', () => {
    const vtt = ['WEBVTT', '', '00:00.000 --> 00:02.000', 'NOTE TO SELF, she said.', 'Then she laughed.', ''].join(
      '\n',
    );
    expect(parseSubtitles(vtt)).toBe('NOTE TO SELF, she said.\nThen she laughed.');
  });

  it('still skips STYLE and REGION blocks in header position', () => {
    const vtt = [
      'WEBVTT',
      '',
      'STYLE',
      '::cue { color: yellow }',
      '',
      'REGION',
      'id:fred width:40%',
      '',
      'NOTE comment',
      '',
      '00:00.000 --> 00:02.000',
      'Real words.',
      '',
    ].join('\n');
    expect(parseSubtitles(vtt)).toBe('Real words.');
  });

  it('does not treat "NOTE:" or "NOTES" between cues as a block keyword', () => {
    const vtt = [
      'WEBVTT',
      '',
      '00:00.000 --> 00:02.000',
      'One.',
      '',
      'NOTES',
      '',
      '00:02.000 --> 00:04.000',
      'Two.',
      '',
    ].join('\n');
    // NOTES is not a NOTE block; being outside a cue it is kept as text
    // rather than silently deleting content up to the next blank line.
    expect(parseSubtitles(vtt)).toBe('One.\nNOTES\nTwo.');
  });
});

// L13: only a real timing line (digits on both sides of the arrow) is a
// timing line, and only real tags are stripped.
describe('prose arrows and angle brackets', () => {
  it('keeps a caption line that contains "-->" as prose', () => {
    const vtt = ['WEBVTT', '', '00:00.000 --> 00:02.000', 'then --> we went home', ''].join('\n');
    expect(parseSubtitles(vtt)).toBe('then --> we went home');
  });

  it('keeps "a < b then c > d" intact', () => {
    const vtt = ['WEBVTT', '', '00:00.000 --> 00:02.000', 'a < b then c > d', ''].join('\n');
    expect(parseSubtitles(vtt)).toBe('a < b then c > d');
  });

  it('still recognises SRT and WebVTT timing lines and strips real tags', () => {
    const srt = ['1', '00:00:01,000 --> 00:00:03,000', '<i>emphasis</i> <b>bold</b> <00:00:01.500>late', ''].join('\n');
    expect(parseSubtitles(srt)).toBe('emphasis bold late');
    const vtt = ['WEBVTT', '', '00:00.000 --> 00:02.000 align:start', '<v Ann>Hi</v>', ''].join('\n');
    expect(parseSubtitles(vtt)).toBe('Ann: Hi');
  });
});
