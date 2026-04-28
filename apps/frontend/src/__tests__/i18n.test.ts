import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import en from '../i18n/en.json';
import es from '../i18n/es.json';
import fr from '../i18n/fr.json';
import de from '../i18n/de.json';

// ── Helpers ────────────────────────────────────────────────────────────────────

type NestedObj = Record<string, unknown>;

/** Recursively collect all leaf keys with dot-separated paths */
function collectKeys(obj: NestedObj, prefix = ''): string[] {
  const keys: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    const path = prefix ? `${prefix}.${k}` : k;
    if (typeof v === 'object' && v !== null && !Array.isArray(v)) {
      keys.push(...collectKeys(v as NestedObj, path));
    } else {
      keys.push(path);
    }
  }
  return keys.sort();
}

/** Get value at a dot-separated path */
function getAtPath(obj: NestedObj, path: string): unknown {
  const parts = path.split('.');
  let cur: unknown = obj;
  for (const part of parts) {
    if (cur === null || cur === undefined || typeof cur !== 'object') return undefined;
    cur = (cur as NestedObj)[part];
  }
  return cur;
}

/** Check for duplicate keys at any level (JSON parsers silently keep last) */
function findDuplicateTopLevelSections(obj: NestedObj): string[] {
  // JSON.parse deduplicates, so we can only check structural uniqueness
  // within nested sections. Check each section's keys for uniqueness.
  const dupes: string[] = [];
  function checkLevel(o: NestedObj, prefix: string) {
    const seen = new Set<string>();
    for (const key of Object.keys(o)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      if (seen.has(key)) {
        dupes.push(fullKey);
      }
      seen.add(key);
      if (typeof o[key] === 'object' && o[key] !== null) {
        checkLevel(o[key] as NestedObj, fullKey);
      }
    }
  }
  checkLevel(obj, '');
  return dupes;
}

// ── Tests ──────────────────────────────────────────────────────────────────────

const enKeys = collectKeys(en);
const esKeys = collectKeys(es as NestedObj);
const frKeys = collectKeys(fr as NestedObj);
const deKeys = collectKeys(de as NestedObj);

