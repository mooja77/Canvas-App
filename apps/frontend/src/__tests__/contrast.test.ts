import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * Pins the WCAG AA contrast (4.5:1 normal text) of the text colour pairs that
 * were measured failing on 12 Nov 2026 and fixed at token / class level.
 * Hex values are the Tailwind v3 default grays plus the ink/ochre/brand scales
 * from tailwind.config.js.
 */
const gray = {
  50: '#F9FAFB', 300: '#D1D5DB', 400: '#9CA3AF', 500: '#6B7280', 600: '#4B5563', 700: '#374151', 800: '#1F2937', 900: '#111827',
  white: '#FFFFFF',
} as const;
const brand = { 200: '#C7D2FE', 400: '#818CF8' } as const;
const ink = { 50: '#F4F6F8', 300: '#9CA7B9', 500: '#475569', 800: '#16213D', 900: '#0B1530', 950: '#050B1F' } as const;
const ochre = { 300: '#DDB761', 400: '#CC9C3A', 500: '#B7841F', 700: '#724F10' } as const;

function luminance(hex: string): number {
  const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
}
export function contrast(a: string, b: string): number {
  const [x, y] = [luminance(a), luminance(b)].sort((p, q) => q - p);
  return (x + 0.05) / (y + 0.05);
}
const AA = 4.5;
const src = (p: string) => readFileSync(resolve(__dirname, '..', p), 'utf8');

describe('WCAG AA contrast of corrected text pairs', () => {
  const pairs: Array<[string, string, string]> = [
    ['placeholder light: gray-500 on white', gray[500], gray.white],
    ['placeholder dark: gray-300 on gray-700', gray[300], gray[700]],
    ['status bar light: gray-500 on gray-50', gray[500], gray[50]],
    ['status bar dark: gray-400 on gray-800', gray[400], gray[800]],
    ['login tab active dark: brand-200 on gray-600', brand[200], gray[600]],
    ['login footer links light: gray-600 on gray-50', gray[600], gray[50]],
    ['login footer links dark: gray-400 on gray-900', gray[400], gray[900]],
    ['legal links dark: brand-400 on gray-900', brand[400], gray[900]],
    ['vs source note dark: gray-400 on gray-800', gray[400], gray[800]],
    ['brand-v2 fg-subtle light: ink-500 on ink-50', ink[500], ink[50]],
    ['brand-v2 fg-subtle dark: ink-300 on ink-800', ink[300], ink[800]],
    ['brand-v2 accent text light: ochre-700 on ink-50', ochre[700], ink[50]],
    ['brand-v2 accent text dark: ochre-300 on ink-950', ochre[300], ink[950]],
    ['brand-v2 primary button: ink-950 on ochre-500', ink[950], ochre[500]],
    ['brand-v2 primary button hover: ink-950 on ochre-400', ink[950], ochre[400]],
  ];
  it.each(pairs)('%s >= 4.5:1', (_name, fg, bg) => {
    expect(contrast(fg, bg)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps the measured-failing pairs failing (sanity check for the calculator)', () => {
    expect(contrast(gray[400], gray.white)).toBeLessThan(AA); // 2.54
    expect(contrast(brand[200], gray[600])).toBeGreaterThanOrEqual(AA);
    expect(contrast('#A5B4FC', gray[600])).toBeLessThan(AA); // old login tab, 3.79
    expect(contrast(ochre[500], ink[50])).toBeLessThan(AA); // old brand-v2 link, 3.06
  });

  it('source files use the corrected classes and tokens', () => {
    const css = src('index.css');
    expect(css).toContain('placeholder:text-gray-500 dark:placeholder:text-gray-300');
    expect(css).toMatch(/input::placeholder,\s*textarea::placeholder\s*\{\s*color: theme\('colors\.gray\.500'\)/);
    expect(css).toContain('text-[10px] text-gray-500 backdrop-blur-md');
    const login = src('pages/LoginPage.tsx');
    expect(login).not.toContain('dark:text-brand-300');
    expect(login).toContain('text-xs text-gray-600 dark:text-gray-400 mt-6');
    expect(src('pages/PrivacyPage.tsx')).not.toMatch(/className="text-brand-600 hover:underline"/);
    expect(src('pages/VsIndexPage.tsx')).toContain('<em className="text-gray-500 dark:text-gray-400">');
    const v2 = src('brand-v2.css');
    expect(v2).toContain("--bv2-accent-text: theme('colors.ochre.700')");
    expect(v2).toContain("--fg-subtle: theme('colors.ink.500')");
    expect(v2).toContain("--fg-subtle: theme('colors.ink.300')");
  });
});
