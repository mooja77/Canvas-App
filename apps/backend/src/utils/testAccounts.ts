/**
 * One definition of "this account is a fixture, not a customer".
 *
 * There used to be two, side by side in adminRoutes.ts, and they disagreed:
 * `isTestEmail()` matched bare substrings ('test', 'demo', 'qa', 'seed'), while
 * `realUsersWhere` matched anchored prefixes. The same admin page therefore
 * reported two different real-user counts, and four seeded fixture accounts
 * (`*.test@`-style local parts and a `.demo` domain) leaked into the activation
 * funnel while being excluded from the user list beside it. A funnel built on a
 * cohort you cannot define is not evidence.
 *
 * The rules below are the single source of truth. The Prisma filter is DERIVED
 * from this predicate rather than written out a second time, so the two cannot
 * drift again.
 */

/** Reserved and internal-product domains. Anything here is never a customer. */
const FIXTURE_DOMAIN_SUFFIXES = [
  // RFC 2606 / RFC 6761 reserved: can never receive mail.
  '@example.com',
  '@example.org',
  '@example.net',
  '.test',
  '.demo',
  '.invalid',
  '.localhost',
  // RFC 6762 reserved for mDNS; never a routable mailbox.
  '.local',
  // Disposable and sibling-product domains used by our own fixtures.
  '@test.com',
  '@mailinator.com',
  '@x.com',
  '@staffhubtest.com',
  '@spamshield.app',
  '@jewelvalue.app',
  '@smartcashapp.net',
  '@staffhubapp.com',
  '@mygrowthmap.net',
  '@shopify.com',
];

/**
 * Fixture words. Matched as whole TOKENS of the local part, never as
 * substrings: `maria.testa@unibo.it`, `j.seedorf@uva.nl`, `p.demoulin@ulb.be`
 * and `contest.winner@ucc.ie` are real researchers, and substring matching
 * silently deleted all four from every count.
 */
const FIXTURE_TOKENS = ['test', 'demo', 'qa', 'e2e', 'smoke', 'fake', 'seed', 'cors', 'dummy', 'sample'];

/** Delimiters that bound a token inside a local part. */
const TOKEN_DELIMITERS = /[.\-_+]/;

/** Operator accounts. Real people, but not customers, so not in customer counts. */
export const INTERNAL_EMAILS = ['mooja77@gmail.com', 'john@mooresjewellers.com', 'john@jmsdevlab.com'];

/**
 * Known fixtures whose addresses look entirely ordinary. Patterns cannot catch
 * these and should not be contorted into trying; list them explicitly instead.
 * Keep a reason against each so the list can be audited later.
 */
export const KNOWN_FIXTURE_EMAILS: string[] = [
  // Seeded UX-research personas, created in pairs on 2026-04-09 alongside
  // jamie.ux.test@startup.io, no canvases, never active.
  'sarah.ux.onboard@startup.io',
  'sarah.ux.onboard2@startup.io',
];

/**
 * True when `email` belongs to a fixture, an operator, or an internal alias.
 *
 * A missing address counts as a fixture: every real signup has one, so a blank
 * is a seeded or broken row either way, and counting it as a customer would
 * overstate the number that matters most.
 */
export function isTestAccountEmail(email: string | null | undefined): boolean {
  if (!email) return true;
  const lower = email.trim().toLowerCase();
  if (!lower.includes('@')) return true;

  if (INTERNAL_EMAILS.includes(lower)) return true;
  if (KNOWN_FIXTURE_EMAILS.includes(lower)) return true;

  // Owner plus-aliases: mooja77+anything@gmail.com.
  if (/^mooja77\+[^@]*@gmail\.com$/.test(lower)) return true;

  if (FIXTURE_DOMAIN_SUFFIXES.some((suffix) => lower.endsWith(suffix))) return true;

  const localPart = lower.slice(0, lower.lastIndexOf('@'));
  const tokens = localPart.split(TOKEN_DELIMITERS).filter(Boolean);
  return tokens.some((token) => FIXTURE_TOKENS.includes(token));
}

/**
 * The ids of every account that is NOT a fixture.
 *
 * The predicate above cannot be expressed as a Prisma filter without writing
 * the rules a second time in a different language, which is how the two
 * definitions drifted apart in the first place. So the filter is derived: read
 * the addresses, apply the one predicate, and filter by the resulting ids.
 *
 * This is an admin-only analytics path over a table with tens of rows, so the
 * extra read is free. If the user table ever reaches the tens of thousands,
 * replace the `in` list with a generated-column or materialised flag on User,
 * set by this same predicate at write time; do not reintroduce a second copy
 * of the rules.
 */
export async function getRealUserIds(client: {
  user: { findMany: (args: { select: { id: true; email: true } }) => Promise<{ id: string; email: string }[]> };
}): Promise<string[]> {
  const users = await client.user.findMany({ select: { id: true, email: true } });
  return users.filter((user) => !isTestAccountEmail(user.email)).map((user) => user.id);
}
