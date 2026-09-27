import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import {
  signup,
  ok,
  json,
  me,
  subscribe,
  sendWebhook,
  stripeEvent,
  stripeControl,
  createCanvas,
  addTranscript,
  addCode,
  setClock,
  type Session,
} from './support/api';

// Per-seat billing (docs/qa/SEAT-BILLING.md) against the real backend, a real
// Postgres and the local Stripe double. Prices mirror the live ones:
// Team $39/seat/month, Pro $15/seat/month.

const TEXT =
  'The rota changed twice in one month. Staffing was the main problem on nights, and the handover notes were often missing.';

async function stripeSub(id: string) {
  return stripeControl(`subscriptions/${id}`);
}
async function invoicesFor(subId: string): Promise<any[]> {
  return stripeControl(`invoices?subscription=${subId}`);
}
async function seats(s: Session) {
  return (await ok(await s.ctx.get('billing/seats'))).data;
}
async function invite(owner: Session, canvasId: string, email: string, role: 'editor' | 'viewer', extra = {}) {
  return owner.ctx.post(`canvas/${canvasId}/collaborators`, { data: { email, role, ...extra } });
}
/** Invite a coder the way the UI does: ask, read the quote, confirm it. */
async function inviteCoderConfirmed(owner: Session, canvasId: string, email: string) {
  const first = await invite(owner, canvasId, email, 'editor');
  if (first.status() === 201) return null;
  const body = await json(first);
  expect(first.status(), JSON.stringify(body)).toBe(402);
  expect(body.code).toBe('SEAT_REQUIRED');
  await ok(
    await invite(owner, canvasId, email, 'editor', {
      confirmSeatCharge: true,
      prorationDate: body.preview.prorationDate,
    }),
    201,
  );
  return body.preview;
}
const PHRASES = ['The rota changed', 'Staffing was the main problem', 'on nights', 'handover notes', 'often missing'];
let phraseN = 0;
/** Code a (different each time) phrase, so no two codings are identical. */
async function codeOnce(s: Session, canvasId: string, transcriptId: string, questionId: string) {
  const phrase = PHRASES[phraseN++ % PHRASES.length];
  const start = TEXT.indexOf(phrase);
  return s.ctx.post(`canvas/${canvasId}/codings`, {
    data: { transcriptId, questionId, startOffset: start, endOffset: start + phrase.length, codedText: phrase },
  });
}

