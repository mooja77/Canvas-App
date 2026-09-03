import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * The page's entries and the Atom feed are maintained by hand in two files, so
 * they drift silently: the feed's own <updated> sat at the oldest entry's date
 * for four months while new entries were added to the page. These tests pin the
 * pairing rather than the prose.
 */
const root = resolve(__dirname, '../../');
const page = readFileSync(resolve(root, 'src/pages/ChangelogPage.tsx'), 'utf8');
const feed = readFileSync(resolve(root, 'public/changelog/feed.xml'), 'utf8');

const pageDates = [...page.matchAll(/^\s{4}date: '(\d{4}-\d{2}-\d{2})',$/gm)].map((m) => m[1]);
const feedDates = [...feed.matchAll(/^\s{4}<updated>(\d{4}-\d{2}-\d{2})T/gm)].map((m) => m[1]);

describe('changelog', () => {
  it('lists entries newest first', () => {
    expect(pageDates).toEqual([...pageDates].sort().reverse());
  });

  it('covers the newest page entries in the feed', () => {
    // The feed is a rolling window, so it need not hold every historical entry;
    // it must hold the newest one, which is what a subscriber came for.
    expect(feedDates).toContain(pageDates[0]);
  });

  it('stamps the feed with the date of its newest entry', () => {
    const feedUpdated = feed.match(/<updated>(\d{4}-\d{2}-\d{2})T[^<]*<\/updated>/)?.[1];
    expect(feedUpdated).toBe([...feedDates].sort().reverse()[0]);
  });

  it('describes the academic-pricing change with the domains the code actually accepts', () => {
    const academic = readFileSync(resolve(root, '../../shared/utils/academicEmail.ts'), 'utf8');
    const codeDomains = [...academic.matchAll(/'([a-z][a-z.]*\.ie)'/g)].map((m) => m[1]).sort();
    const entry = page.match(/They now apply to verified addresses[^']*/)?.[0] ?? '';
    const listed = [...entry.matchAll(/\b([a-z][a-z.]*\.ie)\b/g)].map((m) => m[1]).sort();
    expect(listed).toEqual(codeDomains);
  });
});
