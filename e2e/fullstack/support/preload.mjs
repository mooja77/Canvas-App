// Preloaded into the backend process for the full-stack estate suite and the
// 12-month simulation (`node --import ./e2e/fullstack/support/preload.mjs`).
//
// Purpose: prove that NOTHING leaves the machine. Every outbound TCP connection
// that is not loopback is refused, and the three HTTP services the backend
// legitimately talks to are answered by in-process stubs that record what was
// sent, so tests can assert on it:
//
//   api.resend.com            -> email outbox (NETGUARD_OUTBOX, JSON lines)
//   admin.jmsdevlab.com       -> event-ingest outbox (same file)
//   api.openai.com / api.anthropic.com / generativelanguage.googleapis.com
//                             -> canned AI completion (Whisper transcriptions
//                                included; POST /whisper?fail=1 on the clock
//                                port makes them fail)
//
// Stripe does not go through fetch: the backend's Stripe SDK is pointed at the
// local Stripe stub (STRIPE_API_HOST/PORT/PROTOCOL, honoured only outside
// production) and any attempt to reach api.stripe.com is refused by the socket
// guard below.
import net from 'node:net';
import fs from 'node:fs';
import path from 'node:path';

const OUTBOX = process.env.NETGUARD_OUTBOX || '';
if (OUTBOX) {
  try {
    fs.mkdirSync(path.dirname(OUTBOX), { recursive: true });
  } catch {
    /* best effort */
  }
}
const LOOPBACK = new Set(['localhost', '127.0.0.1', '::1', '0.0.0.0', '']);
let blockedCount = 0;

function record(entry) {
  if (!OUTBOX) return;
  try {
    fs.appendFileSync(OUTBOX, JSON.stringify({ at: new Date().toISOString(), ...entry }) + '\n');
  } catch {
    /* best effort */
  }
}

function hostOf(options, maybeHost) {
  if (typeof options === 'object' && options !== null) {
    if (options.path && !options.host && !options.port) return 'unix-socket';
    return String(options.host ?? options.hostname ?? 'localhost');
  }
  if (typeof options === 'number') return String(maybeHost ?? 'localhost');
  if (typeof options === 'string' && Number.isNaN(Number(options))) return 'unix-socket';
  return 'localhost';
}

const originalConnect = net.Socket.prototype.connect;
net.Socket.prototype.connect = function guardedConnect(...args) {
  const first = Array.isArray(args[0]) ? args[0][0] : args[0];
  const host = hostOf(first, args[1]);
  if (host !== 'unix-socket' && !LOOPBACK.has(host) && !host.startsWith('127.')) {
    blockedCount += 1;
    record({ kind: 'blocked-socket', host });
    const err = new Error(`[network-guard] outbound connection to ${host} blocked`);
    err.code = 'ENETGUARD';
    process.nextTick(() => this.destroy(err));
    return this;
  }
  return originalConnect.apply(this, args);
};

// Whisper stub state, switched by tests through the control server below.
const whisper = {
  fail: false,
  durationSec: 125,
  text: 'Interviewer: How did the new rota change your week? Participant: Honestly it gave me my evenings back, but the handovers got rushed and we lost two experienced nurses.',
};