test.describe('Seats: a coder needs a paid seat, a viewer does not', () => {
  test('Team: inviting a coder quotes the prorated charge, charges only after confirmation, and seats them', async () => {
    const owner = await signup('seat-owner');
    const { subscriptionId } = await subscribe(owner, 'price_qc_team_m');
    const coder = await signup('seat-coder', { verify: true });
    const viewer = await signup('seat-viewer', { verify: true });
    const canvasId = await createCanvas(owner, 'Seats study');
    const t = await addTranscript(owner, canvasId, 'Nights', TEXT);
    const q = await addCode(owner, canvasId, 'Staffing');

    // 1. Without confirmation: 402 with a quote, and nothing changes anywhere.
    const refused = await invite(owner, canvasId, coder.email, 'editor');
    expect(refused.status()).toBe(402);
    const quote = (await json(refused)).preview;
    expect(quote).toMatchObject({ currentQuantity: 1, newQuantity: 2, unitAmount: 3900, interval: 'month' });
    expect(quote.dueNow).toBeGreaterThan(0);
    expect(quote.dueNow).toBeLessThanOrEqual(3900);
    expect(quote.nextRenewal).toBe(7800);
    expect((await ok(await owner.ctx.get(`canvas/${canvasId}/collaborators`))).data).toHaveLength(0);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(1);
    expect(await invoicesFor(subscriptionId)).toHaveLength(0);

    // 2. Confirmed with the quoted instant: Stripe charges exactly the quote.
    await ok(
      await invite(owner, canvasId, coder.email, 'editor', {
        confirmSeatCharge: true,
        prorationDate: quote.prorationDate,
      }),
      201,
    );
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);
    const inv = await invoicesFor(subscriptionId);
    expect(inv).toHaveLength(1);
    expect(inv[0].status).toBe('paid');
    expect(inv[0].amount_due).toBe(quote.dueNow);
    // The update asked Stripe to invoice now and to apply only if paid.
    const calls = (await stripeControl('calls')).filter(
      (c: any) => c.method === 'POST' && c.path === `/v1/subscriptions/${subscriptionId}`,
    );
    expect(calls.at(-1).form).toMatchObject({
      proration_behavior: 'always_invoice',
      payment_behavior: 'pending_if_incomplete',
      proration_date: String(quote.prorationDate),
    });

    let st = await seats(owner);
    expect(st).toMatchObject({ mode: 'billed', seatsPurchased: 2, seatsUsed: 2, unseatedCount: 0 });
    expect(st.holders.map((h: any) => [h.email, h.seated])).toEqual([[coder.email, true]]);
    expect(st.price).toEqual({ unitAmount: 3900, currency: 'usd', interval: 'month' });

    // 3. A viewer is free: no quote, no invoice, no seat.
    await ok(await invite(owner, canvasId, viewer.email, 'viewer'), 201);
    expect(await invoicesFor(subscriptionId)).toHaveLength(1);
    st = await seats(owner);
    expect(st.seatsUsed).toBe(2);

    // 4. The coder codes; the viewer can read but not write.
    expect((await codeOnce(coder, canvasId, t, q)).status()).toBe(201);
    expect((await codeOnce(viewer, canvasId, t, q)).status()).toBe(403);
    expect((await viewer.ctx.get(`canvas/${canvasId}`)).status()).toBe(200);

    // 5. The same coder on another of the owner's canvases uses the same seat.
    const second = await createCanvas(owner, 'Seats study 2');
    await ok(await invite(owner, second, coder.email, 'editor'), 201);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);
  });

  test('error: a declined card adds no seat and no coder, and leaves nothing to pay', async () => {
    const owner = await signup('seat-decline');
    const { subscriptionId, customer } = await subscribe(owner, 'price_qc_team_m');
    const coder = await signup('seat-decline-coder', { verify: true });
    const canvasId = await createCanvas(owner, 'Decline study');
    await stripeControl(`customers/${customer}`, { card: 'declined' });

    const res = await invite(owner, canvasId, coder.email, 'editor', { confirmSeatCharge: true });
    const body = await json(res);
    expect(res.status()).toBe(402);
    expect(body.code).toBe('SEAT_PAYMENT_FAILED');
    expect(body.error).toMatch(/declined/i);
    expect((await ok(await owner.ctx.get(`canvas/${canvasId}/collaborators`))).data).toHaveLength(0);
    expect((await coder.ctx.get(`canvas/${canvasId}`)).status()).toBe(403);
    const sub = await stripeSub(subscriptionId);
    expect(sub.items.data[0].quantity).toBe(1);
    expect(sub.pending_update).toBeNull();
    expect((await invoicesFor(subscriptionId)).map((i) => i.status)).toEqual(['void']);
    expect((await me(owner)).subscription.status).toBe('active');

    // Card fixed → the same confirmation now succeeds.
    await stripeControl(`customers/${customer}`, { card: 'ok' });
    await ok(await invite(owner, canvasId, coder.email, 'editor', { confirmSeatCharge: true }), 201);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);
  });

  test('removing a coder, or making them a viewer, credits the seat back at once', async () => {
    const owner = await signup('seat-release');
    const { subscriptionId } = await subscribe(owner, 'price_qc_team_m');
    const [c1, c2] = [await signup('seat-rel-1'), await signup('seat-rel-2')];
    const canvasId = await createCanvas(owner, 'Release study');
    await inviteCoderConfirmed(owner, canvasId, c1.email);
    await inviteCoderConfirmed(owner, canvasId, c2.email);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(3);

    await ok(await owner.ctx.delete(`canvas/${canvasId}/collaborators/${c2.userId}`));
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);
    const pending = await stripeControl(`pending/${subscriptionId}`);
    const credit = pending.reduce((t: number, l: any) => t + l.amount, 0);
    expect(credit).toBeLessThan(0); // unused time is credited to the next invoice
    // Decreases never create a card charge.
    expect((await invoicesFor(subscriptionId)).every((i) => i.amount_due > 0)).toBe(true);
    expect(await invoicesFor(subscriptionId)).toHaveLength(2);

    await ok(await invite(owner, canvasId, c1.email, 'viewer'), 201);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(1);
    expect((await seats(owner)).seatsUsed).toBe(1);
    // c1 keeps read access as a viewer.
    expect((await c1.ctx.get(`canvas/${canvasId}`)).status()).toBe(200);
  });

  test('Team members take a seat too; a person holds at most one seat', async () => {
    const owner = await signup('seat-team');
    const { subscriptionId } = await subscribe(owner, 'price_qc_team_m');
    const member = await signup('seat-team-member');
    const team = (await ok(await owner.ctx.post('teams', { data: { name: 'Lab' } }), 201)).data;

    const refused = await owner.ctx.post(`teams/${team.id}/members`, { data: { email: member.email } });
    expect(refused.status()).toBe(402);
    expect((await json(refused)).code).toBe('SEAT_REQUIRED');
    await ok(
      await owner.ctx.post(`teams/${team.id}/members`, { data: { email: member.email, confirmSeatCharge: true } }),
      201,
    );
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);

    // Also a coder on a canvas: same person, same seat, no second charge.
    const canvasId = await createCanvas(owner, 'Team canvas');
    await ok(await invite(owner, canvasId, member.email, 'editor'), 201);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);

    // Releasing the seat from the Seats panel: viewer everywhere, out of the team.
    const released = (await ok(await owner.ctx.post(`billing/seats/holders/${member.userId}/release`))).data;
    expect(released.seatsUsed).toBe(1);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(1);
    const collabs = (await ok(await owner.ctx.get(`canvas/${canvasId}/collaborators`))).data;
    expect(collabs.map((c: any) => c.role)).toEqual(['viewer']);
  });
});

