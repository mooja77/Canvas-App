// Minimal stateful Stripe API double for the estate suite and simulation.
// Listens on 127.0.0.1 only. The backend reaches it because lib/stripe.ts
// honours STRIPE_API_HOST/PORT/PROTOCOL outside production.
//
// Implements only what QualCanvas calls:
//   GET  /v1/prices/:id           GET /v1/products/:id
//   GET  /v1/prices/search        (metadata['plan'] / metadata['app'] only)
//   POST /v1/customers            POST /v1/checkout/sessions
//   POST /v1/billing_portal/sessions
//   GET  /v1/subscriptions        GET /v1/subscriptions/:id
//   DELETE /v1/subscriptions/:id  POST /v1/subscription_items/:id
//   POST /v1/subscriptions/:id    (seat quantity and price changes, with prorations)
//   POST /v1/invoices/create_preview   POST /v1/invoices/:id/void
// plus a /__control API the tests use to drive subscription state and read
// back what the backend asked for.
//
// Seat changes follow Stripe's documented behaviour
// (docs.stripe.com/billing/subscriptions/prorations and /pending-updates):
//   - proration = unit price x quantity x (period_end - proration_date) / period,
//     as a credit line for the old quantity and a debit line for the new one,
//     at the subscription's discounted price;
//   - always_invoice invoices the proration now together with any pending
//     items (e.g. an earlier credit), applies the customer's credit balance,
//     and charges the card for what is left; a negative total becomes credit;
//   - create_prorations leaves the lines pending for the next invoice;
//   - a renewal (period change through the control API) consumes pending items
//     and the credit balance (simplification: the renewal invoice absorbs them).
//   - payment_behavior=pending_if_incomplete + a declined card leaves the
//     quantity unchanged and returns a pending_update.
// A customer's card can be made to decline through /__control/customers/:id.
import http from 'node:http';

