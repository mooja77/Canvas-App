/*
 * QualCanvas 12-month fast-forward simulation — core. Start it through
 * fast-forward.mjs, which resets the database and sets the environment.
 *
 * One process hosts: the real backend (imported from apps/backend/src/index.ts,
 * listening on 127.0.0.1), the Stripe double, and the scheduled jobs. The
 * backend is driven over HTTP exactly like the web app drives it (cookie auth +
 * Origin header). Time is moved one simulated day at a time through the
 * preload's clock; timestamps Postgres stamps itself are re-stamped to the
 * simulated instant after each day.
 *
 * An independent ledger (below) models what the published pricing and the
 * documented billing rules say SHOULD happen. Invariants compare the app's
 * answers to the ledger and are written to docs/qa/SIMULATION.md.
 */
import fs from 'node:fs';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import Stripe from 'stripe';
import { createStripeStub } from '../support/stripe-stub.mjs';

// ─── args / rng ───────────────────────────────────────────────────────────────
const argv = process.argv.slice(2);
const arg = (name: string, d: string) => {
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] ? argv[i + 1] : d;
};
const MONTHS = Number(arg('months', '12'));
const SEED = Number(arg('seed', '42'));
const LABEL = arg('label', 'current');
let rngState = SEED >>> 0 || 1;
function rand(): number {
  // mulberry32
  rngState = (rngState + 0x6d2b79f5) >>> 0;
  let t = rngState;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
const chance = (p: number) => rand() < p;
const pick = <T>(xs: T[]): T => xs[Math.floor(rand() * xs.length)];

const REPO = path.resolve(import.meta.dirname, '../../..');
const OUT = path.join(import.meta.dirname, '.out');
const DAY = 86_400_000;
const clock = (globalThis as any).__harnessClock as { set(iso: string): void; offset(): number };
const START = new Date(Date.now()); // preload started us at the simulation start
const PORT = Number(process.env.PORT);
const BASE = `http://127.0.0.1:${PORT}/api/`;
const ORIGIN = 'http://127.0.0.1:4913';

// ─── invariants ──────────────────────────────────────────────────────────────
interface Inv {
  id: string;
  desc: string;
  pass: number;
  fail: number;
  examples: string[];
}
const invs = new Map<string, Inv>();
function check(id: string, desc: string, okv: boolean, example: () => string): boolean {
  if (!invs.has(id)) invs.set(id, { id, desc, pass: 0, fail: 0, examples: [] });
  const r = invs.get(id)!;
  if (okv) r.pass++;
  else {
    r.fail++;
    if (r.examples.length < 4) r.examples.push(example());
  }
  return okv;
}
const vol: Record<string, number> = {
  actors: 0,
  canvasesCreated: 0,
  canvasCreatesRefused: 0,
  transcripts: 0,
  transcriptRefused: 0,
  codes: 0,
  codeRefused: 0,
  codings: 0,
  codingsDeleted: 0,
  trashed: 0,
  restored: 0,
  restoreRefused: 0,
  purgedByJob: 0,
  permanentDeletes: 0,
  anonymisations: 0,
  exports: 0,
  qdpxRoundTrips: 0,
  collaboratorsAdded: 0,
  seatQuotes: 0,
  seatsAdded: 0,
  seatsReleased: 0,
  seatDeclines: 0,
  viewersAdded: 0,
  graceWritesAllowed: 0,
  graceWritesRefused: 0,
  webhooks: 0,
  webhookReplays: 0,
  webhooksDelayed: 0,
  renewals: 0,
  paymentFailures: 0,
  cancellations: 0,
  planSwitches: 0,
  jobRuns: 0,
  jobReplays: 0,
  downtimeDaysSkipped: 0,
  http: 0,
  http5xx: 0,
  relogins: 0,
};
const events: string[] = [];
const note = (t: string) => {
  const line = `[${now().toISOString().slice(0, 10)}] ${t}`;
  events.push(line);
  console.log(line);
};
const now = () => new Date();

/** Random per run, for throwaway local accounts; no credential literal in source. */
function throwawayCredential(): string {
  return ['Sp', randomBytes(12).toString('base64url'), '9'].join('-');
}

// ─── HTTP client ─────────────────────────────────────────────────────────────
class Client {
  cookie = '';
  /** Set once the account exists; used to sign in again when the 24h session lapses. */
  creds: { email: string; password: string } | null = null;
  async req(method: string, p: string, body?: unknown, retried = false): Promise<{ status: number; body: any }> {
    const r = await this.raw(method, p, body);
    if (r.status === 401 && !retried && this.creds && !p.startsWith('auth/')) {
      vol.relogins++;
      const login = await this.raw('POST', 'auth/email-login', this.creds);
      check(
        'INV-LOGIN',
        'a known user can always sign in',
        login.status === 200,
        () => `${this.creds?.email} ${login.status}`,
      );
      return this.req(method, p, body, true);
    }
    return r;
  }
  private async raw(method: string, p: string, body?: unknown): Promise<{ status: number; body: any }> {
    vol.http++;
    const res = await fetch(BASE + p, {
      method,
      headers: {
        Origin: ORIGIN,
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(this.cookie ? { cookie: this.cookie } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const set = res.headers.get('set-cookie');
    if (set) {
      const m = set.match(/jwt=([^;]*)/);
      if (m) this.cookie = m[1] ? `jwt=${m[1]}` : '';
    }
    if (res.status >= 500) {
      vol.http5xx++;
      note(`HTTP ${res.status} ${method} ${p}`);
    }
    const text = await res.text();
    let parsed: any = text;
    try {
      parsed = JSON.parse(text);
    } catch {
      /* binary */
    }
    return { status: res.status, body: parsed };
  }
}

// ─── Stripe ──────────────────────────────────────────────────────────────────
const stub = createStripeStub({ port: Number(process.env.STRIPE_API_PORT) });
const signer = new Stripe('sk_test_sim_stub');
let evtN = 0;
interface PendingEvent {
  deliverOn: number; // day index
  event: any;
}
const delayed: PendingEvent[] = [];
async function deliver(event: any): Promise<number> {
  vol.webhooks++;
  const payload = JSON.stringify(event);
  const header = signer.webhooks.generateTestHeaderString({ payload, secret: process.env.STRIPE_WEBHOOK_SECRET! });
  const res = await fetch(BASE + 'billing/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': header, 'content-type': 'application/json' },
    body: payload,
  });
  if (res.status >= 500) vol.http5xx++;
  check(
    'INV-WEBHOOK-2XX',
    'every correctly signed webhook is acknowledged 200',
    res.status === 200,
    () => `${event.type} → ${res.status}`,
  );
  return res.status;
}
function mkEvent(type: string, object: unknown) {
  evtN++;
  return { id: `evt_sim_${evtN}`, object: 'event', type, created: Math.floor(Date.now() / 1000), data: { object } };
}
/** Send like Stripe does: sometimes twice, sometimes late (and so out of order). */
async function emit(dayIdx: number, type: string, object: unknown, opts: { allowDelay?: boolean } = {}) {
  const ev = mkEvent(type, object);
  if (opts.allowDelay && chance(0.08)) {
    vol.webhooksDelayed++;
    delayed.push({ deliverOn: dayIdx + 1 + Math.floor(rand() * 3), event: ev });
    return;
  }
  await deliver(ev);
  if (chance(0.1)) {
    vol.webhookReplays++;
    await deliver(ev);
  }
}

// ─── ledger (independent model of the published rules) ───────────────────────
type Plan = 'free' | 'student' | 'pro' | 'team';
const PRICE_PLAN: Record<string, Plan> = {
  price_qc_student_m: 'student',
  price_qc_pro_m: 'pro',
  price_qc_pro_y: 'pro',
  price_qc_team_m: 'team',
  price_qc_team_y: 'team',
};
// From the pricing page (qualcanvas.com/pricing), not from the code.
const CAPS: Record<Plan, { canvases: number; transcripts: number; codes: number; words: number }> = {
  free: { canvases: 2, transcripts: 5, codes: 10, words: 10_000 },
  student: { canvases: 5, transcripts: Infinity, codes: Infinity, words: 50_000 },
  pro: { canvases: Infinity, transcripts: Infinity, codes: Infinity, words: 50_000 },
  team: { canvases: Infinity, transcripts: Infinity, codes: Infinity, words: 50_000 },
};
// Published billing rule (D1, 27 Sep 2026): paid access continues while Stripe
// retries a failed card (past_due); it ends at canceled/unpaid.
const PAID_STATUSES = new Set(['active', 'trialing', 'past_due']);

interface LCoding {
  id: string;
  t: string;
  q: string;
  start: number;
  end: number;
}
interface LCanvas {
  id: string;
  live: boolean;
  trashedAt: number | null;
  purged: boolean;
  transcripts: Map<string, string>;
  codes: Set<string>;
  codings: Map<string, LCoding>;
  anonymised: boolean;
}
interface Actor {
  key: string;
  c: Client;
  email: string;
  password: string;
  userId: string;
  verified: boolean;
  legacy: boolean;
  consent: boolean;
  trialEndsAt: number | null;
  sub: {
    id: string;
    price: string;
    status: string;
    periodStart: number;
    periodEnd: number;
    cancelAtPeriodEnd: boolean;
    customer: string;
    /** Seats the ledger expects Stripe to be billing (per-seat plans). */
    seats: number;
  } | null;
  canvases: Map<string, LCanvas>;
  script: (day: number) => Promise<void>;
}
const actors: Actor[] = [];

function expectedPlan(a: Actor): { stored: Plan; effective: Plan } {
  const fallback: Plan = a.legacy ? 'pro' : 'free';
  const stored: Plan = a.sub && PAID_STATUSES.has(a.sub.status) ? PRICE_PLAN[a.sub.price] : fallback;
  const trial = stored === 'free' && a.verified && a.trialEndsAt !== null && a.trialEndsAt > Date.now();
  return { stored, effective: trial ? 'pro' : stored };
}
const liveCanvases = (a: Actor) => [...a.canvases.values()].filter((c) => c.live);

// ─── text generator ──────────────────────────────────────────────────────────
const NAMES = ['Aoife', 'Seán', 'Úna', 'José', 'Mary', 'Tomás', 'Priya', 'Chen'];
const TOPICS = [
  'the workload doubled after the merger',
  'my manager was supportive during the change',
  'the new rota made childcare impossible',
  'peer support kept me going',
  'training was rushed and confusing',
  'I felt listened to in team meetings',
  'patients noticed the staff shortages',
  'we lost two experienced nurses in March',
];
function interview(): string {
  const parts: string[] = [];
  for (let i = 0; i < 6 + Math.floor(rand() * 6); i++) {
    const who = pick(NAMES);
    parts.push(`${who}: Honestly, ${pick(TOPICS)}, and ${pick(TOPICS)}.`);
  }
  return parts.join(' ');
}

// ─── actor operations (each call checks the app against the ledger) ─────────
async function signupActor(
  key: string,
  opts: { verify: boolean; academic?: boolean; consent?: boolean },
): Promise<Actor> {
  const c = new Client();
  const email = `sim-${key}-${SEED}@${opts.academic ? 'example.edu' : 'example.com'}`;
  const password = throwawayCredential();
  const r = await c.req('POST', 'auth/signup', {
    email,
    password,
    name: `Sim ${key}`,
    marketingConsent: !!opts.consent,
  });
  if (r.status !== 201) throw new Error(`signup ${key}: ${r.status} ${JSON.stringify(r.body)}`);
  c.creds = { email, password };
  const a: Actor = {
    key,
    c,
    email,
    password,
    userId: r.body.data.user.id,
    verified: false,
    legacy: false,
    consent: !!opts.consent,
    trialEndsAt: null,
    sub: null,
    canvases: new Map(),
    script: async () => {},
  };
  if (opts.verify) await verifyActor(a);
  actors.push(a);
  vol.actors++;
  return a;
}

function outboxLines(): any[] {
  return fs
    .readFileSync(process.env.NETGUARD_OUTBOX!, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
}
async function verifyActor(a: Actor) {
  const mail = outboxLines()
    .filter((e) => e.kind === 'email' && e.to === a.email && /Verify/.test(e.subject))
    .pop();
  const token = String(mail?.html ?? '').match(/verify-email#token=([a-f0-9]+)/)?.[1];
  // "Yes, I created it" from the signed-up session (see routes/emailVerificationRoutes.ts).
  const r = await a.c.req('POST', 'auth/verify-email', { email: a.email, token, decision: 'yes' });
  check(
    'INV-VERIFY',
    'verification link from the email verifies the account',
    r.status === 200,
    () => `${a.key} ${r.status}`,
  );
  a.verified = true;
  a.trialEndsAt = Date.now() + 14 * DAY;
}

async function login(a: Actor) {
  const r = await a.c.req('POST', 'auth/email-login', { email: a.email, password: a.password });
  check('INV-LOGIN', 'a known user can always sign in', r.status === 200, () => `${a.key} ${r.status}`);
}

async function ensureSession(a: Actor) {
  const r = await a.c.req('GET', 'auth/me');
  if (r.status === 401) await login(a);
}

let canvasSeq = 0;
async function createCanvas(a: Actor, day: number) {
  const cap = CAPS[expectedPlan(a).effective].canvases;
  const expectOk = liveCanvases(a).length < cap;
  // Names are unique per owner (the app enforces it), so number them.
  const r = await a.c.req('POST', 'canvas', { name: `${a.key} study ${++canvasSeq} d${day}` });
  check(
    'INV-CAP-CANVAS',
    'canvas create is allowed exactly while live canvases < plan cap',
    (r.status === 201) === expectOk,
    () => `${a.key} plan=${expectedPlan(a).effective} live=${liveCanvases(a).length} → ${r.status}`,
  );
  if (r.status === 201) {
    vol.canvasesCreated++;
    a.canvases.set(r.body.data.id, {
      id: r.body.data.id,
      live: true,
      trashedAt: null,
      purged: false,
      transcripts: new Map(),
      codes: new Set(),
      codings: new Map(),
      anonymised: false,
    });
  } else vol.canvasCreatesRefused++;
}

async function addTranscript(a: Actor, cv: LCanvas) {
  const cap = CAPS[expectedPlan(a).effective].transcripts;
  const content = interview();
  const expectOk = cv.transcripts.size < cap;
  const r = await a.c.req('POST', `canvas/${cv.id}/transcripts`, {
    title: `Interview ${cv.transcripts.size + 1}`,
    content,
  });
  check(
    'INV-CAP-TRANSCRIPT',
    'transcript add is allowed exactly while the canvas is under the plan cap',
    (r.status === 201) === expectOk,
    () => `${a.key} plan=${expectedPlan(a).effective} n=${cv.transcripts.size} → ${r.status}`,
  );
  if (r.status === 201) {
    cv.transcripts.set(r.body.data.id, content);
    vol.transcripts++;
  } else vol.transcriptRefused++;
}

async function addCode(a: Actor, cv: LCanvas) {
  const cap = CAPS[expectedPlan(a).effective].codes;
  const expectOk = cv.codes.size < cap;
  const r = await a.c.req('POST', `canvas/${cv.id}/questions`, { text: `Theme ${cv.codes.size + 1}` });
  check(
    'INV-CAP-CODE',
    'code create is allowed exactly while the canvas is under the plan cap',
    (r.status === 201) === expectOk,
    () => `${a.key} plan=${expectedPlan(a).effective} n=${cv.codes.size} → ${r.status}`,
  );
  if (r.status === 201) {
    cv.codes.add(r.body.data.id);
    vol.codes++;
  } else vol.codeRefused++;
}

async function codePassage(a: Actor, cv: LCanvas, coder: Actor = a) {
  if (cv.transcripts.size === 0 || cv.codes.size === 0) return;
  const [t, content] = pick([...cv.transcripts.entries()]);
  const q = pick([...cv.codes]);
  const start = Math.floor(rand() * Math.max(1, content.length - 40));
  const end = Math.min(content.length, start + 10 + Math.floor(rand() * 60));
  const r = await coder.c.req('POST', `canvas/${cv.id}/codings`, {
    transcriptId: t,
    questionId: q,
    startOffset: start,
    endOffset: end,
    codedText: content.slice(start, end),
  });
  check(
    'INV-CODING-CREATE',
    'a valid coding (text matches offsets) is accepted',
    r.status === 201,
    () => `${coder.key} → ${r.status} ${JSON.stringify(r.body).slice(0, 120)}`,
  );
  if (r.status === 201) {
    cv.codings.set(r.body.data.id, { id: r.body.data.id, t, q, start, end });
    vol.codings++;
  }
}

async function deleteCoding(a: Actor, cv: LCanvas) {
  if (cv.codings.size === 0) return;
  const id = pick([...cv.codings.keys()]);
  const r = await a.c.req('DELETE', `canvas/${cv.id}/codings/${id}`);
  check('INV-CODING-DELETE', 'deleting an existing coding succeeds', r.status === 200, () => `${a.key} → ${r.status}`);
  if (r.status === 200) {
    cv.codings.delete(id);
    vol.codingsDeleted++;
  }
}

async function trashCanvas(a: Actor, cv: LCanvas) {
  const r = await a.c.req('DELETE', `canvas/${cv.id}`);
  check('INV-TRASH', 'moving a canvas to the trash succeeds', r.status === 200, () => `${a.key} → ${r.status}`);
  if (r.status === 200) {
    cv.live = false;
    cv.trashedAt = Date.now();
    vol.trashed++;
  }
}

async function restoreCanvas(a: Actor, cv: LCanvas) {
  const cap = CAPS[expectedPlan(a).effective].canvases;
  const expectOk = liveCanvases(a).length < cap;
  const r = await a.c.req('POST', `canvas/${cv.id}/restore`);
  check(
    'INV-CAP-RESTORE',
    'restore from trash obeys the live-canvas cap',
    (r.status === 200) === expectOk,
    () => `${a.key} plan=${expectedPlan(a).effective} live=${liveCanvases(a).length} → ${r.status}`,
  );
  if (r.status === 200) {
    cv.live = true;
    cv.trashedAt = null;
    vol.restored++;
  } else vol.restoreRefused++;
}

async function anonymise(a: Actor, cv: LCanvas) {
  if (cv.transcripts.size === 0) return;
  const [t, content] = pick([...cv.transcripts.entries()]);
  const name = pick(NAMES);
  const replacement = `[P${1 + Math.floor(rand() * 9)}${'x'.repeat(Math.floor(rand() * 5))}]`;
  const r = await a.c.req('POST', `canvas/${cv.id}/transcripts/${t}/anonymize`, {
    replacements: [{ find: name, replace: replacement }],
  });
  if (r.status !== 200) {
    check('INV-ANON-OK', 'anonymisation succeeds on a paid plan', false, () => `${a.key} → ${r.status}`);
    return;
  }
  vol.anonymisations++;
  cv.anonymised = true;
  // Ledger: recompute the expected content with an independent whole-word pass.
  const wordChar = /[\p{L}\p{M}\p{N}_]/u;
  let expected = '';
  let i = 0;
  const lower = content.toLocaleLowerCase();
  const target = name.toLocaleLowerCase();
  const moves: [number, number, number][] = []; // oldStart, oldEnd, delta after
  let delta = 0;
  while (i < content.length) {
    if (
      lower.startsWith(target, i) &&
      (i === 0 || !wordChar.test(content[i - 1])) &&
      (i + name.length >= content.length || !wordChar.test(content[i + name.length]))
    ) {
      expected += replacement;
      delta += replacement.length - name.length;
      moves.push([i, i + name.length, delta]);
      i += name.length;
    } else {
      expected += content[i];
      i++;
    }
  }
  const got = (await a.c.req('GET', `canvas/${cv.id}`)).body.data;
  const tx = got.transcripts.find((x: any) => x.id === t);
  check(
    'INV-ANON-TEXT',
    'anonymised text equals an independent whole-word replacement (accents included)',
    tx?.content === expected,
    () => `${a.key} "${name}" diff`,
  );
  cv.transcripts.set(t, expected);
  const mapOff = (o: number, side: 'start' | 'end') => {
    let d = 0;
    for (const [s, e, after] of moves) {
      if (o <= s) break;
      if (o < e) return side === 'start' ? s + d : e + after;
      d = after;
    }
    return o + d;
  };
  for (const cd of cv.codings.values()) {
    if (cd.t !== t) continue;
    cd.start = mapOff(cd.start, 'start');
    cd.end = Math.max(cd.start, mapOff(cd.end, 'end'));
  }
}

/** GET /canvas/:id with every detail page merged (the API pages at 500 rows). */
async function fullCanvas(a: Actor, id: string): Promise<{ status: number; data: any }> {
  const first = await a.c.req('GET', `canvas/${id}?detailPageSize=1000`);
  const data = first.body?.data;
  if (!data) return { status: first.status, data: null };
  let page = 0;
  let more = first.body?.detailPagination?.hasMore ?? {};
  while (Object.values(more).some(Boolean)) {
    page++;
    const next = await a.c.req('GET', `canvas/${id}?detailPageSize=1000&detailPage=${page}`);
    for (const k of Object.keys(more))
      if (more[k] && Array.isArray(next.body?.data?.[k])) data[k].push(...next.body.data[k]);
    more = next.body?.detailPagination?.hasMore ?? {};
  }
  return { status: first.status, data };
}

// ─── verification sweeps ─────────────────────────────────────────────────────
async function verifyActorState(a: Actor, label: string) {
  await ensureSession(a);
  const meR = await a.c.req('GET', 'auth/me');
  const exp = expectedPlan(a);
  const u = meR.body?.data?.user;
  check(
    'INV-PLAN',
    'effective plan (/auth/me) == ledger (subscription + legacy + trial rules)',
    u?.effectivePlan === exp.effective,
    () =>
      `${label} ${a.key} app=${u?.plan}/${u?.effectivePlan} ledger=${exp.stored}/${exp.effective} sub=${a.sub?.status} http=${meR.status} ${u ? '' : JSON.stringify(meR.body).slice(0, 160)}`,
  );
  if (a.sub) {
    const st = meR.body?.data?.subscription?.status;
    check(
      'INV-SUB-STATUS',
      'stored subscription status == Stripe status',
      st === a.sub.status,
      () => `${label} ${a.key} app=${st} stripe=${a.sub?.status}`,
    );
  }
  const list = await a.c.req('GET', 'canvas');
  const liveIds = new Set<string>((list.body?.data ?? []).map((x: any) => x.id));
  // The list also shows live canvases others shared with this user.
  const sharedIn = actors
    .filter((o) => o !== a)
    .flatMap((o) =>
      liveCanvases(o)
        .filter((c) => collaborators.get(c.id)?.has(a.userId))
        .map((c) => c.id),
    );
  const ledgerLive = [...liveCanvases(a).map((c) => c.id), ...sharedIn];
  check(
    'INV-CANVAS-LIST',
    'live canvas list == ledger',
    liveIds.size === ledgerLive.length && ledgerLive.every((id) => liveIds.has(id)),
    () => `${label} ${a.key} app=${liveIds.size} ledger=${ledgerLive.length}`,
  );

  for (const cv of liveCanvases(a)) {
    const r = await fullCanvas(a, cv.id);
    const d = r.data;
    if (!d) {
      check(
        'INV-CANVAS-READ',
        'every live canvas is readable by its owner (also after a downgrade)',
        false,
        () => `${a.key} ${cv.id} → ${r.status}`,
      );
      continue;
    }
    check('INV-CANVAS-READ', 'every live canvas is readable by its owner (also after a downgrade)', true, () => '');
    const tmap = new Map<string, string>(d.transcripts.map((t: any) => [t.id, t.content]));
    check(
      'INV-CONTENT-COUNTS',
      'transcript/code/coding counts == ledger',
      d.transcripts.length === cv.transcripts.size &&
        d.questions.length === cv.codes.size &&
        d.codings.length === cv.codings.size,
      () =>
        `${a.key} app=${d.transcripts.length}/${d.questions.length}/${d.codings.length} ledger=${cv.transcripts.size}/${cv.codes.size}/${cv.codings.size}`,
    );
    for (const c of d.codings) {
      const content = tmap.get(c.transcriptId) ?? '';
      check(
        'INV-CODING-ALIGNED',
        "every coding's stored text == transcript.slice(start, end)",
        content.slice(c.startOffset, c.endOffset) === c.codedText,
        () =>
          `${a.key} coding ${c.id} "${c.codedText.slice(0, 30)}" vs "${content.slice(c.startOffset, c.endOffset).slice(0, 30)}"`,
      );
      const l = cv.codings.get(c.id);
      check(
        'INV-CODING-LEDGER',
        "every coding's offsets == ledger",
        !!l && l.start === c.startOffset && l.end === c.endOffset && l.q === c.questionId,
        () => `${a.key} ${c.id} app=${c.startOffset}-${c.endOffset} ledger=${l?.start}-${l?.end}`,
      );
    }
  }
  const trash = await a.c.req('GET', 'canvas/trash');
  const trashIds = new Set<string>((trash.body?.data ?? []).map((x: any) => x.id));
  for (const cv of a.canvases.values()) {
    if (cv.live || cv.purged) continue;
    const age = Date.now() - (cv.trashedAt ?? 0);
    if (age > 31 * DAY) {
      check(
        'INV-TRASH-PURGED',
        'canvases trashed > 30 days ago are purged by the retention job',
        !trashIds.has(cv.id),
        () => `${a.key} ${cv.id} age=${Math.round(age / DAY)}d`,
      );
      if (!trashIds.has(cv.id)) cv.purged = true;
    } else if (age < 29 * DAY) {
      check(
        'INV-TRASH-KEPT',
        'canvases trashed < 30 days ago are still restorable',
        trashIds.has(cv.id),
        () => `${a.key} ${cv.id} age=${Math.round(age / DAY)}d`,
      );
    }
  }
}

async function statsCheck(a: Actor) {
  const cv = liveCanvases(a).find((c) => c.codings.size > 0);
  if (!cv) return;
  const node = await a.c.req('POST', `canvas/${cv.id}/computed`, { nodeType: 'stats', label: 'Sim stats' });
  if (node.status !== 201) return;
  const run = await a.c.req('POST', `canvas/${cv.id}/computed/${node.body.data.id}/run`);
  check('INV-STATS-RUN', 'stats node runs', run.status === 200, () => `${a.key} → ${run.status}`);
  const text = JSON.stringify(run.body?.data ?? {});
  const counts = new Map<string, number>();
  for (const c of cv.codings.values()) counts.set(c.q, (counts.get(c.q) ?? 0) + 1);
  const rows: any[] = run.body?.data?.result?.items ?? run.body?.data?.items ?? run.body?.data?.result?.stats ?? [];
  if (Array.isArray(rows) && rows.length) {
    for (const [q, n] of counts) {
      const row = rows.find((r: any) => r.id === q || r.questionId === q);
      check(
        'INV-STATS',
        'stats node count per code == ledger',
        !!row && (row.count ?? row.codingCount) === n,
        () => `${a.key} code ${q} app=${row?.count ?? row?.codingCount} ledger=${n}`,
      );
    }
  } else {
    check('INV-STATS-SHAPE', 'stats node result lists codes', text.includes([...counts.keys()][0]), () =>
      text.slice(0, 200),
    );
  }
  await a.c.req('DELETE', `canvas/${cv.id}/computed/${node.body.data.id}`);
}

/** Raw fetch (binary bodies) with the same one-shot re-sign-in as Client.req. */
async function authedFetch(a: Actor, url: string, init: RequestInit = {}): Promise<Response> {
  const go = () =>
    fetch(url, {
      ...init,
      headers: { ...(init.headers as Record<string, string>), cookie: a.c.cookie, Origin: ORIGIN },
    });
  vol.http++;
  let res = await go();
  if (res.status === 401) {
    await login(a);
    vol.http++;
    res = await go();
  }
  return res;
}

async function qdpxRoundTrip(a: Actor) {
  const cv = liveCanvases(a).find((c) => c.codings.size > 0);
  if (!cv) return;
  const plan = expectedPlan(a).effective;
  await ensureSession(a);
  const res = await authedFetch(a, BASE + `canvas/${cv.id}/export/qdpx`);
  const allowed = plan !== 'free';
  check(
    'INV-EXPORT-GATE',
    'QDPX export is available exactly on paid plans',
    (res.status === 200) === allowed,
    () => `${a.key} plan=${plan} → ${res.status}`,
  );
  if (res.status !== 200) return;
  vol.exports++;
  const buf = Buffer.from(await res.arrayBuffer());
  // Import into a scratch canvas only if the plan has room, then remove it.
  if (liveCanvases(a).length >= CAPS[plan].canvases) return;
  const target = await a.c.req('POST', 'canvas', { name: `QDPX round trip ${++canvasSeq}` });
  if (target.status !== 201) return;
  const fd = new FormData();
  fd.append('file', new Blob([buf], { type: 'application/zip' }), 'p.qdpx');
  const imp = await authedFetch(a, BASE + `canvas/${target.body.data.id}/import/qdpx`, { method: 'POST', body: fd });
  // The import's own account of what it skipped or merged, so a failure says why.
  const impBody = (await imp.json().catch(() => null)) as { message?: string } | null;
  const copy = (await fullCanvas(a, target.body.data.id)).data;
  check(
    'INV-QDPX-ROUNDTRIP',
    'QDPX export → import preserves every coding and its text',
    imp.status < 300 &&
      copy?.codings?.length === cv.codings.size &&
      copy.codings.every(
        (c: any) =>
          (copy.transcripts.find((t: any) => t.id === c.transcriptId)?.content ?? '').slice(
            c.startOffset,
            c.endOffset,
          ) === c.codedText,
      ),
    () =>
      `${a.key} import=${imp.status} app=${copy?.codings?.length} ledger=${cv.codings.size} (${impBody?.message ?? 'no import message'})`,
  );
  vol.qdpxRoundTrips++;
  await a.c.req('DELETE', `canvas/${target.body.data.id}`);
  await a.c.req('DELETE', `canvas/${target.body.data.id}/permanent`);
}

async function isolationCheck() {
  const [a, b] = [pick(actors), pick(actors)];
  if (a === b) return;
  const cv = pick([...a.canvases.values()].filter((c) => !c.purged) as LCanvas[]);
  if (!cv) return;
  const r = await b.c.req('GET', `canvas/${cv.id}`);
  const collab = (collaborators.get(cv.id) ?? new Set()).has(b.userId);
  if (collab) return;
  check(
    'INV-ISOLATION',
    "a user never reads another tenant's canvas",
    r.status === 403 || r.status === 404,
    () => `${b.key} read ${a.key}/${cv.id} → ${r.status}`,
  );
}
const collaborators = new Map<string, Set<string>>();

// ─── billing operations ──────────────────────────────────────────────────────
async function subscribe(a: Actor, day: number, price: string, opts: { quantity?: number } = {}) {
  await ensureSession(a);
  const r = await a.c.req('POST', 'billing/create-checkout', { priceId: price });
  check(
    'INV-CHECKOUT',
    'checkout session is created for a user without a live subscription',
    r.status === 200,
    () => `${a.key} ${price} → ${r.status} ${JSON.stringify(r.body).slice(0, 100)}`,
  );
  if (r.status !== 200) return;
  const session = stub.getSession(String(r.body.data.url).split('/').pop()!);
  // Ledger: Pro/Team checkout proposes one seat per person already coding with
  // this owner (adjustable); Student is always one.
  const perSeat = PRICE_PLAN[price] === 'pro' || PRICE_PLAN[price] === 'team';
  const expectedSeats = perSeat ? 1 + (seatLedger.get(a.userId)?.holders.length ?? 0) : 1;
  check(
    'INV-CHECKOUT-SEATS',
    'checkout proposes one seat per person (owner + coders) on Pro/Team, adjustable',
    session.quantity === expectedSeats && session.adjustable_quantity === perSeat,
    () => `${a.key} ${price} app=${session.quantity}/${session.adjustable_quantity} ledger=${expectedSeats}/${perSeat}`,
  );
  const quantity = opts.quantity ?? session.quantity ?? 1;
  const sub = stub.createSubscription({
    customer: session.customer,
    price,
    now: Math.floor(Date.now() / 1000),
    quantity,
  });
  a.sub = {
    id: sub.id,
    price,
    status: 'active',
    periodStart: sub.items.data[0].current_period_start * 1000,
    periodEnd: sub.items.data[0].current_period_end * 1000,
    cancelAtPeriodEnd: false,
    customer: session.customer,
    seats: quantity,
  };
  await emit(day, 'checkout.session.completed', {
    id: session.id,
    customer: session.customer,
    subscription: sub.id,
    metadata: session.metadata,
  });
  note(`${a.key} subscribed ${price}`);
}

function stubSub(a: Actor, patch: Record<string, unknown>) {
  return stub.updateSubscription(a.sub!.id, patch);
}

async function renewIfDue(a: Actor, day: number) {
  if (!a.sub || a.sub.status !== 'active') return;
  if (Date.now() < a.sub.periodEnd) return;
  if (a.sub.cancelAtPeriodEnd) {
    a.sub.status = 'canceled';
    const obj = stubSub(a, { status: 'canceled' });
    vol.cancellations++;
    await emit(day, 'customer.subscription.deleted', obj);
    note(`${a.key} cancelled at period end`);
    return;
  }
  const interval = PRICE_PLAN[a.sub.price] && a.sub.price.endsWith('_y') ? 365 : 30;
  const start = Math.floor(a.sub.periodEnd / 1000);
  a.sub.periodStart = start * 1000;
  // The renewal invoice absorbs waiting credits and the credit balance.
  const sb = seatLedger.get(a.userId);
  if (sb) {
    sb.pendingCredit = 0;
    sb.balance = 0;
  }
  a.sub.periodEnd = (start + interval * 86400) * 1000;
  const obj = stubSub(a, {
    status: 'active',
    current_period_start: start,
    current_period_end: start + interval * 86400,
  });
  a.sub.status = 'active';
  vol.renewals++;
  await emit(day, 'invoice.payment_succeeded', {
    id: `in_${evtN}`,
    object: 'invoice',
    parent: { subscription_details: { subscription: obj.id } },
  });
}

async function failPayment(a: Actor, day: number) {
  if (!a.sub) return;
  a.sub.status = 'past_due';
  const obj = stubSub(a, { status: 'past_due' });
  vol.paymentFailures++;
  // Stripe sends both, in no guaranteed order.
  await emit(day, 'invoice.payment_failed', {
    id: `in_f${evtN}`,
    object: 'invoice',
    parent: { subscription_details: { subscription: obj.id } },
  });
  await emit(day, 'customer.subscription.updated', obj);
  note(`${a.key} payment failed → past_due`);
}

async function recoverPayment(a: Actor, day: number) {
  if (!a.sub) return;
  a.sub.status = 'active';
  const obj = stubSub(a, { status: 'active' });
  await emit(day, 'invoice.payment_succeeded', {
    id: `in_r${evtN}`,
    object: 'invoice',
    parent: { subscription_details: { subscription: obj.id } },
  });
  await emit(day, 'customer.subscription.updated', obj, { allowDelay: true });
  note(`${a.key} payment recovered`);
}

async function cancelNow(a: Actor, day: number) {
  if (!a.sub) return;
  // A stale 'active' snapshot may still be in flight (delivered late).
  const stale = stub.getSubscription(a.sub.id);
  a.sub.status = 'canceled';
  const obj = stubSub(a, { status: 'canceled' });
  vol.cancellations++;
  await emit(day, 'customer.subscription.deleted', obj);
  if (stale)
    delayed.push({
      deliverOn: day + 1,
      event: mkEvent('customer.subscription.updated', { ...stale, status: 'active' }),
    });
  vol.webhooksDelayed++;
  note(`${a.key} subscription cancelled (stale update queued)`);
}

async function switchPlan(a: Actor, day: number, price: string) {
  if (!a.sub) return;
  a.sub.price = price;
  const obj = stubSub(a, { price });
  vol.planSwitches++;
  await emit(day, 'customer.subscription.updated', obj);
  note(`${a.key} switched to ${price}`);
}

async function cancelAtPeriodEnd(a: Actor, day: number) {
  if (!a.sub) return;
  a.sub.cancelAtPeriodEnd = true;
  const obj = stubSub(a, { cancel_at_period_end: true });
  await emit(day, 'customer.subscription.updated', obj);
  note(`${a.key} set cancel at period end`);
}

// ─── seats (independent model of the published seat rules) ───────────────────
// From /pricing and docs/qa/SEAT-BILLING.md, not from app code: Pro and Team
// are billed per seat (owner + each distinct coder; viewers free); adding a
// seat is invoiced now at Stripe's documented proration (unit x quantity x
// time left / period, credit for the old quantity, debit for the new one);
// removing one credits the unused time to the next invoice; an owner with
// more coders than seats gets 30 days' grace, after which unseated coders
// can read but not write.
const SEAT_PRICE: Record<string, number> = {
  price_qc_pro_m: 1500,
  price_qc_pro_y: 14400,
  price_qc_team_m: 3900,
  price_qc_team_y: 38400,
};
interface SeatBook {
  /** Coders holding (or needing) a seat, oldest first. */
  holders: string[];
  /** Grace end if the app stamped it when the request arrived... */
  graceEnd: number | null;
  /** ...or when it returned: writes in between may go either way. */
  graceEndLatest: number | null;
  /** Unused-time credits from released seats, waiting for the next invoice. */
  pendingCredit: number;
  /** Customer credit balance (<= 0) left when an invoice's credits exceeded its charges. */
  balance: number;
}
const seatLedger = new Map<string, SeatBook>();
function seatBook(owner: Actor): SeatBook {
  let b = seatLedger.get(owner.userId);
  if (!b) {
    b = { holders: [], graceEnd: null, graceEndLatest: null, pendingCredit: 0, balance: 0 };
    seatLedger.set(owner.userId, b);
  }
  return b;
}
/** Billed per seat right now (past_due is excluded: see D1 in the findings). */
function billedPerSeat(a: Actor): boolean {
  return !!a.sub && PAID_STATUSES.has(a.sub.status) && SEAT_PRICE[a.sub.price] !== undefined;
}
function ledgerProration(a: Actor, oldQ: number, newQ: number, atSecs: number): number {
  const unit = SEAT_PRICE[a.sub!.price];
  const period = (a.sub!.periodEnd - a.sub!.periodStart) / 1000;
  const frac = Math.min(1, Math.max(0, (a.sub!.periodEnd / 1000 - atSecs) / period));
  return Math.round(-unit * oldQ * frac) + Math.round(unit * newQ * frac);
}
/** What an immediate (always_invoice) seat invoice charges: proration + waiting credits + balance. */
function ledgerDueNow(a: Actor, oldQ: number, newQ: number, atSecs: number): { due: number; net: number } {
  const b = seatBook(a);
  const net = ledgerProration(a, oldQ, newQ, atSecs) + b.pendingCredit + b.balance;
  return { due: Math.max(0, net), net };
}
function settleImmediateInvoice(a: Actor, net: number) {
  const b = seatBook(a);
  b.pendingCredit = 0;
  b.balance = Math.min(0, net);
}
function seatedCoder(owner: Actor, coderId: string): boolean {
  if (!billedPerSeat(owner)) return true;
  const idx = seatBook(owner).holders.indexOf(coderId);
  return idx < 0 || idx < owner.sub!.seats - 1;
}
const stubQuantity = (a: Actor) => stub.getSubscription(a.sub!.id)?.items.data[0].quantity;
function addCollabLedger(cv: LCanvas, userId: string) {
  if (!collaborators.has(cv.id)) collaborators.set(cv.id, new Set());
  collaborators.get(cv.id)!.add(userId);
}

/** Invite a coder the way the UI does: ask; if quoted, check the quote, confirm. */
async function inviteCoder(owner: Actor, cv: LCanvas, coder: Actor, day: number): Promise<boolean> {
  await ensureSession(owner);
  const b = seatBook(owner);
  const already = b.holders.includes(coder.userId);
  const newQ = 1 + b.holders.length + 1;
  const needQuote = billedPerSeat(owner) && !already && newQ > owner.sub!.seats;
  const r1 = await owner.c.req('POST', `canvas/${cv.id}/collaborators`, { email: coder.email, role: 'editor' });
  if (!needQuote) {
    check(
      'INV-COLLAB-ADD',
      'a coder who needs no new paid seat is added at once, without a charge',
      r1.status === 201,
      () => `${owner.key} +${coder.key} → ${r1.status} ${JSON.stringify(r1.body).slice(0, 160)}`,
    );
    if (r1.status !== 201) return false;
  } else {
    vol.seatQuotes++;
    const p = r1.body?.preview;
    const nowSecs = Math.floor(Date.now() / 1000);
    const ledgerNow = p ? ledgerDueNow(owner, owner.sub!.seats, newQ, p.prorationDate) : { due: NaN, net: NaN };
    const expected = ledgerNow.due;
    check(
      'INV-SEAT-QUOTE',
      'a coder needing a seat is quoted (402) the Stripe proration for the rest of the period',
      r1.status === 402 &&
        r1.body?.code === 'SEAT_REQUIRED' &&
        p?.newQuantity === newQ &&
        p?.currentQuantity === owner.sub!.seats &&
        Math.abs(p.prorationDate - nowSecs) <= 5 &&
        Math.abs(p.dueNow - expected) <= 1 &&
        p.nextRenewal === SEAT_PRICE[owner.sub!.price] * newQ,
      () => `${owner.key} +${coder.key} → ${r1.status} app=${JSON.stringify(p)} ledger due=${expected} q=${newQ}`,
    );
    if (r1.status !== 402 || !p) return false;
    const before = stub.invoices(owner.sub!.id).length;
    const r2 = await owner.c.req('POST', `canvas/${cv.id}/collaborators`, {
      email: coder.email,
      role: 'editor',
      confirmSeatCharge: true,
      prorationDate: p.prorationDate,
    });
    const invs = stub.invoices(owner.sub!.id);
    const inv = invs[invs.length - 1];
    check(
      'INV-SEAT-CHARGE',
      'a confirmed seat is charged exactly the quote, now, and Stripe then bills the new quantity',
      r2.status === 201 &&
        invs.length === before + 1 &&
        inv?.status === 'paid' &&
        inv.amount_due === p.dueNow &&
        stubQuantity(owner) === newQ,
      () =>
        `${owner.key} +${coder.key} → ${r2.status} inv=${inv?.status}/${inv?.amount_due} quote=${p.dueNow} q=${stubQuantity(owner)}`,
    );
    if (r2.status !== 201) return false;
    settleImmediateInvoice(owner, ledgerNow.net);
    vol.seatsAdded += newQ - owner.sub!.seats;
    owner.sub!.seats = newQ;
    await emit(day, 'customer.subscription.updated', stub.getSubscription(owner.sub!.id), { allowDelay: true });
  }
  if (!already) b.holders.push(coder.userId);
  addCollabLedger(cv, coder.userId);
  vol.collaboratorsAdded++;
  return true;
}

async function inviteViewer(owner: Actor, cv: LCanvas, viewer: Actor) {
  await ensureSession(owner);
  const before = owner.sub ? stub.invoices(owner.sub.id).length : 0;
  const q = owner.sub ? stubQuantity(owner) : null;
  const r = await owner.c.req('POST', `canvas/${cv.id}/collaborators`, { email: viewer.email, role: 'viewer' });
  check(
    'INV-VIEWER-FREE',
    'a read-only viewer is added without a quote, a charge or a seat',
    r.status === 201 && (!owner.sub || (stub.invoices(owner.sub.id).length === before && stubQuantity(owner) === q)),
    () => `${owner.key} viewer → ${r.status}`,
  );
  if (r.status === 201) {
    addCollabLedger(cv, viewer.userId);
    vol.viewersAdded++;
    const w = await viewer.c.req('POST', `canvas/${cv.id}/questions`, { text: 'viewer tries to write' });
    check('INV-VIEWER-READONLY', 'a viewer cannot write', w.status === 403, () => `${viewer.key} → ${w.status}`);
  }
}

async function removeCoder(owner: Actor, cv: LCanvas, coder: Actor, day: number) {
  await ensureSession(owner);
  const b = seatBook(owner);
  const oldQ = owner.sub!.seats;
  const staleSnapshot = stub.getSubscription(owner.sub!.id);
  const pendingBefore = stub.pendingItems(owner.sub!.id).length;
  const invBefore = stub.invoices(owner.sub!.id).length;
  const at = Math.floor(Date.now() / 1000);
  const r = await owner.c.req('DELETE', `canvas/${cv.id}/collaborators/${coder.userId}`);
  b.holders = b.holders.filter((id) => id !== coder.userId);
  collaborators.get(cv.id)?.delete(coder.userId);
  const newQ = Math.max(1, 1 + b.holders.length);
  const credit = stub
    .pendingItems(owner.sub!.id)
    .slice(pendingBefore)
    .reduce((t: number, l: any) => t + l.amount, 0);
  const expected = ledgerProration(owner, oldQ, newQ, at);
  check(
    'INV-SEAT-RELEASE',
    'removing a coder frees the seat at once: quantity drops, unused time is credited, no card charge',
    r.status === 200 &&
      stubQuantity(owner) === newQ &&
      credit < 0 &&
      Math.abs(credit - expected) <= 2 &&
      stub.invoices(owner.sub!.id).length === invBefore,
    () =>
      `${owner.key} -${coder.key} → ${r.status} q=${stubQuantity(owner)}/${newQ} credit=${credit} ledger=${expected}`,
  );
  seatBook(owner).pendingCredit += expected;
  vol.seatsReleased += oldQ - newQ;
  owner.sub!.seats = newQ;
  await emit(day, 'customer.subscription.updated', stub.getSubscription(owner.sub!.id));
  // Stripe's earlier snapshot (the old, higher quantity) arrives a day late.
  delayed.push({ deliverOn: day + 1, event: mkEvent('customer.subscription.updated', staleSnapshot) });
  vol.webhooksDelayed++;
  note(`${owner.key} removed coder ${coder.key} (stale quantity ${oldQ} snapshot queued)`);
}

async function declinedCoderInvite(owner: Actor, cv: LCanvas, coder: Actor) {
  await ensureSession(owner);
  stub.setCard(owner.sub!.customer, 'declined');
  const q = stubQuantity(owner);
  const r = await owner.c.req('POST', `canvas/${cv.id}/collaborators`, {
    email: coder.email,
    role: 'editor',
    confirmSeatCharge: true,
  });
  const invs = stub.invoices(owner.sub!.id);
  const list = await owner.c.req('GET', `canvas/${cv.id}/collaborators`);
  const peek = await coder.c.req('GET', `canvas/${cv.id}`);
  check(
    'INV-SEAT-DECLINE',
    'a declined card adds no seat and no coder, and leaves no open invoice',
    r.status === 402 &&
      r.body?.code === 'SEAT_PAYMENT_FAILED' &&
      stubQuantity(owner) === q &&
      invs[invs.length - 1]?.status === 'void' &&
      !(list.body?.data ?? []).some((c: any) => c.userId === coder.userId) &&
      peek.status === 403,
    () =>
      `${owner.key} +${coder.key} → ${r.status} ${r.body?.code} q=${stubQuantity(owner)} inv=${invs[invs.length - 1]?.status} peek=${peek.status}`,
  );
  vol.seatDeclines++;
  stub.setCard(owner.sub!.customer, 'ok');
  note(`${owner.key} card declined while adding ${coder.key}: nothing added`);
}

/** Owner adds the seats their unseated coders need (Account → Seats). */
async function addMissingSeats(owner: Actor, day: number) {
  await ensureSession(owner);
  const newQ = 1 + seatBook(owner).holders.length;
  const r1 = await owner.c.req('POST', 'billing/seats', { quantity: newQ });
  const p = r1.body?.preview;
  check(
    'INV-SEAT-QUOTE',
    'a coder needing a seat is quoted (402) the Stripe proration for the rest of the period',
    r1.status === 402 &&
      p?.newQuantity === newQ &&
      Math.abs(p.dueNow - ledgerDueNow(owner, owner.sub!.seats, newQ, p.prorationDate).due) <= 1,
    () => `${owner.key} seats→${newQ}: ${r1.status} ${JSON.stringify(p)}`,
  );
  if (r1.status !== 402) return;
  vol.seatQuotes++;
  const r2 = await owner.c.req('POST', 'billing/seats', {
    quantity: newQ,
    confirmSeatCharge: true,
    prorationDate: p.prorationDate,
  });
  const invs = stub.invoices(owner.sub!.id);
  check(
    'INV-SEAT-CHARGE',
    'a confirmed seat is charged exactly the quote, now, and Stripe then bills the new quantity',
    r2.status === 200 && invs[invs.length - 1]?.amount_due === p.dueNow && stubQuantity(owner) === newQ,
    () => `${owner.key} → ${r2.status} q=${stubQuantity(owner)}`,
  );
  if (r2.status === 200) {
    settleImmediateInvoice(owner, ledgerDueNow(owner, owner.sub!.seats, newQ, p.prorationDate).net);
    vol.seatsAdded += newQ - owner.sub!.seats;
    owner.sub!.seats = newQ;
    await emit(day, 'customer.subscription.updated', stub.getSubscription(owner.sub!.id), { allowDelay: true });
    note(`${owner.key} added seats → ${newQ}`);
  }
}

/** A coder on an owner's canvas writes; the ledger says whether a seat/grace allows it. */
async function coderWrite(owner: Actor, cv: LCanvas, coder: Actor) {
  if (cv.transcripts.size === 0 || cv.codes.size === 0) return;
  const unseated = !seatedCoder(owner, coder.userId);
  const book = seatBook(owner);
  const nowMs = Date.now();
  const graceOver = book.graceEndLatest !== null && nowMs >= book.graceEndLatest;
  // Within the few ms between request and response of the call that started
  // grace, the app's exact instant is unknowable to an independent ledger.
  const ambiguous = unseated && book.graceEnd !== null && nowMs >= book.graceEnd && !graceOver;
  const allowed = !(unseated && graceOver);
  const [t, content] = pick([...cv.transcripts.entries()]);
  const q = pick([...cv.codes]);
  const start = Math.floor(rand() * Math.max(1, content.length - 40));
  const end = Math.min(content.length, start + 10 + Math.floor(rand() * 60));
  const r = await coder.c.req('POST', `canvas/${cv.id}/codings`, {
    transcriptId: t,
    questionId: q,
    startOffset: start,
    endOffset: end,
    codedText: content.slice(start, end),
  });
  check(
    'INV-SEAT-GRACE',
    'an unseated coder can edit during the 30-day grace and not after it; a seated coder always can',
    ambiguous
      ? r.status === 201 || (r.status === 403 && r.body?.code === 'SEAT_REQUIRED_FOR_EDITING')
      : allowed
        ? r.status === 201
        : r.status === 403 && r.body?.code === 'SEAT_REQUIRED_FOR_EDITING',
    () => `${coder.key} unseated=${unseated} graceOver=${graceOver} → ${r.status} ${r.body?.code ?? ''}`,
  );
  if (r.status === 201) {
    cv.codings.set(r.body.data.id, { id: r.body.data.id, t, q, start, end });
    vol.codings++;
    if (unseated) vol.graceWritesAllowed++;
  } else vol.graceWritesRefused++;
  const read = await coder.c.req('GET', `canvas/${cv.id}`);
  check(
    'INV-SEAT-READ',
    'a coder never loses read access over seats',
    read.status === 200,
    () => `${coder.key} → ${read.status}`,
  );
}

/** Account → Seats against the ledger. */
async function seatStatusCheck(a: Actor, label: string) {
  if (!a.sub) return;
  await ensureSession(a);
  const sentAt = Date.now();
  const r = await a.c.req('GET', 'billing/seats');
  const d = r.body?.data;
  if (a.sub.status === 'past_due') return; // plan during dunning is decision D1; not asserted here
  if (!billedPerSeat(a)) {
    check(
      'INV-SEAT-MODE',
      'only live Pro/Team subscriptions are billed per seat',
      d?.mode !== 'billed',
      () => `${label} ${a.key} mode=${d?.mode}`,
    );
    return;
  }
  const b = seatBook(a);
  const used = 1 + b.holders.length;
  // Seats nobody holds are credited back when the owner looks (never here, in this cast).
  if (a.sub.seats > used) a.sub.seats = used;
  const unseated = Math.max(0, used - a.sub.seats);
  if (unseated > 0 && b.graceEnd === null) {
    b.graceEnd = sentAt + 30 * DAY;
    b.graceEndLatest = Date.now() + 30 * DAY;
  }
  const graceOk =
    unseated === 0 ? d?.graceEndsAt === null : Math.abs(Date.parse(d?.graceEndsAt) - (b.graceEnd ?? 0)) <= 60_000;
  check(
    'INV-SEAT-STATUS',
    'seats paid (app) == Stripe quantity == ledger; seats in use, unseated coders and grace date == ledger',
    r.status === 200 &&
      d.mode === 'billed' &&
      d.seatsPurchased === a.sub.seats &&
      stubQuantity(a) === a.sub.seats &&
      d.seatsUsed === used &&
      d.unseatedCount === unseated &&
      graceOk,
    () =>
      `${label} ${a.key} app=${d?.seatsPurchased}/${d?.seatsUsed}/${d?.unseatedCount}/${d?.graceEndsAt} stripe=${stubQuantity(a)} ledger=${a.sub?.seats}/${used}/${unseated}/${b.graceEnd && new Date(b.graceEnd).toISOString()}`,
  );
}

// ─── jobs ────────────────────────────────────────────────────────────────────
let jobs: any;
async function runJobs(day: number, opts: { reconcile: boolean }) {
  const r1 = await jobs.pruneCanvasTrash(new Date());
  vol.purgedByJob += r1?.deleted ?? 0;
  const r2 = await jobs.pruneAuditLogs(new Date());
  await jobs.processLifecycleEmails();
  vol.jobRuns += 3;
  if (opts.reconcile) {
    await jobs.reconcileStripeSubscriptions();
    vol.jobRuns++;
  }
  // Replay: the same run again right away must change nothing.
  if (chance(0.15)) {
    vol.jobReplays++;
    const again = await jobs.pruneCanvasTrash(new Date());
    check('INV-JOB-IDEMPOTENT', 'a replayed trash-retention run purges nothing new', (again?.deleted ?? 0) === 0, () =>
      JSON.stringify(again),
    );
    if (opts.reconcile) await jobs.reconcileStripeSubscriptions();
  }
  const oldest = await jobs.prisma.auditLog.findFirst({ orderBy: { timestamp: 'asc' }, select: { timestamp: true } });
  check(
    'INV-AUDIT-RETENTION',
    'no audit-log row is older than 90 days after the retention job',
    !oldest || Date.now() - oldest.timestamp.getTime() <= 90 * DAY + DAY,
    () => `oldest=${oldest?.timestamp.toISOString()}`,
  );
  return { r1, r2 };
}

async function restamp(realFrom: Date) {
  const realTo = new Date(Date.now() - clock.offset() + 60_000);
  const sim = new Date();
  const p = jobs.prisma;
  await p.$executeRawUnsafe(
    `UPDATE "AuditLog" SET "timestamp" = $1 WHERE "timestamp" BETWEEN $2 AND $3`,
    sim,
    realFrom,
    realTo,
  );
  for (const table of ['User', 'CodingCanvas', 'CanvasTranscript', 'CanvasTextCoding', 'WebhookEvent']) {
    await p
      .$executeRawUnsafe(
        `UPDATE "${table}" SET "createdAt" = $1 WHERE "createdAt" BETWEEN $2 AND $3`,
        sim,
        realFrom,
        realTo,
      )
      .catch(() => 0);
  }
}

// ─── cast ────────────────────────────────────────────────────────────────────
async function buildCast() {
  const free = await signupActor('free-unverified', { verify: false });
  free.script = async (d) => {
    if (d % 2 === 0) await work(free, 0.6);
  };

  const trial = await signupActor('trial-lapses', { verify: true, consent: true });
  trial.script = async (d) => {
    if (d < 20 || d % 5 === 0) await work(trial, 0.8);
  };

  const proM = await signupActor('pro-monthly', { verify: true });
  proM.script = async (d) => {
    if (d === 3) await subscribe(proM, d, 'price_qc_pro_m');
    if (d === 120) await failPayment(proM, d);
    if (d === 123) await recoverPayment(proM, d);
    await work(proM, 0.9);
  };

  const proY = await signupActor('pro-annual', { verify: true });
  proY.script = async (d) => {
    if (d === 10) await subscribe(proY, d, 'price_qc_pro_y');
    await work(proY, 0.7);
  };

  // Team, billed per seat. Day 2: two coders (each quoted, confirmed and
  // charged) and a free viewer. Day 45: a coder is removed (credit) and the
  // stale higher-quantity snapshot arrives late. Day 60: re-invited. Day 90:
  // the card is declined while adding a third coder (nothing added), then it
  // succeeds. Day 180: Team → Pro, seats and coders kept.
  const team = await signupActor('team-owner', { verify: true });
  const coders = [
    await signupActor('team-coder-1', { verify: true }),
    await signupActor('team-coder-2', { verify: true }),
  ];
  const coder3 = await signupActor('team-coder-3', { verify: true });
  const teamViewer = await signupActor('team-viewer', { verify: true });
  const onShared = new Set<Actor>();
  const sharedCanvas = () => [...collaborators.keys()].map((id) => team.canvases.get(id)).find((c) => c?.live);
  team.script = async (d) => {
    if (d === 1) await subscribe(team, d, 'price_qc_team_m');
    if (d === 2) {
      const cv = liveCanvases(team)[0] ?? (await createCanvas(team, d), liveCanvases(team)[0]);
      for (const c of coders) if (await inviteCoder(team, cv, c, d)) onShared.add(c);
      await inviteViewer(team, cv, teamViewer);
    }
    const shared = sharedCanvas();
    if (d === 45 && shared) {
      await removeCoder(team, shared, coders[1], d);
      onShared.delete(coders[1]);
    }
    if (d === 60 && shared && (await inviteCoder(team, shared, coders[1], d))) onShared.add(coders[1]);
    if (d === 90 && shared) {
      await declinedCoderInvite(team, shared, coder3);
      if (await inviteCoder(team, shared, coder3, d)) onShared.add(coder3);
    }
    if (d === 180) await switchPlan(team, d, 'price_qc_pro_m');
    if (d === 181) await seatStatusCheck(team, 'after Team→Pro');
    await work(team, 0.9);
    if (shared && d > 2) for (const c of onShared) if (chance(0.5)) await codePassage(team, shared, c);
  };
  for (const c of [...coders, coder3, teamViewer])
    c.script = async (d) => {
      if (d % 7 === 0) await work(c, 0.3);
    };

  // Coders added during a free trial; the owner then buys Pro but lowers the
  // seats to 1 at checkout. Both coders are unseated: they keep editing for
  // 30 days, are read-only after that, and edit again once the owner adds
  // the 2 seats on day 60.
  const graceOwner = await signupActor('grace-owner', { verify: true });
  const graceCoders = [
    await signupActor('grace-coder-1', { verify: true }),
    await signupActor('grace-coder-2', { verify: true }),
  ];
  let graceCanvas: LCanvas | undefined;
  graceOwner.script = async (d) => {
    if (d === 1) {
      await createCanvas(graceOwner, d);
      graceCanvas = liveCanvases(graceOwner)[0];
      if (graceCanvas) {
        await addTranscript(graceOwner, graceCanvas);
        await addCode(graceOwner, graceCanvas);
        for (const c of graceCoders) await inviteCoder(graceOwner, graceCanvas, c, d);
      }
    }
    if (d === 8) {
      await subscribe(graceOwner, d, 'price_qc_pro_m', { quantity: 1 });
      await seatStatusCheck(graceOwner, 'after checkout with fewer seats');
    }
    if (d === 60) await addMissingSeats(graceOwner, d);
    await work(graceOwner, 0.5);
    if (graceCanvas?.live && d > 1)
      for (const c of graceCoders) if (chance(0.6)) await coderWrite(graceOwner, graceCanvas, c);
  };
  for (const c of graceCoders) c.script = async () => {};

  const student = await signupActor('student', { verify: true, academic: true });
  student.script = async (d) => {
    if (d === 5) await subscribe(student, d, 'price_qc_student_m');
    if (d === 140) await cancelAtPeriodEnd(student, d);
    await work(student, 0.7);
  };

  const lapsed = await signupActor('card-dies', { verify: true });
  lapsed.script = async (d) => {
    if (d === 15) await subscribe(lapsed, d, 'price_qc_pro_m');
    if (d === 200) await failPayment(lapsed, d);
    if (d === 214) await cancelNow(lapsed, d);
    await work(lapsed, 0.6);
  };

  const buysInTrial = await signupActor('buys-in-trial', { verify: true });
  buysInTrial.script = async (d) => {
    if (d === 5) await subscribe(buysInTrial, d, 'price_qc_pro_m');
    if (d === 250) await cancelNow(buysInTrial, d);
    if (d === 290) await subscribe(buysInTrial, d, 'price_qc_team_y');
    await work(buysInTrial, 0.6);
  };

  // Signs up, opts in to email, and never starts a project: the only kind of
  // user the timed activation emails are for. Also one who never opts in.
  const dormant = await signupActor('dormant-optin', { verify: true, consent: true });
  dormant.script = async (d) => {
    if (d === 40) await ensureSession(dormant); // one visit, then silence
  };
  const dormantNoConsent = await signupActor('dormant-no-consent', { verify: true, consent: false });
  dormantNoConsent.script = async () => {};

  const legacy = await legacyActor();
  legacy.script = async (d) => {
    if (d === 30) await subscribe(legacy, d, 'price_qc_team_m');
    if (d === 240) await cancelNow(legacy, d);
    await work(legacy, 0.5);
  };
}

/** A pre-2026 access-code researcher who linked an email (grandfathered Pro). */
async function legacyActor(): Promise<Actor> {
  const { hashAccessCode } = await import('../../../apps/backend/src/utils/hashing.ts');
  const code = `SIM-LEGACY-${SEED}-access-code`;
  const { sha256Index, bcryptHash } = await hashAccessCode(code);
  await jobs.prisma.dashboardAccess.create({
    data: {
      accessCode: sha256Index,
      accessCodeHash: bcryptHash,
      name: 'Legacy researcher',
      role: 'researcher',
      expiresAt: new Date('2099-12-31'),
    },
  });
  const c = new Client();
  const r0 = await c.req('POST', 'auth', { dashboardCode: code });
  const email = `sim-legacy-${SEED}@example.com`;
  const password = throwawayCredential();
  const r = await c.req('POST', 'auth/link-account', { email, password, name: 'Sim legacy' });
  c.creds = { email, password };
  check(
    'INV-LEGACY-LINK',
    'a legacy access-code user can link an email account',
    r0.status === 200 && r.status < 300,
    () => `${r0.status}/${r.status} ${JSON.stringify(r.body).slice(0, 120)}`,
  );
  const a: Actor = {
    key: 'legacy',
    c,
    email,
    password,
    userId: r.body?.data?.user?.id,
    verified: false,
    legacy: true,
    consent: false,
    trialEndsAt: null,
    sub: null,
    canvases: new Map(),
    script: async () => {},
  };
  const me = await c.req('GET', 'auth/me');
  a.verified = !!me.body?.data?.user?.emailVerified;
  if (me.body?.data?.user?.trialEndsAt) a.trialEndsAt = Date.parse(me.body.data.user.trialEndsAt);
  actors.push(a);
  vol.actors++;
  return a;
}

async function work(a: Actor, intensity: number) {
  if (!chance(intensity)) return;
  await ensureSession(a);
  const paid = expectedPlan(a).effective !== 'free';
  if (liveCanvases(a).length === 0 || chance(0.06)) await createCanvas(a, 0);
  const live = liveCanvases(a);
  if (!live.length) return;
  const cv = pick(live);
  if (chance(0.3)) await addTranscript(a, cv);
  if (chance(0.25)) await addCode(a, cv);
  for (let i = 0; i < 1 + Math.floor(rand() * 3); i++) await codePassage(a, cv);
  if (chance(0.05)) await deleteCoding(a, cv);
  if (paid && chance(0.03)) await anonymise(a, cv);
  // Canvases shared with coders stay put, so seat counts stay deterministic.
  const trashable = live.filter((c) => !collaborators.has(c.id));
  if (chance(0.02) && live.length > 1 && trashable.length) await trashCanvas(a, pick(trashable));
  const trashed = [...a.canvases.values()].filter(
    (c) => !c.live && !c.purged && Date.now() - (c.trashedAt ?? 0) < 25 * DAY,
  );
  if (trashed.length && chance(0.05)) await restoreCanvas(a, pick(trashed));
}

// ─── main ────────────────────────────────────────────────────────────────────
async function main() {
  const t0 = performance.now();
  await stub.listen();
  const appMod = await import('../../../apps/backend/src/index.ts');
  void appMod;
  const [trash, audit, lifecycle, reconcile, prismaMod] = await Promise.all([
    import('../../../apps/backend/src/jobs/canvasTrashRetention.ts'),
    import('../../../apps/backend/src/jobs/auditRetention.ts'),
    import('../../../apps/backend/src/jobs/lifecycleEmailScheduler.ts'),
    import('../../../apps/backend/src/jobs/stripeReconciliation.ts'),
    import('../../../apps/backend/src/lib/prisma.ts'),
  ]);
  jobs = {
    pruneCanvasTrash: trash.pruneCanvasTrash,
    pruneAuditLogs: audit.pruneAuditLogs,
    processLifecycleEmails: lifecycle.processLifecycleEmails,
    reconcileStripeSubscriptions: reconcile.reconcileStripeSubscriptions,
    prisma: prismaMod.prisma,
  };
  // Wait for the server to accept connections.
  for (let i = 0; i < 100; i++) {
    try {
      if ((await fetch(`http://127.0.0.1:${PORT}/ready`)).ok) break;
    } catch {
      /* not yet */
    }
    await new Promise((r) => setTimeout(r, 200));
  }

  await buildCast();
  const days = Math.round(
    (Date.UTC(START.getUTCFullYear(), START.getUTCMonth() + MONTHS, START.getUTCDate()) - START.getTime()) / DAY,
  );
  const downtime = new Set([70, 71, 72, 73, 74]); // jobs do not run (deploy outage), then catch up
  for (let day = 0; day < days; day++) {
    const realFrom = new Date(Date.now() - clock.offset() - 1000);
    clock.set(new Date(START.getTime() + day * DAY).toISOString());

    for (const pe of delayed.filter((p) => p.deliverOn <= day)) {
      await deliver(pe.event);
      delayed.splice(delayed.indexOf(pe), 1);
    }
    for (const a of actors) {
      await a.script(day);
      await renewIfDue(a, day);
    }
    if (day % 7 === 3) await isolationCheck();
    if (day % 14 === 0) for (const a of actors) await statsCheck(a);
    if (day % 30 === 15) for (const a of actors) await qdpxRoundTrip(a);

    await restamp(realFrom);
    if (downtime.has(day)) vol.downtimeDaysSkipped++;
    else await runJobs(day, { reconcile: day % 7 === 0 || day === 75 });
    if (day % 7 === 6 || day === days - 1)
      for (const a of actors) {
        await verifyActorState(a, `day${day}`);
        await seatStatusCheck(a, `day${day}`);
      }
  }

  // Lifecycle email: at most one of each message per person, only to people who asked.
  const mail = fs
    .readFileSync(process.env.NETGUARD_OUTBOX!, 'utf8')
    .split('\n')
    .filter(Boolean)
    .map((l) => JSON.parse(l));
  const lifecycleSubjects =
    /Welcome to QualCanvas|useful next step|first-project path|Pick up your QualCanvas|shaping your next|simpler way back/;
  const perKey = new Map<string, number>();
  for (const e of mail.filter((m) => m.kind === 'email' && lifecycleSubjects.test(m.subject))) {
    const k = `${e.to}|${e.subject}`;
    perKey.set(k, (perKey.get(k) ?? 0) + 1);
  }
  for (const [k, n] of perKey)
    check('INV-EMAIL-ONCE', 'each lifecycle email reaches a person at most once', n === 1, () => `${k} ×${n}`);
  if (perKey.size === 0) check('INV-EMAIL-ONCE', 'each lifecycle email reaches a person at most once', true, () => '');
  for (const e of mail.filter((m) => m.kind === 'email' && lifecycleSubjects.test(m.subject))) {
    const a = actors.find((x) => x.email === e.to);
    check(
      'INV-EMAIL-CONSENT',
      'lifecycle emails only go to people who opted in',
      !!a?.consent,
      () => `${e.to}: ${e.subject}`,
    );
  }
  const blocked = mail.filter((m) => String(m.kind).startsWith('blocked'));
  check('INV-NO-EGRESS', 'no outbound connection left the machine', blocked.length === 0, () =>
    JSON.stringify(blocked.slice(0, 3)),
  );
  check('INV-NO-5XX', 'no request answered 5xx', vol.http5xx === 0, () => `${vol.http5xx} × 5xx`);

  writeReport(Math.round((performance.now() - t0) / 1000), days, mail.filter((m) => m.kind === 'email').length);
  await stub.close();
  process.exit(0);
}

function writeReport(secs: number, days: number, emails: number) {
  const rows = [...invs.values()].sort((a, b) => a.id.localeCompare(b.id));
  const failing = rows.filter((r) => r.fail > 0);
  fs.writeFileSync(
    path.join(OUT, `results-${LABEL}.json`),
    JSON.stringify({ label: LABEL, seed: SEED, months: MONTHS, days, secs, vol, invariants: rows, events }, null, 2),
  );
  const md: string[] = [];
  md.push(`## Run: ${LABEL}`, '');
  md.push(
    `- Seed ${SEED}, ${MONTHS} months (${days} simulated days from ${START.toISOString().slice(0, 10)}), runtime ${secs}s`,
  );
  md.push(
    `- Rerun: \`node e2e/fullstack/simulation/fast-forward.mjs --months ${MONTHS} --seed ${SEED} --label ${LABEL}\``,
  );
  md.push(
    `- Invariants: ${rows.length} checked, ${failing.length} failing; ${rows.reduce((s, r) => s + r.pass + r.fail, 0)} individual checks`,
  );
  md.push(`- Emails captured: ${emails}; HTTP requests: ${vol.http}; 5xx: ${vol.http5xx}`, '');
  md.push('### Volumes', '', '| metric | value |', '|---|---|');
  for (const [k, v] of Object.entries(vol)) md.push(`| ${k} | ${v} |`);
  md.push('', '### Invariants', '', '| id | invariant | pass | fail | first failures |', '|---|---|---|---|---|');
  for (const r of rows)
    md.push(
      `| ${r.id} | ${r.desc} | ${r.pass} | ${r.fail} | ${r.examples.map((e) => e.replace(/\|/g, '/')).join('<br>')} |`,
    );
  md.push('');
  fs.writeFileSync(path.join(OUT, `report-${LABEL}.md`), md.join('\n'));
  console.log(md.join('\n'));
}

main().catch((err) => {
  console.error(err);
  writeReport(0, 0, 0);
  process.exit(1);
});