test.describe('Seats: webhooks keep the quantity true to Stripe', () => {
  test('quantity mirrors Stripe; stale, duplicate and foreign events do not regress it', async () => {
    const owner = await signup('seat-hooks');
    const { subscriptionId, customer } = await subscribe(owner, 'price_qc_team_m');
    const coder = await signup('seat-hooks-coder');
    const canvasId = await createCanvas(owner, 'Hooks');
    await inviteCoderConfirmed(owner, canvasId, coder.email);
    const live = await stripeSub(subscriptionId);
    expect(live.items.data[0].quantity).toBe(2);

    // A stale snapshot (an older quantity) arriving late must not win.
    const stale = structuredClone(live);
    stale.items.data[0].quantity = 1;
    expect((await sendWebhook(stripeEvent('customer.subscription.updated', stale))).status()).toBe(200);
    expect((await seats(owner)).seatsPurchased).toBe(2);

    // A real change made in the Stripe portal is picked up, even delivered twice.
    await stripeControl(`subscriptions/${subscriptionId}`, { quantity: 4 });
    const ev = stripeEvent('customer.subscription.updated', await stripeSub(subscriptionId));
    expect((await sendWebhook(ev)).status()).toBe(200);
    expect((await sendWebhook(ev)).status()).toBe(200);
    // Two seats nobody holds are credited back when the owner next looks.
    const st = await seats(owner);
    expect(st.seatsPurchased).toBe(2);
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);

    // pending_update_applied is handled like an update.
    expect(
      (
        await sendWebhook(stripeEvent('customer.subscription.pending_update_applied', await stripeSub(subscriptionId)))
      ).status(),
    ).toBe(200);

    // Another product's subscription event on the shared account: 200, no change.
    const foreign = await stripeControl('subscriptions', { customer: 'cus_other_product', price: 'price_other_app' });
    expect(
      (await sendWebhook(stripeEvent('customer.subscription.updated', { ...foreign, quantity: 9 }))).status(),
    ).toBe(200);
    expect((await seats(owner)).seatsPurchased).toBe(2);
    // Bad signature: 400 and nothing applied.
    expect(
      (
        await sendWebhook(stripeEvent('customer.subscription.updated', await stripeSub(subscriptionId)), {
          secret: 'whsec_wrong',
        })
      ).status(),
    ).toBe(400);
    void customer;
  });

  test('downgrading Team → Pro keeps the seats and the coders', async () => {
    const owner = await signup('seat-down');
    const { subscriptionId } = await subscribe(owner, 'price_qc_team_m');
    const coder = await signup('seat-down-coder');
    const canvasId = await createCanvas(owner, 'Downgrade');
    const t = await addTranscript(owner, canvasId, 'Nights', TEXT);
    const q = await addCode(owner, canvasId, 'Staffing');
    await inviteCoderConfirmed(owner, canvasId, coder.email);

    await stripeControl(`subscriptions/${subscriptionId}`, { price: 'price_qc_pro_m' });
    await sendWebhook(stripeEvent('customer.subscription.updated', await stripeSub(subscriptionId)));
    expect((await me(owner)).user.plan).toBe('pro');
    const st = await seats(owner);
    expect(st).toMatchObject({ mode: 'billed', plan: 'pro', seatsPurchased: 2, seatsUsed: 2, unseatedCount: 0 });
    expect(st.price.unitAmount).toBe(1500);
    expect((await codeOnce(coder, canvasId, t, q)).status()).toBe(201);
  });
});

