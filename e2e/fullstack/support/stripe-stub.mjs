// Minimal stateful Stripe API double for the estate suite and simulation.
// Listens on 127.0.0.1 only. The backend reaches it because lib/stripe.ts
// honours STRIPE_API_HOST/PORT/PROTOCOL outside production.
//
// Implements only what QualCanvas calls:
//   GET  /v1/prices/:id           GET /v1/products/:id
//   POST /v1/customers            POST /v1/checkout/sessions
//   POST /v1/billing_portal/sessions
//   GET  /v1/subscriptions        GET /v1/subscriptions/:id
//   DELETE /v1/subscriptions/:id  POST /v1/subscription_items/:id
// plus a /__control API the tests use to drive subscription state and read
// back what the backend asked for.
import http from 'node:http';

export const PRICES = {
  price_qc_student_m: { plan: 'student', amount: 500, interval: 'month', app: 'qualcanvas' },
  price_qc_pro_m: { plan: 'pro', amount: 1200, interval: 'month', app: 'qualcanvas' },
  price_qc_pro_y: { plan: 'pro', amount: 11500, interval: 'year', app: 'qualcanvas' },
  price_qc_team_m: { plan: 'team', amount: 2900, interval: 'month', app: 'qualcanvas' },
  price_qc_team_y: { plan: 'team', amount: 27800, interval: 'year', app: 'qualcanvas' },
  // Untagged legacy price, resolved by product name.
  price_qc_legacy_pro: { plan: null, amount: 1200, interval: 'month', productName: 'QualCanvas Pro (legacy)' },
  // Another JMS product on the shared Stripe account.
  price_other_app: { plan: null, amount: 999, interval: 'month', productName: 'StaffHub Pro' },
};

const DAY = 86400;

