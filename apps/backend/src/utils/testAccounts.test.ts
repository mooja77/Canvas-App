import { describe, it, expect } from 'vitest';
import { isTestAccountEmail, getRealUserIds, INTERNAL_EMAILS, KNOWN_FIXTURE_EMAILS } from './testAccounts.js';

/**
 * These rules decide who counts as a customer, so they decide what every admin
 * number means. Two things must hold: no real researcher is ever discarded,
 * and no seeded fixture is ever counted.
 */
describe('isTestAccountEmail', () => {
  it('keeps researchers whose addresses merely contain a fixture word', () => {
    // Every one of these was silently dropped by the old substring filter.
    for (const email of [
      'researcher@qu.edu.qa',
      'maria.testa@unibo.it',
      'j.seedorf@uva.nl',
      'contest.winner@ucc.ie',
      'p.demoulin@ulb.be',
      'a.demossier@bristol.ac.uk',
      'e.fakeye@ui.edu.ng',
      'k.smokey@ed.ac.uk',
      'seedhouse@york.ac.uk',
      'qadir.hussain@lums.edu.pk',
    ]) {
      expect(isTestAccountEmail(email), email).toBe(false);
    }
  });

  it('catches fixtures whose local part carries a fixture word as a token', () => {
    // These four are the ones that leaked past the anchored-prefix rules and
    // reached the activation cohort while the user list excluded them.
    for (const email of [
      'jamie.ux.test@startup.io',
      'dr.chen.test@university.edu',
      'marcus.student.test@gmail.com',
      'mary.oshaughnessy@wiseshift.demo',
      'qa-bot@corp.com',
      'demo.account@ucc.ie',
      'seed-user@uva.nl',
      'e2e-runner@unibo.it',
      'smoke.check@qu.edu.qa',
      'anna+e2e@gmail.com',
      'Test.Upper@ucc.ie',
    ]) {
      expect(isTestAccountEmail(email), email).toBe(true);
    }
  });

  it('catches reserved and internal-product domains', () => {
    for (const email of [
      'someone@example.com',
      'someone@example.org',
      'someone@test.local',
      'someone@qualcanvas.test',
      'someone@anything.demo',
      'someone@mailinator.com',
      'someone@shopify.com',
    ]) {
      expect(isTestAccountEmail(email), email).toBe(true);
    }
  });

  it('treats operator accounts and their plus-aliases as non-customers', () => {
    for (const email of INTERNAL_EMAILS) expect(isTestAccountEmail(email)).toBe(true);
    expect(isTestAccountEmail('mooja77+qc-coder@gmail.com')).toBe(true);
    expect(isTestAccountEmail('MOOJA77+Canary@Gmail.com')).toBe(true);
    // A different person who happens to use plus-addressing is not internal.
    expect(isTestAccountEmail('someone+notes@gmail.com')).toBe(false);
  });

  it('honours the explicit list for fixtures no pattern can catch', () => {
    for (const email of KNOWN_FIXTURE_EMAILS) expect(isTestAccountEmail(email)).toBe(true);
  });

  it('treats a missing or malformed address as a fixture', () => {
    for (const email of [null, undefined, '', '   ', 'not-an-address']) {
      expect(isTestAccountEmail(email as string | null | undefined)).toBe(true);
    }
  });
});

describe('getRealUserIds', () => {
  it('returns only the ids whose addresses pass the one predicate', async () => {
    const client = {
      user: {
        findMany: async () => [
          { id: 'keep-1', email: 'b.goodwin@ucc.ie' },
          { id: 'keep-2', email: 'maria.testa@unibo.it' },
          { id: 'drop-1', email: 'jamie.ux.test@startup.io' },
          { id: 'drop-2', email: 'mary.oshaughnessy@wiseshift.demo' },
          { id: 'drop-3', email: 'testuser-1@example.com' },
          { id: 'drop-4', email: 'mooja77@gmail.com' },
        ],
      },
    };
    await expect(getRealUserIds(client)).resolves.toEqual(['keep-1', 'keep-2']);
  });
});