test.describe('Seats: existing coders get a grace period, never a lock-out', () => {
  test.afterEach(async () => {
    await setClock(null);
  });

  test('trial owner with coders buys Pro with fewer seats: coders keep editing for 30 days, then read-only until seats are added', async () => {
    const owner = await signup('grace-owner', { verify: true }); // 14-day Pro trial
    const [c1, c2] = [await signup('grace-c1', { verify: true }), await signup('grace-c2', { verify: true })];
    const canvasId = await createCanvas(owner, 'Grace study');
    const t = await addTranscript(owner, canvasId, 'Nights', TEXT);
    const q = await addCode(owner, canvasId, 'Staffing');
    // During the trial nothing is billed, so coders are added without a quote.
    await ok(await invite(owner, canvasId, c1.email, 'editor'), 201);
    await ok(await invite(owner, canvasId, c2.email, 'editor'), 201);
    expect((await seats(owner)).mode).toBe('trial');

    // Checkout proposes a seat per person (adjustable); the buyer lowers it to 1.
    const checkout = await ok(await owner.ctx.post('billing/create-checkout', { data: { priceId: 'price_qc_pro_m' } }));
    const session = await stripeControl(`sessions/${String(checkout.data.url).split('/').pop()}`);
    expect(session.quantity).toBe(3);
    expect(session.adjustable_quantity).toBe(true);
    const { subscriptionId } = await subscribe(owner, 'price_qc_pro_m', { quantity: 1 });

    const st = await seats(owner);
    expect(st).toMatchObject({ mode: 'billed', seatsPurchased: 1, seatsUsed: 3, unseatedCount: 2, enforcing: false });
    const graceMs = Date.parse(st.graceEndsAt) - Date.now();
    expect(graceMs).toBeGreaterThan(29.9 * 86_400_000);
    expect(graceMs).toBeLessThan(30.1 * 86_400_000);
    // In grace: coders still work.
    expect((await codeOnce(c1, canvasId, t, q)).status()).toBe(201);

    // 31 days later (the subscription renewed meanwhile): read-only, not locked out.
    const later = new Date(Date.now() + 31 * 86_400_000);
    await setClock(later.toISOString());
    // Sessions last 24h; everyone signs in again a month later.
    for (const s of [owner, c1, c2])
      await ok(await s.ctx.post('auth/email-login', { data: { email: s.email, password: s.password } }));
    const renewedStart = Math.floor(later.getTime() / 1000) - 86_400;
    await stripeControl(`subscriptions/${subscriptionId}`, {
      current_period_start: renewedStart,
      current_period_end: renewedStart + 30 * 86_400,
    });
    const blocked = await codeOnce(c1, canvasId, t, q);
    expect(blocked.status()).toBe(403);
    expect((await json(blocked)).code).toBe('SEAT_REQUIRED_FOR_EDITING');
    expect((await c1.ctx.get(`canvas/${canvasId}`)).status()).toBe(200);
    expect((await codeOnce(owner, canvasId, t, q)).status()).toBe(201);
    expect((await seats(owner)).enforcing).toBe(true);

    // The owner cannot drop below the seats in use, and adds the 2 seats.
    expect((await owner.ctx.post('billing/seats', { data: { quantity: 5 } })).status()).toBe(409);
    const quote = await owner.ctx.post('billing/seats', { data: { quantity: 3 } });
    expect(quote.status()).toBe(402);
    const preview = (await json(quote)).preview;
    expect(preview).toMatchObject({ currentQuantity: 1, newQuantity: 3, unitAmount: 1500 });
    const done = await ok(
      await owner.ctx.post('billing/seats', {
        data: { quantity: 3, confirmSeatCharge: true, prorationDate: preview.prorationDate },
      }),
    );
    expect(done.data).toMatchObject({ quantity: 3, unseatedCount: 0, enforcing: false });
    expect((await codeOnce(c1, canvasId, t, q)).status()).toBe(201);
    expect((await codeOnce(c2, canvasId, t, q)).status()).toBe(201);
  });
});

