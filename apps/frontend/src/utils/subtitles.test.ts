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
