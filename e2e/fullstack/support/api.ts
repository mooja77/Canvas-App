import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import { expect, request as pwRequest, type APIRequestContext, type APIResponse } from '@playwright/test';
import Stripe from 'stripe';
import { STACK } from './env';

let seq = 0;

/**
 * A fresh random password for a throwaway local test account. Generated at run
 * time so no credential-shaped literal lives in the repository.
 */
export function testPassword(): string {
  return `Tp-${randomBytes(12).toString('base64url')}-9`;
}

/** Unique, obviously-fake identity. example.com never receives mail. */
export function uniqueEmail(tag: string, domain = 'example.com'): string {
  seq += 1;
  return `estate-${tag}-${Date.now().toString(36)}${seq}@${domain}`;
}

export interface Session {
  ctx: APIRequestContext;
  email: string;
  password: string;
  userId: string;
}

/** A cookie-authenticated API client that sends the app's Origin (CSRF). */
export async function newClient(): Promise<APIRequestContext> {
  return pwRequest.newContext({
    baseURL: `${STACK.backendOrigin}/api/`,
    extraHTTPHeaders: { Origin: STACK.frontendOrigin },
  });
}

export async function json<T = any>(res: APIResponse): Promise<T> {
  const text = await res.text();
  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(`Expected JSON from ${res.url()} (${res.status()}): ${text.slice(0, 300)}`);
  }
}

export async function ok<T = any>(res: APIResponse, status = 200): Promise<T> {
  const body = await json<T>(res);
  expect(res.status(), `${res.url()} → ${JSON.stringify(body).slice(0, 400)}`).toBe(status);
  return body;
}

export async function signup(
  tag: string,
  opts: { verify?: boolean; domain?: string; password?: string } = {},
): Promise<Session> {
  const ctx = await newClient();
  const email = uniqueEmail(tag, opts.domain);
  const password = opts.password ?? testPassword();
  const body = await ok(await ctx.post('auth/signup', { data: { email, password, name: `Estate ${tag}` } }), 201);
  const session: Session = { ctx, email, password, userId: body.data.user.id };
  if (opts.verify) await verifyEmail(session);
  return session;
}

// ─── Outbox (emails and egress captured by the backend preload) ───────────────

export interface OutboxEntry {
  at: string;
  kind: string;
  to?: string | string[];
  subject?: string;
  html?: string;
  host?: string;
  body?: any;
}

export function outbox(): OutboxEntry[] {
  if (!fs.existsSync(STACK.outbox)) return [];
  return fs
    .readFileSync(STACK.outbox, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l) as OutboxEntry);
}

export function emailsTo(address: string): OutboxEntry[] {
  return outbox().filter(
    (e) => e.kind === 'email' && (Array.isArray(e.to) ? e.to.includes(address) : e.to === address),
  );
}

export async function waitForEmail(address: string, subjectRe: RegExp, after = 0): Promise<OutboxEntry> {
  let found: OutboxEntry | undefined;
  await expect
    .poll(
      () => {
        // Most recent match: a resent link supersedes the earlier one.
        found = emailsTo(address)
          .slice(after)
          .filter((e) => subjectRe.test(e.subject ?? ''))
          .pop();
        return Boolean(found);
      },
      { timeout: 10_000, message: `email to ${address} matching ${subjectRe}` },
    )
    .toBe(true);
  return found!;
}

export function tokenFromLink(html: string, path: string): string {
  const m = html.match(new RegExp(`${path}#token=([a-f0-9]+)`));
  if (!m) throw new Error(`no ${path} link in email`);
  return m[1];
}

export async function verifyEmail(s: Session): Promise<void> {
  const mail = await waitForEmail(s.email, /verify|confirm/i);
  const token = tokenFromLink(mail.html ?? '', '/verify-email');
  await ok(await s.ctx.post('auth/verify-email', { data: { email: s.email, token } }));
}

// ─── Clock (backend process time; see preload.mjs) ───────────────────────────

