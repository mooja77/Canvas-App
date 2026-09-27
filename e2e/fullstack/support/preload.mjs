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
//                             -> canned AI completion
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
    res.end(JSON.stringify({ now: new RealDate(RealDate.now() + offsetMs).toISOString(), offsetMs, blocked: blockedCount }));
  });
  server.on('error', (err) => console.error('[preload] clock control server failed', err));
  server.listen(clockPort, '127.0.0.1');
  server.unref();
}
