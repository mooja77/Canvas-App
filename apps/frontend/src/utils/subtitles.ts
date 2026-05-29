/**
 * Parse WebVTT (.vtt) and SubRip (.srt) caption files into clean transcript
 * text. Interview researchers overwhelmingly get these from Zoom, Otter,
 * Microsoft Teams, and YouTube — but the raw files are full of cue numbers,
 * timestamps, and markup that shouldn't be coded.
 *
 * We strip all of that, turn `<v Speaker>` voice tags into "Speaker:" labels,
 * and collapse consecutive duplicate caption lines (a common artifact of
 * rolling/repeated captions). The result is plain, codeable transcript text.
 *
 * Note: progressive captions where each cue *appends* to the previous one
 * (rather than exactly repeating) are not de-duplicated here — only exact
 * consecutive repeats are collapsed.
 */
export function parseSubtitles(raw: string): string {
  const lines = raw.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  const captions: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) continue;
    if (/^WEBVTT/i.test(line)) continue;
    // Skip NOTE / STYLE / REGION blocks up to the next blank line.
    if (/^(NOTE|STYLE|REGION)\b/i.test(line)) {
      while (i + 1 < lines.length && lines[i + 1].trim() !== '') i++;
      continue;
    }
    if (/^\d+$/.test(line)) continue; // SRT cue index
    if (line.includes('-->')) continue; // timestamp / cue-settings line

    // Caption text line: convert voice tags to speaker labels, strip the rest.
    const text = line
      .replace(/<v\s+([^>]+?)>/gi, (_m, speaker: string) => `${speaker.trim()}: `)
      .replace(/<[^>]+>/g, '') // remaining tags: <c>, <00:00:00.000>, </v>, etc.
      .replace(/&nbsp;/gi, ' ')
      .replace(/&amp;/gi, '&')
      .replace(/&lt;/gi, '<')
      .replace(/&gt;/gi, '>')
      .trim();

    if (text) captions.push(text);
  }

  // Collapse consecutive exact duplicates (rolling captions repeat lines).
  const deduped: string[] = [];
  for (const c of captions) {
    if (deduped[deduped.length - 1] !== c) deduped.push(c);
  }

  return deduped.join('\n').trim();
}

/** True for file extensions this parser handles. */
export function isSubtitleExt(ext: string | undefined): ext is 'vtt' | 'srt' {
  return ext === 'vtt' || ext === 'srt';
}
