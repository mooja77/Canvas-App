import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

// Static pages in public/ are served as real pages. A root-relative icon,
// stylesheet or script that points at a file that is not shipped is a live 404.
const publicDir = resolve(process.cwd(), 'public');

function htmlFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) return htmlFiles(full);
    return name.endsWith('.html') ? [full] : [];
  });
}

describe('static public pages', () => {
  it('only reference icons, stylesheets and scripts that ship in public/', () => {
    const missing: string[] = [];
    for (const file of htmlFiles(publicDir)) {
      const html = readFileSync(file, 'utf8');
      const refs = [
        ...html.matchAll(/<link\b[^>]*\brel="(?:icon|shortcut icon|apple-touch-icon|stylesheet)"[^>]*\bhref="(\/[^"?#]+)"/g),
        ...html.matchAll(/<script\b[^>]*\bsrc="(\/[^"?#]+)"/g),
      ].map((m) => m[1]);
      for (const ref of refs) {
        // Build-time assets (/assets/*) are produced by Vite, not kept in public/.
        if (ref.startsWith('/assets/')) continue;
        if (!existsSync(join(publicDir, ref))) missing.push(`${file.slice(publicDir.length)} -> ${ref}`);
      }
    }
    expect(missing).toEqual([]);
  });
});
