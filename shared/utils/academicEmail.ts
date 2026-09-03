/**
 * Recognise institution-managed academic email domains without assuming the
 * US-only `.edu` convention. Email verification still proves control of the
 * address; this function only establishes that its domain is academic.
 */
const IRISH_ACADEMIC_DOMAINS = new Set([
  'atu.ie',
  'dcu.ie',
  'iadt.ie',
  'mic.ul.ie',
  'mtu.ie',
  'mu.ie',
  'ncad.ie',
  'rcsi.ie',
  'setu.ie',
  'tcd.ie',
  'tus.ie',
  'ucd.ie',
  'ucc.ie',
  'universityofgalway.ie',
  'ul.ie',
]);

// A hostname label: ASCII letters, digits and hyphens only. Anything else
// (a zero-width space, NUL, a non-breaking space) is not a label, so a domain
// like `evil.com<ZWSP>.edu` never reaches the suffix checks.
const LABEL = /^[a-z0-9-]+$/;

export function isAcademicEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1 || normalized.indexOf('@') !== at) return false;
  const domain = normalized.slice(at + 1).replace(/\.$/, '');
  if (!domain) return false;
  const labels = domain.split('.');
  if (!labels.every((label) => LABEL.test(label))) return false;

  // An academic suffix needs at least one institution label in front of it:
  // `mit.edu` and `cam.ac.uk` are universities, bare `edu` / `ac.uk` /
  // `edu.au` / `edu.ie` are not.
  const last = labels[labels.length - 1];
  const secondLast = labels[labels.length - 2];
  if (labels.length >= 2 && last === 'edu') return true;
  if (labels.length >= 3 && (secondLast === 'ac' || secondLast === 'edu') && /^[a-z]{2}$/.test(last)) return true;
  return [...IRISH_ACADEMIC_DOMAINS].some(
    (institution) => domain === institution || domain.endsWith(`.${institution}`),
  );
}
