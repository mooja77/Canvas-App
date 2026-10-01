import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('prerendered institutional claims', () => {
  it('does not advertise unavailable controls in crawler-facing metadata', () => {
    // The frontend workspace's test command runs from apps/frontend. Vite
    // rewrites import.meta.url for jsdom, so do not use it as a filesystem URL.
    const source = readFileSync('scripts/prerender-marketing.mjs', 'utf8');
    const page = readFileSync('src/pages/ForInstitutionsPage.tsx', 'utf8');
    const description =
      'Security documentation, deployment details, audit trails and a dedicated research contact for institutional review.';
    expect(page).toContain(description);
    expect(source).toContain(description);
    expect(source).not.toContain('SSO + SCIM, DPA, BAA, custom retention, EU residency');
  });
});
