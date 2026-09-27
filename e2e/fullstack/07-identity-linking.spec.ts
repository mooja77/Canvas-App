import { test, expect } from '@playwright/test';
import {
  signup,
  newClient,
  ok,
  json,
  me,
  googleSignIn,
  googleIdToken,
  createCanvas,
  addTranscript,
  subscribe,
  sendWebhook,
  stripeEvent,
  stripeControl,
  waitForEmail,
  tokenFromLink,
  testPassword,
  uniqueEmail,
  type Session,
} from './support/api';

// Identity linking: every path that ties a person to an email address.
//
// The Google ID tokens here are RS256-signed with the harness key (support/env.ts)
// and checked by the real google-auth-library verifyIdToken; only the download
// of Google's public certificates is replaced (support/preload.mjs).

const STUDY = 'P1: The night shift was short-staffed again and nobody told the families.';

test.describe('Google sign-in vs an account pre-claimed with the same email', () => {
  test('regression: the registrant of an unverified password account loses ALL access once the real owner signs in with Google', async () => {
    // 1. Attacker registers the victim's address with a password (never verified)
    //    and keeps the session cookie from sign-up.
    const attacker = await signup('preclaim');
    const victimEmail = attacker.email;
    const planted = await createCanvas(attacker, 'Planted before the owner arrived');

    // 2. The real owner uses "Sign in with Google" for that address.
    const victim = await googleSignIn(victimEmail, { name: 'Real Owner' });
    expect(victim.status).toBe(200);
    expect(victim.body.data.user.emailVerified).toBe(true);

    // 3. The owner works in the account.
    const vSession: Session = { ctx: victim.ctx, email: victimEmail, password: '', userId: victim.body.data.user.id };
    const own = await createCanvas(vSession, 'Night-shift interviews');
    await addTranscript(vSession, own, 'P1', STUDY);
    const profile = await me(vSession);
    expect(profile.user.hasPassword).toBe(false);

    // 4. The attacker's cookie session is dead, everywhere.
    expect((await attacker.ctx.get('auth/me')).status()).toBe(401);
    expect((await attacker.ctx.get(`canvas/${own}`)).status()).toBe(401);
    expect((await attacker.ctx.get('canvas')).status()).toBe(401);

    // 5. The attacker's password no longer signs in.
    const retry = await newClient();
    const login = await retry.post('auth/email-login', { data: { email: victimEmail, password: attacker.password } });
    expect(login.status()).toBe(401);

    // 6. The owner's session is unaffected and the account's content was kept
    //    (in the innocent case, that was the owner's own earlier work).
    const list = (await ok(await victim.ctx.get('canvas'))).data.map((c: { id: string }) => c.id);
    expect(list).toEqual(expect.arrayContaining([planted, own]));

    // 7. The owner can still choose a password, via a link sent to the inbox
    //    they just proved they own.
    await ok(await (await newClient()).post('auth/forgot-password', { data: { email: victimEmail } }));
    const mail = await waitForEmail(victimEmail, /reset/i);
    const token = tokenFromLink(mail.html ?? '', '/reset-password');
    const chosen = testPassword();
    await ok(
      await (
        await newClient()
      ).post('auth/reset-password', { data: { email: victimEmail, token, newPassword: chosen } }),
    );
    const again = await newClient();
    await ok(await again.post('auth/email-login', { data: { email: victimEmail, password: chosen } }));

    // 8. The owner was told why their old password no longer works.
    expect(victim.body.data.accountSecured).toBe(true);
  });

  test('regression: a legacy access-code holder who linked someone else’s email loses the code and its session', async () => {
    // Attacker holds a legacy access code and links the victim's address to it.
    const reg = await newClient();
    const code = (await ok(await reg.post('auth/register', { data: { name: 'Legacy squatter' } }), 201)).data
      .accessCode as string;
    const legacySession = await newClient();
    await ok(await legacySession.post('auth', { data: { dashboardCode: code } }));
    const victimEmail = uniqueEmail('legacylink');
    await ok(await reg.post('auth/link-account', { data: { email: victimEmail, password: testPassword() } }));
    expect((await legacySession.get('canvas')).status()).toBe(200);

    const victim = await googleSignIn(victimEmail);
    expect(victim.status).toBe(200);

    // The access-code JWT, the code itself and the raw-code header all fail.
    expect((await legacySession.get('canvas')).status()).toBe(401);
    expect((await (await newClient()).post('auth', { data: { dashboardCode: code } })).status()).toBe(401);
    const raw = await newClient();
    expect((await raw.get('canvas', { headers: { 'x-dashboard-code': code } })).status()).toBe(401);
    // The link-account session (user JWT) is dead too.
    expect((await reg.get('auth/me')).status()).toBe(401);
    // The owner is in, and was told what happened.
    expect((await victim.ctx.get('canvas')).status()).toBe(200);
    expect(victim.body.data.accountSecured).toBe(true);
  });

  test('a VERIFIED account signing in with Google keeps its password and its other sessions', async () => {
    const owner = await signup('verifiedgoogle', { verify: true });
    const g = await googleSignIn(owner.email);
    expect(g.status).toBe(200);
    expect(g.body.data.accountSecured).toBeUndefined();
    expect((await owner.ctx.get('auth/me')).status()).toBe(200);
    await ok(
      await (await newClient()).post('auth/email-login', { data: { email: owner.email, password: owner.password } }),
    );
  });

  test('error: a Google token that is unverified, for another audience, or tampered is refused', async () => {
    const email = uniqueEmail('badgoogle');
    expect((await googleSignIn(email, { emailVerified: false })).status).toBe(401);
    expect((await googleSignIn(email, { aud: 'someone-elses-client.apps.googleusercontent.com' })).status).toBe(401);
    const ctx = await newClient();
    // A genuinely signed token whose payload was swapped for another address:
    // the signature no longer matches, so it must be refused.
    const [header, , signature] = googleIdToken(uniqueEmail('signedfor')).split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ iss: 'https://accounts.google.com', email, email_verified: true }),
    ).toString('base64url');
    const res = await ctx.post('auth/google', { data: { credential: `${header}.${forgedPayload}.${signature}` } });
    expect(res.status()).toBe(401);
    // Nothing was created for the refused address.
    const signupAfter = await (
      await newClient()
    ).post('auth/signup', {
      data: { email, password: testPassword(), name: 'Later' },
    });
    expect(signupAfter.status()).toBe(201);
  });
});

