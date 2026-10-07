import { describe, expect, it } from 'vitest';
import { updateTranscriptSchema } from './validation.js';

describe('existing transcript analysis metadata validation', () => {
  it('preserves explicitly supplied dates and coordinates rather than silently stripping them', () => {
    const input = { eventDate: '2026-10-07T12:30:00Z', latitude: 51.9, longitude: -8.5, locationName: '  Cork  ' };
    expect(updateTranscriptSchema.parse(input)).toEqual({ ...input, locationName: 'Cork' });
  });
  it('allows explicit removal without inventing zero coordinates or a date', () => {
    const input = { eventDate: null, latitude: null, longitude: null, locationName: null };
    expect(updateTranscriptSchema.parse(input)).toEqual(input);
  });
  it('preserves legitimate zero coordinates', () => {
    expect(updateTranscriptSchema.parse({ latitude: 0, longitude: 0 })).toEqual({ latitude: 0, longitude: 0 });
  });
  it.each([
    { eventDate: 'not-a-date' },
    { eventDate: '2026-02-30T12:30:00Z' },
    { latitude: 91, longitude: 0 },
    { latitude: 0, longitude: -181 },
    { latitude: Number.NaN, longitude: 0 },
    { latitude: 0, longitude: Number.POSITIVE_INFINITY },
    { latitude: 52 },
    { longitude: -8 },
    { latitude: null, longitude: 0 },
    { locationName: 'x'.repeat(201) },
  ])('rejects invalid or incomplete metadata %j', (input) => {
    expect(updateTranscriptSchema.safeParse(input).success).toBe(false);
  });
  it('retains existing title/content/case update compatibility', () => {
    const input = { title: 'Interview', content: 'Original text', caseId: null };
    expect(updateTranscriptSchema.parse(input)).toEqual(input);
  });
});
