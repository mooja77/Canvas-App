import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const frontendRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

describe('/signup route and Cloudflare Pages redirect (qualcanvas-22)', () => {
  it('redirects /signup to /login?mode=register in public/_redirects', () => {
    const redirects = readFileSync(resolve(frontendRoot, 'public/_redirects'), 'utf8');
    expect(redirects).toMatch(/^\/signup\s+\/login\?mode=register\s+301$/m);
  });

  it('redirects /signup to /login?mode=register in App.tsx for SPA navigation', () => {
    const appTsx = readFileSync(resolve(frontendRoot, 'src/App.tsx'), 'utf8');
    expect(appTsx).toContain('<Route path="/signup" element={<Navigate to="/login?mode=register" replace />} />');
  });
});