export async function setClock(iso: string | null): Promise<void> {
  const q = iso === null ? 'offsetMs=0' : `now=${encodeURIComponent(iso)}`;
  const res = await fetch(`http://127.0.0.1:${STACK.clockPort}/clock?${q}`, { method: 'POST' });
  expect(res.ok).toBe(true);
}
export async function clock(): Promise<{ now: string; offsetMs: number; blocked: number }> {
  return (await fetch(`http://127.0.0.1:${STACK.clockPort}/clock`)).json();
}

// ─── Stripe (local double + signed webhooks) ─────────────────────────────────

const stripeSigner = new Stripe('sk_test_estate_stub');

export async function stripeControl(path: string, data?: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${STACK.stripeOrigin}/__control/${path}`, {
    method: data ? 'POST' : 'GET',
    headers: { 'content-type': 'application/json' },
    body: data ? JSON.stringify(data) : undefined,
  });
  return res.json();
}

let evtSeq = 0;
export function stripeEvent(type: string, object: unknown, id?: string) {
  evtSeq += 1;
  return {
    id: id ?? `evt_estate_${Date.now().toString(36)}_${evtSeq}`,
    object: 'event',
    type,
    created: Math.floor(Date.now() / 1000),
    data: { object },
  };
}

export async function sendWebhook(
  event: unknown,
  opts: { secret?: string; signature?: string } = {},
): Promise<APIResponse> {
  const payload = JSON.stringify(event);
  const header =
    opts.signature ??
    stripeSigner.webhooks.generateTestHeaderString({ payload, secret: opts.secret ?? STACK.webhookSecret });
  const ctx = await pwRequest.newContext({ baseURL: `${STACK.backendOrigin}/api/` });
  // Stripe calls server-to-server: no Origin header.
  return ctx.post('billing/webhook', {
    data: payload,
    headers: { 'stripe-signature': header, 'content-type': 'application/json' },
  });
}

/**
 * Buy a plan the way a customer does: create-checkout → (Stripe) subscription
 * created for that customer → signed checkout.session.completed webhook.
 */
export async function subscribe(s: Session, priceId: string): Promise<{ subscriptionId: string; customer: string }> {
  const checkout = await ok(await s.ctx.post('billing/create-checkout', { data: { priceId } }));
  const sessionId = String(checkout.data.url).split('/').pop()!;
  const session = await stripeControl(`sessions/${sessionId}`);
  const sub = await stripeControl('subscriptions', { customer: session.customer, price: priceId });
  const res = await sendWebhook(
    stripeEvent('checkout.session.completed', {
      id: session.id,
      object: 'checkout.session',
      customer: session.customer,
      subscription: sub.id,
      metadata: session.metadata,
    }),
  );
  expect(res.status()).toBe(200);
  return { subscriptionId: sub.id, customer: session.customer };
}

export async function me(s: Session): Promise<any> {
  return (await ok(await s.ctx.get('auth/me'))).data;
}

// ─── Research content helpers ────────────────────────────────────────────────

export async function createCanvas(s: Session, name = 'Estate canvas'): Promise<string> {
  return (await ok(await s.ctx.post('canvas', { data: { name } }), 201)).data.id;
}

export async function addTranscript(s: Session, canvasId: string, title: string, content: string): Promise<string> {
  return (await ok(await s.ctx.post(`canvas/${canvasId}/transcripts`, { data: { title, content } }), 201)).data.id;
}

export async function addCode(s: Session, canvasId: string, text: string): Promise<string> {
  return (await ok(await s.ctx.post(`canvas/${canvasId}/questions`, { data: { text } }), 201)).data.id;
}

export async function codeText(
  s: Session,
  canvasId: string,
  transcriptId: string,
  questionId: string,
  content: string,
  phrase: string,
): Promise<any> {
  const startOffset = content.indexOf(phrase);
  expect(startOffset).toBeGreaterThanOrEqual(0);
  return (
    await ok(
      await s.ctx.post(`canvas/${canvasId}/codings`, {
        data: { transcriptId, questionId, startOffset, endOffset: startOffset + phrase.length, codedText: phrase },
      }),
      201,
    )
  ).data;
}

export async function getCanvas(s: Session, canvasId: string): Promise<any> {
  return (await ok(await s.ctx.get(`canvas/${canvasId}`))).data;
}