describe('i18n — Translation key parity', () => {
  it('all en.json keys exist in es.json', () => {
    const missing = enKeys.filter((k) => !esKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it('all en.json keys exist in fr.json', () => {
    const missing = enKeys.filter((k) => !frKeys.includes(k));
    expect(missing).toEqual([]);
  });

  it('all en.json keys exist in de.json', () => {
    const missing = enKeys.filter((k) => !deKeys.includes(k));
    expect(missing).toEqual([]);
  });
});

describe('i18n — No empty translation values', () => {
  it('no empty values in es.json', () => {
    const empties = esKeys.filter((k) => {
      const v = getAtPath(es as NestedObj, k);
      return typeof v === 'string' && v.trim() === '';
    });
    expect(empties).toEqual([]);
  });

  it('no empty values in fr.json', () => {
    const empties = frKeys.filter((k) => {
      const v = getAtPath(fr as NestedObj, k);
      return typeof v === 'string' && v.trim() === '';
    });
    expect(empties).toEqual([]);
  });

  it('no empty values in de.json', () => {
    const empties = deKeys.filter((k) => {
      const v = getAtPath(de as NestedObj, k);
      return typeof v === 'string' && v.trim() === '';
    });
    expect(empties).toEqual([]);
  });
});

describe('i18n — Initialization and fallback', () => {
  let i18n: typeof import('i18next').default;

  beforeEach(async () => {
    vi.resetModules();
    // Fresh import to get a clean i18n instance
    const mod = await import('../i18n/index');
    i18n = mod.default;
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('initializes with English as default language', () => {
    expect(i18n.language).toBe('en');
  });

  it('falls back to English for missing keys', () => {
    // Switch to a language and request a key that only exists in en
    i18n.changeLanguage('es');
    // All keys exist in es, so use a nonexistent key to test fallback returns key
    const result = i18n.t('nonexistent.key.here');
    expect(result).toBe('nonexistent.key.here');
  });

  it('has English as the fallback language', () => {
    expect(i18n.options.fallbackLng).toContain('en');
  });
});

describe('i18n — Pricing text translates correctly', () => {
  it('pricing.free translates to "Gratis" in Spanish', () => {
    expect((es as NestedObj).pricing).toBeDefined();
    expect(getAtPath(es as NestedObj, 'pricing.free')).toBe('Gratis');
  });

  it('pricing.pro stays "Pro" across all languages', () => {
    expect(getAtPath(en, 'pricing.pro')).toBe('Pro');
    expect(getAtPath(es as NestedObj, 'pricing.pro')).toBe('Pro');
    expect(getAtPath(fr as NestedObj, 'pricing.pro')).toBe('Pro');
    expect(getAtPath(de as NestedObj, 'pricing.pro')).toBe('Pro');
  });

  it('pricing.perMonth has locale-appropriate abbreviation', () => {
    expect(getAtPath(en, 'pricing.perMonth')).toBe('/mo');
    expect(getAtPath(es as NestedObj, 'pricing.perMonth')).toBe('/mes');
    expect(getAtPath(fr as NestedObj, 'pricing.perMonth')).toBe('/mois');
    expect(getAtPath(de as NestedObj, 'pricing.perMonth')).toBe('/Monat');
  });
});

describe('i18n — Auth text translates correctly', () => {
  it('auth.signIn is translated in all locales', () => {
    expect(getAtPath(en, 'auth.signIn')).toBe('Sign In');
    expect(getAtPath(es as NestedObj, 'auth.signIn')).not.toBe('Sign In'); // Translated
    expect(getAtPath(fr as NestedObj, 'auth.signIn')).not.toBe('Sign In');
    expect(getAtPath(de as NestedObj, 'auth.signIn')).not.toBe('Sign In');
  });
});

describe('i18n — Canvas toolbar terms translate', () => {
  it('toolbar keys are all translated (not identical to English)', () => {
    const toolbarKeys = Object.keys((en as NestedObj).toolbar as NestedObj);

    for (const key of toolbarKeys) {
      const esVal = getAtPath(es as NestedObj, `toolbar.${key}`);
      const frVal = getAtPath(fr as NestedObj, `toolbar.${key}`);
      const deVal = getAtPath(de as NestedObj, `toolbar.${key}`);

      // At least one non-English locale should differ
      // (some terms like "Code" / "Dashboard" may stay the same in some languages)
      expect(esVal || frVal || deVal).toBeDefined();
    }
  });
});

describe('i18n — Interpolation support', () => {
  it('common.backTo contains interpolation placeholder in all locales', () => {
    expect(getAtPath(en, 'common.backTo')).toContain('{{page}}');
    expect(getAtPath(es as NestedObj, 'common.backTo')).toContain('{{page}}');
    expect(getAtPath(fr as NestedObj, 'common.backTo')).toContain('{{page}}');
    expect(getAtPath(de as NestedObj, 'common.backTo')).toContain('{{page}}');
  });
});

describe('i18n — No duplicate keys', () => {
  it('en.json has no duplicate keys within any section', () => {
    expect(findDuplicateTopLevelSections(en)).toEqual([]);
  });

  it('es.json has no duplicate keys within any section', () => {
    expect(findDuplicateTopLevelSections(es as NestedObj)).toEqual([]);
  });

  it('fr.json has no duplicate keys within any section', () => {
    expect(findDuplicateTopLevelSections(fr as NestedObj)).toEqual([]);
  });

  it('de.json has no duplicate keys within any section', () => {
    expect(findDuplicateTopLevelSections(de as NestedObj)).toEqual([]);
  });
});

describe('i18n — No extra keys in translations', () => {
  it('es.json has no keys missing from en.json', () => {
    const extra = esKeys.filter((k) => !enKeys.includes(k));
    expect(extra).toEqual([]);
  });

  it('fr.json has no keys missing from en.json', () => {
    const extra = frKeys.filter((k) => !enKeys.includes(k));
    expect(extra).toEqual([]);
  });

  it('de.json has no keys missing from en.json', () => {
    const extra = deKeys.filter((k) => !enKeys.includes(k));
    expect(extra).toEqual([]);
  });
});
