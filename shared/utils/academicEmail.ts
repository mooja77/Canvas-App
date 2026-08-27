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

export function isAcademicEmail(email: string): boolean {
  const normalized = email.trim().toLowerCase();
  const at = normalized.lastIndexOf('@');
  if (at <= 0 || at === normalized.length - 1 || normalized.indexOf('@') !== at) return false;
  const domain = normalized.slice(at + 1).replace(/\.$/, '');
  if (!domain || domain.includes('..')) return false;
  if (domain.endsWith('.edu')) return true;
  if (/(?:^|\.)(?:ac|edu)\.[a-z]{2}$/.test(domain)) return true;
  return [...IRISH_ACADEMIC_DOMAINS].some(
    (institution) => domain === institution || domain.endsWith(`.${institution}`),
  );
}
