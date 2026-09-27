import { test, expect, type Page } from '@playwright/test';
import {
  signup,
  newClient,
  ok,
  json,
  me,
  createCanvas,
  waitForEmail,
  emailsTo,
  tokenFromLink,
  testPassword,
  uniqueEmail,
  type Session,
} from './support/api';
import { STACK } from './support/env';

// Email verification asks "Did you create this QualCanvas account?" before it
// acts (apps/backend/src/routes/emailVerificationRoutes.ts).
//
// The attack: someone registers a password account with the victim's address.
// The verification email goes to the victim. Before this change, opening the
// link verified the account, and the registrant kept their session and
// password on a now-verified account in the victim's name.

async function linkFor(email: string): Promise<{ token: string; path: string }> {
  const mail = await waitForEmail(email, /Verify your QualCanvas email/);
  const token = tokenFromLink(mail.html ?? '', '/verify-email');
  return { token, path: `/verify-email#token=${token}&email=${encodeURIComponent(email)}` };
}

async function verifiedState(s: Session): Promise<boolean> {
  return (await me(s)).user.emailVerified as boolean;
}

async function freshPage(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('jms_cookie_consent', 'rejected');
  });
}

const QUESTION = 'Did you create this QualCanvas account?';
const REGISTRANT_UA = 'Mozilla/5.0 (X11; Linux x86_64; rv:130.0) Gecko/20100101 Firefox/130.0';

/** Sign up from a browser that identifies itself, as a real registrant's would. */
async function signupFrom(tag: string, userAgent: string): Promise<Session> {
  const ctx = await newClient();
  const email = uniqueEmail(tag);
  const password = testPassword();
  const body = await ok(
    await ctx.post('auth/signup', {
      data: { email, password, name: `Estate ${tag}` },
      headers: { 'User-Agent': userAgent },
    }),
    201,
  );
  return { ctx, email, password, userId: body.data.user.id };
}