const originalFetch = globalThis.fetch;
globalThis.fetch = async function guardedFetch(input, init = {}) {
  const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
  if (LOOPBACK.has(url.hostname) || url.hostname.startsWith('127.')) {
    return originalFetch(input, init);
  }
  let body = init.body;
  if (typeof body !== 'string' && body != null) {
    try {
      body = await new Response(body).text();
    } catch {
      body = '[unreadable]';
    }
  }
  let parsed = null;
  try {
    parsed = body ? JSON.parse(body) : null;
  } catch {
    parsed = body;
  }

  if (url.hostname === 'api.resend.com') {
    const id = `stub_email_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    record({ kind: 'email', to: parsed?.to, subject: parsed?.subject, html: parsed?.html, id });
    return new Response(JSON.stringify({ id }), { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.hostname === 'admin.jmsdevlab.com') {
    record({ kind: 'jms-event', body: parsed });
    return new Response('{"ok":true}', { status: 200, headers: { 'content-type': 'application/json' } });
  }
  if (url.hostname === 'api.openai.com' && url.pathname.endsWith('/audio/transcriptions')) {
    // Whisper. Answer with a verbose_json transcription, or a 400 while the
    // test has switched failure on through the control server (/whisper).
    const hdrs = new Headers(
      init.headers ?? (typeof Request !== 'undefined' && input instanceof Request ? input.headers : {}),
    );
    const auth = String(hdrs.get('authorization') ?? '');
    record({ kind: 'ai', provider: 'openai', path: url.pathname, keyKind: auth.includes('sk-byo') ? 'byo' : 'server' });
    if (whisper.fail) {
      return new Response(
        JSON.stringify({ error: { message: 'Audio file could not be decoded (stub)', type: 'invalid_request_error' } }),
        { status: 400, headers: { 'content-type': 'application/json' } },
      );
    }
    const words = whisper.text.split(/\s+/);
    const half = Math.ceil(words.length / 2);
    return new Response(
      JSON.stringify({
        task: 'transcribe',
        language: 'english',
        duration: whisper.durationSec,
        text: whisper.text,
        segments: [
          { id: 0, start: 0, end: whisper.durationSec / 2, text: words.slice(0, half).join(' ') },
          { id: 1, start: whisper.durationSec / 2, end: whisper.durationSec, text: words.slice(half).join(' ') },
        ],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  if (url.hostname === 'api.openai.com') {
    record({ kind: 'ai', provider: 'openai', path: url.pathname });
    const content = process.env.NETGUARD_AI_REPLY || '{"suggestions":[]}';
    return new Response(
      JSON.stringify({
        id: 'chatcmpl-stub',
        object: 'chat.completion',
        created: Math.floor(Date.now() / 1000),
        model: 'stub',
        choices: [{ index: 0, message: { role: 'assistant', content }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 10, completion_tokens: 10, total_tokens: 20 },
        data: [{ embedding: new Array(8).fill(0.1), index: 0 }],
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  if (url.hostname === 'api.anthropic.com') {
    record({ kind: 'ai', provider: 'anthropic', path: url.pathname });
    const text = process.env.NETGUARD_AI_REPLY || '{"suggestions":[]}';
    return new Response(
      JSON.stringify({
        id: 'msg_stub',
        type: 'message',
        role: 'assistant',
        model: 'stub',
        content: [{ type: 'text', text }],
        stop_reason: 'end_turn',
        usage: { input_tokens: 10, output_tokens: 10 },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  }
  blockedCount += 1;
  record({ kind: 'blocked-fetch', host: url.hostname, path: url.pathname });
  throw new TypeError(`[network-guard] fetch to ${url.hostname} blocked`);
};

// ─── Google ID-token certificates ────────────────────────────────────────────
// google-auth-library fetches Google's signing certs with node-fetch (a raw
// https socket, refused above). Serve the harness key instead, at the one
// method that fetches them, so verifyIdToken still checks the RS256 signature,
// audience, issuer and expiry for real. Never active in production.
if (process.env.QC_FS_GOOGLE_PUBLIC_PEM && process.env.NODE_ENV !== 'production') {
  const { OAuth2Client } = await import('google-auth-library');
  const kid = process.env.QC_FS_GOOGLE_KID || 'estate-google-key-1';
  const pem = process.env.QC_FS_GOOGLE_PUBLIC_PEM;
  OAuth2Client.prototype.getFederatedSignonCertsAsync = async function stubbedGoogleCerts() {
    record({ kind: 'google-certs' });
    return { certs: { [kid]: pem }, format: 'PEM' };
  };
}

globalThis.__networkGuard = { blocked: () => blockedCount };
record({ kind: 'guard-installed', pid: process.pid });

// ─── Controllable clock ──────────────────────────────────────────────────────
// Date.now() / new Date() return real time + an offset. The simulation moves
// the offset through a tiny control server on $CLOCK_PORT:
//   GET  /clock            -> { now, offsetMs, blocked }
//   POST /clock?now=<ISO>  -> jump to that instant
//   POST /clock?offsetMs=N
// Timestamps Postgres/Prisma-engine stamp themselves (@default(now()),
// @updatedAt) are NOT covered; the simulation re-stamps those rows itself.
import http from 'node:http';
import { isMainThread } from 'node:worker_threads';

const RealDate = Date;
let offsetMs = Number(process.env.CLOCK_OFFSET_MS ?? 0) || 0;
class HarnessDate extends RealDate {
  constructor(...args) {
    if (args.length === 0) super(RealDate.now() + offsetMs);
    else super(...args);
  }
  static now() {
    return RealDate.now() + offsetMs;
  }
}
globalThis.Date = new Proxy(HarnessDate, {
  apply() {
    return new HarnessDate().toString();
  },
});
globalThis.__harnessClock = {
  set(iso) {
    offsetMs = RealDate.parse(iso) - RealDate.now();
  },
  offset: () => offsetMs,
};

const clockPort = Number(process.env.CLOCK_PORT ?? 0);
if (clockPort && isMainThread) {
  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname === '/whisper') {
      if (req.method === 'POST') {
        if (url.searchParams.has('fail')) whisper.fail = url.searchParams.get('fail') === '1';
        if (url.searchParams.has('text')) whisper.text = url.searchParams.get('text') || whisper.text;
        if (url.searchParams.has('durationSec'))
          whisper.durationSec = Number(url.searchParams.get('durationSec')) || 60;
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify(whisper));
      return;
    }
    if (url.pathname !== '/clock') {
      res.writeHead(404).end();
      return;
    }
    if (req.method === 'POST') {
      const now = url.searchParams.get('now');
      const off = url.searchParams.get('offsetMs');
      if (now) offsetMs = RealDate.parse(now) - RealDate.now();
      else if (off != null) offsetMs = Number(off) || 0;
    }
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(
      JSON.stringify({ now: new RealDate(RealDate.now() + offsetMs).toISOString(), offsetMs, blocked: blockedCount }),
    );
  });
  server.on('error', (err) => console.error('[preload] clock control server failed', err));
  server.listen(clockPort, '127.0.0.1');
  server.unref();
}
