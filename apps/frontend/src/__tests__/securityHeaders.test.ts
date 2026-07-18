import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('production security headers', () => {
  const headers = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8');
  const csp = headers.split(/\r?\n/).find((line) => line.trim().startsWith('Content-Security-Policy:'));

  it('permits only the privacy-enhanced YouTube embed origin', () => {
    expect(csp).toContain('frame-src');
    expect(csp).toContain('https://www.youtube-nocookie.com');
    expect(csp).not.toContain('https://www.youtube.com');
  });

  it('keeps clickjacking and plugin protections enabled', () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });
});
