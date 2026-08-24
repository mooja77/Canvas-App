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

  // Caption files have block structure: an optional cue index, then a timing
  // line, then one or more TEXT lines, then a blank line. Everything after a
  // timing line and before the next blank is caption text - including a line
  // that happens to be all digits. Tracking this is the whole fix for numeric
  // answers being deleted; a line-by-line rule cannot tell "14" the answer
  // from "14" the cue index.
  let inCueText = false;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    if (!line) {
      inCueText = false; // blank line ends the cue
      continue;
    }
    if (/^WEBVTT/i.test(line)) continue;
    // Skip NOTE / STYLE / REGION blocks up to the next blank line.
    if (/^(NOTE|STYLE|REGION)\b/i.test(line)) {
      while (i + 1 < lines.length && lines[i + 1].trim() !== '') i++;
      continue;
    }
    // An all-digits line is a cue INDEX only in index position - i.e. before
    // this cue's timing line. Once we are past the timing line it is caption
    // TEXT. Skipping every numeric line regardless deleted the answer to "how
    // many staff did you have?" ("14"), "what was the budget?" ("250000"),
    // ages, years and Likert responses: silently, and exactly the answers a
    // researcher is most likely to want to quote.
    if (!inCueText && /^\d+$/.test(line)) continue; // SRT cue index
    if (line.includes('-->')) {
      inCueText = true; // everything up to the next blank is caption text
      continue; // timestamp / cue-settings line
    }

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
