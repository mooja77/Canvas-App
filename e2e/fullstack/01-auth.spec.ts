import { test, expect, request as pwRequest } from '@playwright/test';
import { STACK } from './support/env';
import {
  signup,
  newClient,
  ok,
  json,
  uniqueEmail,
  waitForEmail,
  tokenFromLink,
  emailsTo,
  me,
  verifyEmail,
  testPassword,
} from './support/api';

/** A syntactically valid JWT with a signature that cannot verify. */
function forgedJwt(): string {
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString('base64url');
  return `${b64({ alg: 'HS256' })}.${b64({ userId: 'x', role: 'admin', plan: 'team' })}.invalidsig`;
}

test.describe('Auth: sign-up, verification, login, reset, sessions', () => {
  test('sign-up creates an unverified Free account and sends one verification email', async () => {
    const s = await signup('signup');
    const user = (await me(s)).user;
    expect(user.email).toBe(s.email);
    expect(user.emailVerified).toBe(false);
    expect(user.plan).toBe('free');
    // Trial overlay only applies to verified emails.
    expect(user.effectivePlan).toBe('free');
    await waitForEmail(s.email, /Verify your QualCanvas email/);
    expect(emailsTo(s.email).filter((e) => /Verify/.test(e.subject ?? ''))).toHaveLength(1);
  });

  test('verifying the email starts the 14-day Pro trial', async () => {
    const s = await signup('verify', { verify: true });
    const user = (await me(s)).user;
    expect(user.emailVerified).toBe(true);
    expect(user.effectivePlan).toBe('pro');
    const days = (new Date(user.trialEndsAt).getTime() - Date.now()) / 86_400_000;
    expect(days).toBeGreaterThan(13);
    expect(days).toBeLessThanOrEqual(14.01);
  });

  test('edge: verification with a wrong token is rejected and does not verify', async () => {
    const s = await signup('badverify');
    const res = await s.ctx.post('auth/verify-email', { data: { email: s.email, token: 'a'.repeat(64) } });
    expect(res.status()).toBe(400);
    expect((await me(s)).user.emailVerified).toBe(false);
  });

  test('error: duplicate sign-up is 409 (case-insensitive), weak password and bad email are 400', async () => {
    const s = await signup('dupe');
    const ctx = await newClient();
    expect(
      (
        await ctx.post('auth/signup', { data: { email: s.email.toUpperCase(), password: testPassword(), name: 'X' } })
      ).status(),
    ).toBe(409);
    expect(
      (await ctx.post('auth/signup', { data: { email: uniqueEmail('weak'), password: 'short', name: 'X' } })).status(),
    ).toBe(400);
    expect(
      (
        await ctx.post('auth/signup', { data: { email: 'not-an-email', password: testPassword(), name: 'X' } })
      ).status(),
    ).toBe(400);
  });

  test('login succeeds with the right password and fails (401) with the wrong one', async () => {
    const s = await signup('login');
    const ctx = await newClient();
    expect((await ctx.post('auth/email-login', { data: { email: s.email, password: testPassword() } })).status()).toBe(
      401,
    );
    await ok(await ctx.post('auth/email-login', { data: { email: s.email, password: s.password } }));
    expect((await json(await ctx.get('auth/me'))).data.user.email).toBe(s.email);
  });

  test('password reset: email link works once, old sessions die, new password logs in', async () => {
    const s = await signup('reset');
    const anon = await newClient();
    await ok(await anon.post('auth/forgot-password', { data: { email: s.email } }));
    const mail = await waitForEmail(s.email, /Reset your QualCanvas password/);
    const token = tokenFromLink(mail.html ?? '', '/reset-password');

    // Tokens are time-sensitive; a session created before the reset must stop working.
    await new Promise((r) => setTimeout(r, 1100));
    const fresh1 = testPassword();
    await ok(await anon.post('auth/reset-password', { data: { email: s.email, token, newPassword: fresh1 } }));
    expect((await s.ctx.get('auth/me')).status()).toBe(401);

    // Replaying the same token fails.
    expect(
      (
        await anon.post('auth/reset-password', { data: { email: s.email, token, newPassword: testPassword() } })
      ).status(),
    ).toBe(400);

    const fresh = await newClient();
    expect((await fresh.post('auth/email-login', { data: { email: s.email, password: s.password } })).status()).toBe(
      401,
    );
    await ok(await fresh.post('auth/email-login', { data: { email: s.email, password: fresh1 } }));
  });

  test('edge: forgot-password for an unknown address answers the same and sends nothing', async () => {
    const anon = await newClient();
    const ghost = uniqueEmail('ghost');
    const res = await anon.post('auth/forgot-password', { data: { email: ghost } });
    expect(res.status()).toBe(200);
    await new Promise((r) => setTimeout(r, 500));
    expect(emailsTo(ghost)).toHaveLength(0);
  });

  test('change password requires the current one and revokes the session', async () => {
    const s = await signup('chpw');
    expect(
      (
        await s.ctx.put('auth/change-password', {
          data: { currentPassword: testPassword(), newPassword: testPassword() },
        })
      ).status(),
    ).toBe(401);
    await new Promise((r) => setTimeout(r, 1100));
    await ok(
      await s.ctx.put('auth/change-password', { data: { currentPassword: s.password, newPassword: testPassword() } }),
    );
    expect((await s.ctx.get('auth/me')).status()).toBe(401);
  });

  test('logout clears the cookie', async () => {
    const s = await signup('logout');
    await ok(await s.ctx.post('auth/logout'));
    expect((await s.ctx.get('auth/me')).status()).toBe(401);
  });

  test('error: protected routes need auth; forged JWT is rejected', async () => {
    const anon = await newClient();
    expect((await anon.get('canvas')).status()).toBe(401);
    const forged = await pwRequest.newContext({
      baseURL: `${STACK.backendOrigin}/api/`,
      extraHTTPHeaders: {
        Origin: STACK.frontendOrigin,
        Authorization: `Bearer ${forgedJwt()}`,
      },
    });
    expect((await forged.get('canvas')).status()).toBe(401);
  });

  test('CSRF: a cookie-authenticated write from a foreign origin is refused', async () => {
    const s = await signup('csrf');
    const res = await s.ctx.post('canvas', { data: { name: 'x' }, headers: { Origin: 'https://evil.example' } });
    expect(res.status()).toBe(403);
  });

  test('account export includes research content and no secrets', async () => {
    const s = await signup('export', { verify: true });
    const canvas = await ok(await s.ctx.post('canvas', { data: { name: 'Export me' } }), 201);
    const res = await s.ctx.get('auth/export');
    expect(res.status()).toBe(200);
    const text = await res.text();
    expect(text).toContain('Export me');
    expect(text).not.toMatch(/passwordHash|resetTokenHash|verificationTokenHash|accessCodeHash/);
    expect(canvas.data.id).toBeTruthy();
  });

  test('account deletion needs the password, then removes the account', async () => {
    const s = await signup('delete', { verify: true });
    expect((await s.ctx.delete('auth/account', { data: { password: testPassword() } })).status()).toBe(401);
    await ok(await s.ctx.delete('auth/account', { data: { password: s.password } }));
    const ctx = await newClient();
    expect((await ctx.post('auth/email-login', { data: { email: s.email, password: s.password } })).status()).toBe(401);
  });

  test('resend verification sends a fresh link that works', async () => {
    const s = await signup('resend');
    await waitForEmail(s.email, /Verify/);
    const before = emailsTo(s.email).length;
    await ok(await s.ctx.post('auth/resend-verification'));
    await waitForEmail(s.email, /Verify/, before);
    await verifyEmail({ ...s, email: s.email });
  });
});