export function createStripeStub({ port = 0 } = {}) {
  let seq = 0;
  const id = (p) => `${p}_stub${Date.now().toString(36)}${(++seq).toString(36)}`;
  const customers = new Map();
  const subscriptions = new Map();
  const sessions = new Map();
  const calls = [];

  function priceObject(priceId) {
    const p = PRICES[priceId];
    if (!p) return null;
    return {
      id: priceId,
      object: 'price',
      unit_amount: p.amount,
      currency: 'usd',
      recurring: { interval: p.interval },
      metadata: p.app ? { app: p.app, plan: p.plan } : {},
      product: {
        id: `prod_${priceId}`,
        object: 'product',
        name: p.productName ?? `QualCanvas ${p.plan[0].toUpperCase()}${p.plan.slice(1)}`,
      },
    };
  }

  function subObject(s) {
    return {
      id: s.id,
      object: 'subscription',
      customer: s.customer,
      status: s.status,
      cancel_at_period_end: s.cancel_at_period_end,
      metadata: s.metadata ?? {},
      items: {
        object: 'list',
        data: [
          {
            id: s.itemId,
            object: 'subscription_item',
            quantity: s.quantity,
            price: priceObject(s.price),
            current_period_start: s.current_period_start,
            current_period_end: s.current_period_end,
          },
        ],
      },
    };
  }

  /** Create a subscription directly (what Stripe does when a Checkout completes). */
  function createSubscription({ customer, price, status = 'active', now = Math.floor(Date.now() / 1000), metadata }) {
    const interval = PRICES[price]?.interval === 'year' ? 365 : 30;
    const s = {
      id: id('sub'),
      itemId: id('si'),
      customer,
      price,
      status,
      quantity: 1,
      cancel_at_period_end: false,
      current_period_start: now,
      current_period_end: now + interval * DAY,
      metadata,
    };
    subscriptions.set(s.id, s);
    return subObject(s);
  }

  function updateSubscription(subId, patch) {
    const s = subscriptions.get(subId);
    if (!s) return null;
    Object.assign(s, patch);
    return subObject(s);
  }

  function send(res, status, body) {
    res.writeHead(status, { 'content-type': 'application/json', 'request-id': id('req') });
    res.end(JSON.stringify(body));
  }
  const notFound = (res, what) =>
    send(res, 404, { error: { type: 'invalid_request_error', message: `No such ${what}`, code: 'resource_missing' } });

  function parseForm(raw) {
    const out = {};
    for (const [k, v] of new URLSearchParams(raw)) out[k] = v;
    return out;
  }

  const server = http.createServer((req, res) => {
    let raw = '';
    req.on('data', (c) => (raw += c));
    req.on('end', () => {
      const url = new URL(req.url, 'http://stub');
      const p = url.pathname;
      const form = req.headers['content-type']?.includes('json') ? JSON.parse(raw || '{}') : parseForm(raw);
      if (!p.startsWith('/__control')) calls.push({ method: req.method, path: p, query: url.search, form });

      // ---- control API ----
      if (p === '/__control/calls') return send(res, 200, calls);
      if (p === '/__control/reset') {
        calls.length = 0;
        return send(res, 200, { ok: true });
      }
      if (p === '/__control/subscriptions' && req.method === 'POST') return send(res, 200, createSubscription(form));
      if (p.startsWith('/__control/subscriptions/') && req.method === 'POST') {
        const r = updateSubscription(p.split('/').pop(), form);
        return r ? send(res, 200, r) : notFound(res, 'subscription');
      }
      if (p.startsWith('/__control/sessions/')) {
        const s = sessions.get(p.split('/').pop());
        return s ? send(res, 200, s) : notFound(res, 'session');
      }

      // ---- Stripe API ----
      let m;
      if ((m = p.match(/^\/v1\/prices\/([^/]+)$/))) {
        const pr = priceObject(decodeURIComponent(m[1]));
        return pr ? send(res, 200, pr) : notFound(res, 'price');
      }
      if ((m = p.match(/^\/v1\/products\/([^/]+)$/))) {
        const priceId = decodeURIComponent(m[1]).replace(/^prod_/, '');
        const pr = priceObject(priceId);
        return pr ? send(res, 200, pr.product) : notFound(res, 'product');
      }
      if (p === '/v1/customers' && req.method === 'POST') {
        const c = { id: id('cus'), object: 'customer', email: form.email, name: form.name };
        customers.set(c.id, c);
        return send(res, 200, c);
      }
      if (p === '/v1/checkout/sessions' && req.method === 'POST') {
        const s = {
          id: id('cs'),
          object: 'checkout.session',
          customer: form.customer,
          mode: form.mode,
          price: form['line_items[0][price]'],
          discount: form['discounts[0][coupon]'] ?? null,
          metadata: { userId: form['metadata[userId]'], plan: form['metadata[plan]'] },
          success_url: form.success_url,
        };
        s.url = `http://127.0.0.1:${server.address().port}/checkout/${s.id}`;
        sessions.set(s.id, s);
        return send(res, 200, s);
      }
      if (p === '/v1/billing_portal/sessions' && req.method === 'POST') {
        return send(res, 200, {
          id: id('bps'),
          object: 'billing_portal.session',
          url: `http://127.0.0.1:${server.address().port}/portal/${form.customer}`,
        });
      }
      if (p === '/v1/subscriptions' && req.method === 'GET') {
        const customer = url.searchParams.get('customer');
        const all = [...subscriptions.values()].filter((s) => !customer || s.customer === customer);
        const startingAfter = url.searchParams.get('starting_after');
        const limit = Number(url.searchParams.get('limit') ?? 10);
        let startIdx = 0;
        if (startingAfter) startIdx = all.findIndex((s) => s.id === startingAfter) + 1;
        const page = all.slice(startIdx, startIdx + limit);
        return send(res, 200, {
          object: 'list',
          data: page.map(subObject),
          has_more: startIdx + limit < all.length,
          url: '/v1/subscriptions',
        });
      }
      if ((m = p.match(/^\/v1\/subscriptions\/([^/]+)$/))) {
        const s = subscriptions.get(m[1]);
        if (!s) return notFound(res, 'subscription');
        if (req.method === 'DELETE') s.status = 'canceled';
        return send(res, 200, subObject(s));
      }
      if ((m = p.match(/^\/v1\/subscription_items\/([^/]+)$/)) && req.method === 'POST') {
        const s = [...subscriptions.values()].find((x) => x.itemId === m[1]);
        if (!s) return notFound(res, 'subscription_item');
        if (form.quantity) s.quantity = Number(form.quantity);
        return send(res, 200, subObject(s).items.data[0]);
      }
      return send(res, 404, { error: { type: 'invalid_request_error', message: `stub: unhandled ${req.method} ${p}` } });
    });
  });

  return {
    server,
    calls,
    createSubscription,
    updateSubscription,
    getSession: (sid) => sessions.get(sid),
    getSubscription: (sid) => (subscriptions.has(sid) ? subObject(subscriptions.get(sid)) : null),
    listen: () =>
      new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server.address().port))),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

// Allow running standalone: `node stripe-stub.mjs 4914`
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const stub = createStripeStub({ port: Number(process.argv[2] ?? 4914) });
  stub.listen().then((p) => console.log(`[stripe-stub] listening on 127.0.0.1:${p}`));
}
