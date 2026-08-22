import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('production security headers', () => {
  const headers = readFileSync(resolve(process.cwd(), 'public/_headers'), 'utf8');
  const csp = headers.split(/\r?\n/).find((line) => line.trim().startsWith('Content-Security-Policy:'));
  const directive = (name: string) => {
    const value = csp
      ?.replace(/^\s*Content-Security-Policy:\s*/, '')
      .split(';')
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${name} `));

    expect(value, `${name} directive`).toBeDefined();
    return value?.split(/\s+/).slice(1) ?? [];
  };

  it('permits only the privacy-enhanced YouTube embed origin', () => {
    expect(csp).toContain('frame-src');
    expect(csp).toContain('https://www.youtube-nocookie.com');
    expect(csp).not.toContain('https://www.youtube.com');
  });

  it('keeps clickjacking and plugin protections enabled', () => {
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
  });

  it('permits the exact post-consent GA4, Ads and Meta runtime origins', () => {
    expect(directive('script-src')).toEqual(
      expect.arrayContaining([
        'https://www.googletagmanager.com',
        'https://connect.facebook.net',
        'https://googleads.g.doubleclick.net',
      ]),
    );
    expect(directive('connect-src')).toEqual(
      expect.arrayContaining([
        'https://analytics.google.com',
        'https://region1.analytics.google.com',
        'https://stats.g.doubleclick.net',
        'https://ad.doubleclick.net',
        'https://googleads.g.doubleclick.net',
        'https://www.google.com',
        'https://connect.facebook.net',
        'https://www.facebook.com',
      ]),
    );
    expect(directive('img-src')).toEqual(
      expect.arrayContaining([
        'https://googleads.g.doubleclick.net',
        'https://www.google.com',
        'https://www.google.ie',
        'https://www.facebook.com',
      ]),
    );
  });

  it('does not replace exact tracking origins with broad provider sources', () => {
    const trackingDirectives = [...directive('script-src'), ...directive('connect-src'), ...directive('img-src')];

    expect(trackingDirectives).not.toContain('*');
    expect(trackingDirectives).not.toContain('https:');
    expect(trackingDirectives).not.toContain('https://*.google.com');
    expect(trackingDirectives).not.toContain('https://*.doubleclick.net');
    expect(trackingDirectives).not.toContain('https://*.facebook.net');
    expect(trackingDirectives).not.toContain('https://*.facebook.com');
  });
});
