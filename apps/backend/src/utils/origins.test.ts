import { afterEach, describe, expect, it } from 'vitest';
import { corsOrigin, isAllowedOrigin } from './origins.js';

describe('origin allowlist helpers', () => {
  afterEach(() => {
    delete process.env.ALLOWED_ORIGINS;
    delete process.env.CORS_ORIGIN;
    delete process.env.FRONTEND_URL;
    delete process.env.NODE_ENV;
  });

  it('allows exact configured origins', () => {
    process.env.ALLOWED_ORIGINS = 'https://app.example.com';
    expect(isAllowedOrigin('https://app.example.com')).toBe(true);
    expect(isAllowedOrigin('https://evil.example.com')).toBe(false);
  });

  it('allows canonical and preview Cloudflare Pages origins over HTTPS', () => {
    expect(isAllowedOrigin('https://qualcanvas.pages.dev')).toBe(true);
    expect(isAllowedOrigin('https://85df13c9.qualcanvas.pages.dev')).toBe(true);
  });

  it('rejects non-HTTPS Cloudflare Pages origins', () => {
    expect(isAllowedOrigin('http://85df13c9.qualcanvas.pages.dev')).toBe(false);
  });

  it('uses the dynamic allowlist for production CORS callbacks', () => {
    process.env.NODE_ENV = 'production';
    const callback = (_err: Error | null, allow?: boolean) => {
      expect(allow).toBe(true);
    };
    corsOrigin('https://85df13c9.qualcanvas.pages.dev', callback);
  });

  it('allows requests without an origin header', () => {
    process.env.NODE_ENV = 'production';
    const callback = (_err: Error | null, allow?: boolean) => {
      expect(allow).toBe(true);
    };
    corsOrigin(undefined, callback);
  });
});