test.describe('Verification link asks before it acts', () => {
  test.beforeEach(async ({ page }) => freshPage(page));

  test('regression: the victim opening the link, even pressing Yes, does not verify the registrant’s account; No locks the registrant out', async ({
    page,
  }) => {
    // 1. The attacker registers the victim's address and keeps the session.
    const attacker = await signupFrom('preverify', REGISTRANT_UA);
    await createCanvas(attacker, 'Planted by the registrant');
    const { path } = await linkFor(attacker.email);

    // 2. The victim opens the link from their inbox, in their own browser.
    await page.goto(path);
    await expect(
      page.getByRole('heading', { name: 'Email verified' }).or(page.getByRole('heading', { name: QUESTION })),
    ).toBeVisible({ timeout: 15_000 });
    // Before the fix, merely opening the page had verified the attacker's account.
    expect(await verifiedState(attacker)).toBe(false);

    // 3. The page shows when and from what the account was created.
    await expect(page.getByRole('heading', { name: QUESTION })).toBeVisible();
    await expect(page.getByText(attacker.email)).toBeVisible();
    await expect(page.getByText('Created', { exact: true })).toBeVisible();
    await expect(page.getByText('Firefox on Linux')).toBeVisible();

    // 4. The victim presses Yes by mistake: they are asked for a password they
    //    do not have, and nothing is verified.
    await page.getByRole('button', { name: 'Yes, I created it' }).click();
    await expect(page.getByRole('heading', { name: 'Enter your password' })).toBeVisible();
    await page.getByLabel('Password').fill(testPassword());
    await page.getByRole('button', { name: 'Verify my email' }).click();
    await expect(page.getByRole('alert')).toContainText('not correct');
    expect(await verifiedState(attacker)).toBe(false);

    // 5. They go back and choose No. The page explains, then acts.
    await page.getByRole('button', { name: 'Back' }).click();
    await page.getByRole('button', { name: /No, this wasn/ }).click();
    await expect(page.getByRole('heading', { name: 'Lock this account?' })).toBeVisible();
    await page.getByRole('button', { name: 'Lock the account' }).click();
    await expect(page.getByRole('heading', { name: 'Account locked' })).toBeVisible({ timeout: 15_000 });

    // 6. The attacker's session and password are dead.
    expect((await attacker.ctx.get('auth/me')).status()).toBe(401);
    expect((await attacker.ctx.get('canvas')).status()).toBe(401);
    const retry = await newClient();
    expect(
      (await retry.post('auth/email-login', { data: { email: attacker.email, password: attacker.password } })).status(),
    ).toBe(401);

    // 7. The victim can take the address over later through "Forgot password".
    await ok(await (await newClient()).post('auth/forgot-password', { data: { email: attacker.email } }));
    const reset = await waitForEmail(attacker.email, /reset/i);
    const resetToken = tokenFromLink(reset.html ?? '', '/reset-password');
    const chosen = testPassword();
    await ok(
      await (
        await newClient()
      ).post('auth/reset-password', { data: { email: attacker.email, token: resetToken, newPassword: chosen } }),
    );
    const owner = await newClient();
    const login = await ok(await owner.post('auth/email-login', { data: { email: attacker.email, password: chosen } }));
    expect(login.data.user.emailVerified).toBe(true);

    // 8. The link cannot be used again.
    await page.goto('/login');
    await page.goto(path);
    await expect(page.getByText(/already been used or has expired/)).toBeVisible({ timeout: 15_000 });
  });

  test('prefetch: a scanner fetching the link, and a browser rendering it, change nothing', async ({
    page,
    request,
  }) => {
    const s = await signup('prefetch');
    const { token, path } = await linkFor(s.email);

    // A link scanner's plain GET of the URL (the fragment never reaches a server).
    const get = await request.get(`${STACK.frontendOrigin}${path}`);
    expect(get.status()).toBe(200);
    // A GET straight at the API with the token in the query string is not a route.
    const api = await request.get(
      `${STACK.backendOrigin}/api/auth/verify-email?token=${token}&email=${encodeURIComponent(s.email)}`,
    );
    // (No GET handler exists; the auth-guarded routers mounted later answer 401.)
    expect([401, 404]).toContain(api.status());
    // A scanner that renders the page and runs its script.
    for (let i = 0; i < 2; i++) {
      await page.goto(path);
      await expect(page.getByRole('heading', { name: QUESTION })).toBeVisible({ timeout: 15_000 });
    }
    expect(await verifiedState(s)).toBe(false);
    expect((await s.ctx.get('auth/me')).status()).toBe(200);

    // The link still works for the real person afterwards.
    await ok(await s.ctx.post('auth/verify-email', { data: { email: s.email, token, decision: 'yes' } }));
    expect(await verifiedState(s)).toBe(true);
  });

  test('the real owner on another device: Yes + their password verifies and signs that device in; the sign-up session keeps working', async ({
    page,
  }) => {
    const s = await signup('otherdevice');
    const { path } = await linkFor(s.email);
    await page.goto(path);
    await page.getByRole('button', { name: 'Yes, I created it' }).click();
    await page.getByLabel('Password').fill(s.password);
    await page.getByRole('button', { name: 'Verify my email' }).click();
    await expect(page.getByRole('heading', { name: 'Email verified' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('link', { name: 'Go to Canvas' }).click();
    await expect(page).toHaveURL(/\/(canvas|onboarding|welcome)/, { timeout: 15_000 });
    await expect(page).not.toHaveURL(/\/login/);

    expect(await verifiedState(s)).toBe(true);
    expect((await s.ctx.get('auth/me')).status()).toBe(200);
  });

  test('"I don’t know this password" secures the account and emails a reset link to the inbox', async ({ page }) => {
    const attacker = await signup('resetpath');
    const { path } = await linkFor(attacker.email);
    const before = emailsTo(attacker.email).length;
    await page.goto(path);
    await page.getByRole('button', { name: 'Yes, I created it' }).click();
    await page.getByRole('button', { name: /don.t know this password/ }).click();
    await expect(page.getByText(/sign out every device/)).toBeVisible();
    await page.getByRole('button', { name: 'Secure the account and email me a reset link' }).click();
    await expect(page.getByRole('heading', { name: 'Check your inbox' })).toBeVisible({ timeout: 15_000 });

    expect((await attacker.ctx.get('auth/me')).status()).toBe(401);
    const reset = await waitForEmail(attacker.email, /reset/i, before);
    const token = tokenFromLink(reset.html ?? '', '/reset-password');
    const chosen = testPassword();
    await ok(
      await (
        await newClient()
      ).post('auth/reset-password', { data: { email: attacker.email, token, newPassword: chosen } }),
    );
    await ok(await (await newClient()).post('auth/email-login', { data: { email: attacker.email, password: chosen } }));
  });
});

test.describe('Verification link: single use, CSRF, concurrency', () => {
  test('a used link is refused for every decision (replay)', async () => {
    const s = await signup('replay');
    const { token } = await linkFor(s.email);
    await ok(await s.ctx.post('auth/verify-email', { data: { email: s.email, token, decision: 'yes' } }));
    for (const decision of ['yes', 'no', 'reset']) {
      const res = await s.ctx.post('auth/verify-email', { data: { email: s.email, token, decision } });
      expect(res.status()).toBe(400);
    }
    // The replayed "No" did nothing: the owner's session and password still work.
    expect((await s.ctx.get('auth/me')).status()).toBe(200);
    await ok(await (await newClient()).post('auth/email-login', { data: { email: s.email, password: s.password } }));
  });

  test('the old one-click request (email + token only) does not verify', async () => {
    const s = await signup('oneclick');
    const { token } = await linkFor(s.email);
    const res = await s.ctx.post('auth/verify-email', { data: { email: s.email, token } });
    expect(res.status()).toBe(400);
    expect((await json(res)).code).toBe('CONFIRMATION_REQUIRED');
    expect(await verifiedState(s)).toBe(false);
  });

  test('CSRF: a POST from another origin is refused and changes nothing', async ({ playwright }) => {
    const s = await signup('csrf');
    const { token } = await linkFor(s.email);
    const evil = await playwright.request.newContext({
      baseURL: `${STACK.backendOrigin}/api/`,
      extraHTTPHeaders: { Origin: 'https://attacker.example' },
    });
    for (const decision of ['yes', 'no']) {
      const res = await evil.post('auth/verify-email', { data: { email: s.email, token, decision } });
      expect(res.status()).toBe(403);
    }
    expect(await verifiedState(s)).toBe(false);
    expect((await s.ctx.get('auth/me')).status()).toBe(200);
  });

  test('two decisions sent at once: exactly one acts', async () => {
    const s = await signup('race');
    const { token } = await linkFor(s.email);
    const other = await newClient();
    const [yes, no] = await Promise.all([
      s.ctx.post('auth/verify-email', { data: { email: s.email, token, decision: 'yes' } }),
      other.post('auth/verify-email', { data: { email: s.email, token, decision: 'no' } }),
    ]);
    const statuses = [yes.status(), no.status()].sort();
    expect(statuses).toEqual([200, 400]);
  });
});