test.describe('Seats in the browser', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      localStorage.setItem('jms_cookie_consent', 'rejected');
      const existing = localStorage.getItem('qualcanvas-ui');
      const state = existing ? JSON.parse(existing) : { state: {}, version: 0 };
      state.state = {
        ...state.state,
        onboardingComplete: true,
        setupWizardComplete: true,
        onboardingV2Complete: true,
        onboardingChecklistDismissed: true,
        showFullProductTour: false,
      };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(state));
    });
  });

  async function signIn(page: import('@playwright/test').Page, s: Session) {
    await page.goto('/login');
    const panel = page.locator('#auth-panel-login');
    await panel.getByPlaceholder('you@university.edu').fill(s.email);
    await panel.getByPlaceholder('Enter your password').fill(s.password);
    await panel.locator('button[type="submit"]').click();
    await page.waitForURL(/\/(canvas|onboarding|welcome)/, { timeout: 30_000 });
  }

  test('the owner sees the quote in the Share dialog, confirms it, and manages seats on the Account page', async ({
    page,
  }) => {
    const owner = await signup('ui-seat-owner');
    const { subscriptionId } = await subscribe(owner, 'price_qc_team_m');
    const coder = await signup('ui-seat-coder');
    const canvasId = await createCanvas(owner, 'UI seats study');

    await signIn(page, owner);
    await page.goto(`/canvas/${canvasId}`);
    await page.locator('button[title="Share canvas"]').click();
    const share = page.getByRole('dialog', { name: 'Share Canvas' });
    await expect(share.getByTestId('share-seat-note')).toContainText('Each coder uses a paid seat ($39.00 / month)');
    await share.getByLabel("Coder's email address").fill(coder.email);
    await share.getByRole('button', { name: 'Invite', exact: true }).click();

    const quote = page.getByRole('alertdialog');
    await expect(quote).toContainText('Add a paid seat?');
    await expect(quote.getByTestId('seat-quantity-change')).toHaveText('1 → 2');
    await expect(quote.getByTestId('seat-next-renewal')).toHaveText('$78.00 / month');
    // Keyboard: focus is trapped in the dialog and starts inside it.
    expect(await quote.evaluate((el) => el.contains(document.activeElement))).toBe(true);
    const axe = await new AxeBuilder({ page }).include('[role="alertdialog"]').analyze();
    expect(axe.violations.map((v) => v.id)).toEqual([]);
    // Nothing is charged while the dialog is open.
    expect((await stripeSub(subscriptionId)).items.data[0].quantity).toBe(1);

    await quote.getByRole('button', { name: 'Add seat and invite' }).click();
    await expect(page.getByRole('alertdialog')).toHaveCount(0);
    await expect(share.getByRole('button', { name: /^Remove coder / })).toBeVisible();
    await expect.poll(async () => (await stripeSub(subscriptionId)).items.data[0].quantity).toBe(2);

    await page.goto('/account#seats');
    const panel = page.getByRole('region', { name: 'Seats' });
    await expect(panel.getByTestId('seats-summary')).toContainText('2 of 2 paid seats in use');
    await expect(panel.getByRole('list', { name: 'People holding a seat' })).toContainText(coder.email);
    const axePanel = await new AxeBuilder({ page }).include('#seats').analyze();
    expect(axePanel.violations.map((v) => v.id)).toEqual([]);
  });

  test('an owner with a coder beyond their seats gets the reminder banner with the grace date', async ({ page }) => {
    const owner = await signup('ui-grace-owner', { verify: true });
    const coder = await signup('ui-grace-coder');
    const canvasId = await createCanvas(owner, 'UI grace');
    await ok(await invite(owner, canvasId, coder.email, 'editor'), 201); // trial: free
    await subscribe(owner, 'price_qc_pro_m', { quantity: 1 });

    await signIn(page, owner);
    await page.goto('/canvas');
    const banner = page.getByTestId('seat-shortfall-banner');
    await expect(banner).toContainText("1 coder doesn't have a paid seat. They can keep editing until");
    await banner.getByRole('link', { name: 'Review seats' }).click();
    await expect(page).toHaveURL(/\/account#seats$/);
    await expect(page.getByRole('region', { name: 'Seats' })).toContainText("1 coder doesn't have a paid seat");
    await page.getByRole('button', { name: 'Add 1 seat' }).click();
    await page.getByRole('alertdialog').getByRole('button', { name: 'Add seats' }).click();
    await expect(page.getByRole('region', { name: 'Seats' }).getByTestId('seats-summary')).toContainText(
      '2 of 2 paid seats in use',
    );
  });
});
