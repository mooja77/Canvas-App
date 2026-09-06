import { describe, it, expect } from 'vitest';
import { TEMPLATES } from './templates.js';

/**
 * The starter templates are the first thing a new researcher sees: a small
 * coded study. The instantiate route anchors each seeded coding by finding its
 * text in the transcript, and silently skips one it cannot find. That is the
 * right behaviour at runtime and the wrong thing to let drift in the fixture,
 * so every excerpt is checked here against the transcript it claims to be in.
 */
describe('starter templates', () => {
  it.each(TEMPLATES.map((t) => [t.name, t] as const))('%s: every seeded coding is found verbatim', (_name, tmpl) => {
    const transcripts = [tmpl.sampleTranscript, ...(tmpl.additionalTranscripts ?? []).map((t) => t.content)];
    expect(tmpl.sampleCodings?.length ?? 0).toBeGreaterThan(0);
    for (const sc of tmpl.sampleCodings ?? []) {
      const transcript = transcripts[sc.transcript];
      expect(transcript, `transcript index ${sc.transcript}`).toBeDefined();
      expect(tmpl.sampleQuestions[sc.question], `question index ${sc.question}`).toBeDefined();
      expect(transcript.indexOf(sc.text), `"${sc.text}"`).toBeGreaterThanOrEqual(0);
      // A snippet that occurs twice would anchor to the first occurrence, which
      // may not be the one the author meant. Keep snippets unique.
      expect(transcript.indexOf(sc.text, transcript.indexOf(sc.text) + 1), `"${sc.text}" occurs more than once`).toBe(
        -1,
      );
    }
  });

  it.each(TEMPLATES.map((t) => [t.name, t] as const))(
    '%s: reads as a small study, not a single file',
    (_name, tmpl) => {
      expect(tmpl.additionalTranscripts?.length ?? 0).toBeGreaterThanOrEqual(2);
      for (const t of tmpl.additionalTranscripts ?? []) {
        expect(t.title.length).toBeGreaterThan(0);
        expect(t.content.split(/\s+/).length).toBeGreaterThan(60);
      }
    },
  );
});