test.describe('Invites by email only reach proven addresses', () => {
  test('regression: a canvas invite to an UNVERIFIED account is refused until that address is verified', async () => {
    const owner = await signup('inviter', { verify: true }); // trial = Pro: collaborators allowed
    const squatter = await signup('invitee'); // unverified: anyone could have registered it
    const id = await createCanvas(owner, 'Confidential interviews');
    const refused = await owner.ctx.post(`canvas/${id}/collaborators`, {
      data: { email: squatter.email, role: 'editor' },
    });
    expect(refused.status()).toBe(409);
    expect((await json(refused)).error).toMatch(/verified/i);
    // Same through the raw userId form of the API.
    expect(
      (
        await owner.ctx.post(`canvas/${id}/collaborators`, { data: { userId: squatter.userId, role: 'viewer' } })
      ).status(),
    ).toBe(409);
    expect((await squatter.ctx.get(`canvas/${id}`)).status()).not.toBe(200);
  });

  test('regression: a team invite to an UNVERIFIED account is refused', async () => {
    const owner = await signup('teamowner', { verify: true });
    await subscribe(owner, 'price_qc_team_m');
    const team = (await ok(await owner.ctx.post('teams', { data: { name: 'Lab' } }), 201)).data;
    const squatter = await signup('teamsquatter');
    const res = await owner.ctx.post(`teams/${team.id}/members`, { data: { email: squatter.email } });
    expect(res.status()).toBe(409);
    const verified = await signup('teammate', { verify: true });
    // A new member is a new Team seat: the owner confirms the quoted charge (10-seats).
    await ok(
      await owner.ctx.post(`teams/${team.id}/members`, { data: { email: verified.email, confirmSeatCharge: true } }),
      201,
    );
  });
});

test.describe('After a downgrade the research record stays readable', () => {
  test('consent records and the research repository can be read on Free; creating or changing needs a paid plan', async () => {
    const s = await signup('downgradereads');
    const { subscriptionId } = await subscribe(s, 'price_qc_pro_m');
    const id = await createCanvas(s, 'Ethics study');
    const consent = (
      await ok(
        await s.ctx.post(`canvas/${id}/consent`, { data: { participantId: 'P-07', consentType: 'informed' } }),
        201,
      )
    ).data;
    const repo = (await ok(await s.ctx.post('repositories', { data: { name: 'Findings' } }), 201)).repository;
    await ok(
      await s.ctx.post(`repositories/${repo.id}/insights`, {
        data: { title: 'Staffing', content: 'Short-staffed nights' },
      }),
      201,
    );

    const sub = await stripeControl(`subscriptions/${subscriptionId}`, { status: 'canceled' });
    expect((await sendWebhook(stripeEvent('customer.subscription.deleted', sub))).status()).toBe(200);
    expect((await me(s)).user.effectivePlan).toBe('free');

    // Readable: the promise on /pricing is "your data is preserved".
    const records = (await ok(await s.ctx.get(`canvas/${id}/consent`))).data;
    expect(records.map((r: { id: string }) => r.id)).toContain(consent.id);
    const ethics = (await ok(await s.ctx.get(`canvas/${id}/ethics`))).data;
    expect(ethics.consentRecords).toHaveLength(1);
    const repos = (await ok(await s.ctx.get('repositories'))).repositories;
    expect(repos.map((r: { id: string }) => r.id)).toContain(repo.id);
    const insights = (await ok(await s.ctx.get(`repositories/${repo.id}/insights`))).insights;
    expect(insights).toHaveLength(1);

    // Writes stay behind the paid plan.
    expect((await s.ctx.post(`canvas/${id}/consent`, { data: { participantId: 'P-08' } })).status()).toBe(403);
    expect((await s.ctx.post('repositories', { data: { name: 'More' } })).status()).toBe(403);
    expect(
      (await s.ctx.post(`repositories/${repo.id}/insights`, { data: { title: 'x', content: 'y' } })).status(),
    ).toBe(403);
    expect((await s.ctx.put(`canvas/${id}/consent/${consent.id}/withdraw`, { data: {} })).status()).toBe(403);
  });
});