// Amounts mirror the live, tagged QualCanvas prices (read-only check,
// 27 Sep 2026): Student $5/$48, Pro $15/$144, Team $39/$384 per seat.
export const PRICES = {
  price_qc_student_m: { plan: 'student', amount: 500, interval: 'month', app: 'qualcanvas' },
  price_qc_pro_m: { plan: 'pro', amount: 1500, interval: 'month', app: 'qualcanvas' },
  price_qc_pro_y: { plan: 'pro', amount: 14400, interval: 'year', app: 'qualcanvas' },
  price_qc_team_m: { plan: 'team', amount: 3900, interval: 'month', app: 'qualcanvas' },
  price_qc_team_y: { plan: 'team', amount: 38400, interval: 'year', app: 'qualcanvas' },
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
  const invoices = new Map();
  const calls = [];
  const nowSecs = () => Math.floor(Date.now() / 1000);

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

  function unitAmount(s, price = s.price) {
    const base = PRICES[price]?.amount ?? 0;
    return base * (1 - (Number(s.discount_percent) || 0) / 100);
  }

  function itemLine(s, amount, quantity, proration, description) {
    return {
      object: 'line_item',
      amount: Math.round(amount),
      currency: 'usd',
      quantity,
      description,
      parent: {
        type: 'subscription_item_details',
        subscription_item_details: { proration, subscription_item: s.itemId },
      },
    };
  }

  // A price change (e.g. Pro -> Team) prorates the same way: credit the
  // unused time at the old price and quantity, charge the rest of the period
  // at the new price and quantity.
  function prorationLines(s, oldQ, newQ, prorationDate, newPrice = s.price) {
    const period = s.current_period_end - s.current_period_start;
    const frac = Math.min(1, Math.max(0, (s.current_period_end - prorationDate) / period));
    return [
      itemLine(s, -unitAmount(s) * oldQ * frac, oldQ, true, `Unused time on ${oldQ} x ${s.price}`),
      itemLine(s, unitAmount(s, newPrice) * newQ * frac, newQ, true, `Remaining time on ${newQ} x ${newPrice}`),
    ];
  }

  function recordInvoice(s, lines, status, amountDue) {
    const total = lines.reduce((t, l) => t + l.amount, 0);
    const inv = {
      id: id('in'),
      object: 'invoice',
      customer: s.customer,
      subscription: s.id,
      lines: { object: 'list', data: lines },
      amount_due: amountDue ?? Math.max(0, total),
      total,
      status,
      created: nowSecs(),
      hosted_invoice_url: `http://127.0.0.1:${server.address()?.port ?? 0}/invoice/${seq}`,
    };
    invoices.set(inv.id, inv);
    return inv;
  }

  function subObject(s, expandInvoice = false) {
    return {
      id: s.id,
      object: 'subscription',
      customer: s.customer,
      status: s.status,
      cancel_at_period_end: s.cancel_at_period_end,
      metadata: s.metadata ?? {},
      pending_update: s.pending_update ?? null,
      discounts: s.discount_percent ? [`di_${s.id}`] : [],
      latest_invoice: s.latest_invoice ? (expandInvoice ? invoices.get(s.latest_invoice) : s.latest_invoice) : null,
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
  function createSubscription({
    customer,
    price,
    status = 'active',
    now = Math.floor(Date.now() / 1000),
    metadata,
    quantity = 1,
    discount_percent = 0,
  }) {
    const interval = PRICES[price]?.interval === 'year' ? 365 : 30;
    const s = {
      id: id('sub'),
      itemId: id('si'),
      customer,
      price,
      status,
      quantity: Number(quantity) || 1,
      discount_percent: Number(discount_percent) || 0,
      pendingItems: [],
      pending_update: null,
      latest_invoice: null,
      cancel_at_period_end: false,
      current_period_start: Number(now),
      current_period_end: Number(now) + interval * DAY,
      metadata,
    };
    subscriptions.set(s.id, s);
    return subObject(s);
  }

  function updateSubscription(subId, patch) {
    const s = subscriptions.get(subId);
    if (!s) return null;
    Object.assign(s, patch);
    // A renewal starts a new period: pending proration items and the credit
    // balance are consumed by the renewal invoice.
    if (patch.current_period_start !== undefined) {
      s.pendingItems = [];
      const c = customers.get(s.customer);
      if (c) c.balance = 0;
    }
    return subObject(s);
  }

  function changeQuantity(s, form) {
    const oldQ = s.quantity;
    const newQ = Number(form['items[0][quantity]']);
    const newPrice = form['items[0][price]'] ?? s.price;
    const prorationDate = Number(form.proration_date ?? nowSecs());
    const lines = prorationLines(s, oldQ, newQ, prorationDate, newPrice);
    const behavior = form.proration_behavior ?? 'create_prorations';
    if (behavior === 'always_invoice') {
      const cust = customers.get(s.customer);
      const all = [...s.pendingItems, ...lines];
      const total = all.reduce((t, l) => t + l.amount, 0);
      const withBalance = total + (cust?.balance ?? 0);
      const due = Math.max(0, withBalance);
      const declined = due > 0 && cust?.card === 'declined';
      const inv = recordInvoice(s, all, declined ? 'open' : 'paid', due);
      s.latest_invoice = inv.id;
      if (!declined) {
        s.pendingItems = [];
        if (cust) cust.balance = Math.min(0, withBalance);
      }
      if (declined && form.payment_behavior === 'pending_if_incomplete') {
        s.pending_update = {
          expires_at: nowSecs() + 23 * 3600,
          subscription_items: [{ id: s.itemId, quantity: newQ, price: newPrice }],
        };
        return;
      }
      if (declined) s.status = 'past_due';
    } else if (behavior === 'create_prorations') {
      s.pendingItems.push(...lines);
    }
    s.quantity = newQ;
    s.price = newPrice;
    s.pending_update = null;
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
      if (p.startsWith('/__control/subscriptions/') && req.method === 'GET') {
        const s = subscriptions.get(p.split('/').pop());
        return s ? send(res, 200, subObject(s, true)) : notFound(res, 'subscription');
      }
      if (p === '/__control/invoices') {
        const sub = url.searchParams.get('subscription');
        return send(
          res,
          200,
          [...invoices.values()].filter((i) => !sub || i.subscription === sub),
        );
      }
      if (p.startsWith('/__control/pending/')) {
        const s = subscriptions.get(p.split('/').pop());
        return s ? send(res, 200, s.pendingItems) : notFound(res, 'subscription');
      }
      if (p.startsWith('/__control/customers/') && req.method === 'POST') {
        const c = customers.get(p.split('/').pop());
        if (!c) return notFound(res, 'customer');
        if (form.card) c.card = form.card;
        return send(res, 200, c);
      }
      if (p.startsWith('/__control/sessions/')) {
        const s = sessions.get(p.split('/').pop());
        return s ? send(res, 200, s) : notFound(res, 'session');
      }

      // ---- Stripe API ----
      let m;
      if (p === '/v1/prices/search') {
        // Only the metadata['app'] / metadata['plan'] terms QualCanvas uses.
        const query = url.searchParams.get('query') ?? '';
        const want = (key) => query.match(new RegExp(`metadata\\['${key}'\\]:'([^']+)'`))?.[1];
        const data = Object.keys(PRICES)
          .map(priceObject)
          .filter(
            (pr) =>
              (!want('app') || pr.metadata.app === want('app')) && (!want('plan') || pr.metadata.plan === want('plan')),
          );
        return send(res, 200, { object: 'search_result', data, has_more: false, url: '/v1/prices/search' });
      }
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
        const c = { id: id('cus'), object: 'customer', email: form.email, name: form.name, card: 'ok', balance: 0 };
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
          quantity: Number(form['line_items[0][quantity]'] ?? 1),
          adjustable_quantity: form['line_items[0][adjustable_quantity][enabled]'] === 'true',
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
          data: page.map((s) => subObject(s)),
          has_more: startIdx + limit < all.length,
          url: '/v1/subscriptions',
        });
      }
      if ((m = p.match(/^\/v1\/subscriptions\/([^/]+)$/))) {
        const s = subscriptions.get(m[1]);
        if (!s) return notFound(res, 'subscription');
        if (req.method === 'DELETE') s.status = 'canceled';
        const expandInvoice = [...url.searchParams.entries(), ...Object.entries(form)].some(
          ([k, v]) => k.startsWith('expand') && v === 'latest_invoice',
        );
        if (req.method === 'POST' && form['items[0][quantity]'] !== undefined) {
          if (form['items[0][id]'] && form['items[0][id]'] !== s.itemId) return notFound(res, 'subscription_item');
          changeQuantity(s, form);
        }
        return send(res, 200, subObject(s, expandInvoice));
      }
      if (p === '/v1/invoices/create_preview' && req.method === 'POST') {
        const s = subscriptions.get(form.subscription);
        if (!s) return notFound(res, 'subscription');
        const newQ = Number(form['subscription_details[items][0][quantity]'] ?? s.quantity);
        const newPrice = form['subscription_details[items][0][price]'] ?? s.price;
        const prorationDate = Number(form['subscription_details[proration_date]'] ?? nowSecs());
        const prorations =
          newQ === s.quantity && newPrice === s.price
            ? []
            : prorationLines(s, s.quantity, newQ, prorationDate, newPrice);
        const immediate = form['subscription_details[proration_behavior]'] === 'always_invoice';
        // always_invoice previews the invoice created right now; otherwise the
        // next scheduled invoice (pending items + the next period).
        const next = immediate ? [] : [itemLine(s, unitAmount(s, newPrice) * newQ, newQ, false, `${newQ} x seat`)];
        const data = [...s.pendingItems, ...prorations, ...next];
        const total = data.reduce((t, l) => t + l.amount, 0);
        const balance = customers.get(s.customer)?.balance ?? 0;
        return send(res, 200, {
          object: 'invoice',
          currency: 'usd',
          lines: { object: 'list', data },
          amount_due: Math.max(0, total + balance),
          starting_balance: balance,
          total,
          subscription_details: { proration_date: prorationDate },
        });
      }
      if ((m = p.match(/^\/v1\/invoices\/([^/]+)\/void$/)) && req.method === 'POST') {
        const inv = invoices.get(m[1]);
        if (!inv) return notFound(res, 'invoice');
        inv.status = 'void';
        const s = subscriptions.get(inv.subscription);
        if (s) s.pending_update = null;
        return send(res, 200, inv);
      }
      if ((m = p.match(/^\/v1\/subscription_items\/([^/]+)$/)) && req.method === 'POST') {
        const s = [...subscriptions.values()].find((x) => x.itemId === m[1]);
        if (!s) return notFound(res, 'subscription_item');
        if (form.quantity) s.quantity = Number(form.quantity);
        return send(res, 200, subObject(s).items.data[0]);
      }
      return send(res, 404, {
        error: { type: 'invalid_request_error', message: `stub: unhandled ${req.method} ${p}` },
      });
    });
  });

  return {
    server,
    calls,
    createSubscription,
    updateSubscription,
    getSession: (sid) => sessions.get(sid),
    getSubscription: (sid) => (subscriptions.has(sid) ? subObject(subscriptions.get(sid)) : null),
    invoices: (subId) => [...invoices.values()].filter((i) => !subId || i.subscription === subId),
    pendingItems: (subId) => subscriptions.get(subId)?.pendingItems ?? [],
    setCard: (customerId, card) => {
      const c = customers.get(customerId);
      if (c) c.card = card;
    },
    listen: () => new Promise((resolve) => server.listen(port, '127.0.0.1', () => resolve(server.address().port))),
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

// Allow running standalone: `node stripe-stub.mjs 4914`
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const stub = createStripeStub({ port: Number(process.argv[2] ?? 4914) });
  stub.listen().then((p) => console.log(`[stripe-stub] listening on 127.0.0.1:${p}`));
}
