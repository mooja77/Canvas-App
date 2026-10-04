import type Stripe from 'stripe';
import { isStripeSubscriptionId } from '../lib/stripeIds.js';
import { prisma } from '../lib/prisma.js';
import { getStripe } from '../lib/stripe.js';
import { AppError } from '../middleware/errorHandler.js';
import { effectivePlanOf } from './ownerPlan.js';
import { ENTITLED_SUBSCRIPTION_STATUSES } from '../lib/subscriptionStatus.js';
import { PUBLISHED_PRICES_USD } from '@qualcanvas/shared';

/**
 * Seat billing — see docs/qa/SEAT-BILLING.md for the full design.
 *
 * A seat is one person working with the owner's paid plan:
 *   - the owner (always seat 1);
 *   - every distinct EDITOR ("coder") collaborator on any canvas the owner
 *     owns, including canvases in the trash (they come back on restore);
 *   - every non-owner member of a team the owner owns.
 * Read-only viewers never take a seat.
 *
 * Team is billed per seat through the Stripe subscription item quantity.
 * Pro is a ONE-PERSON plan (John, 28 Sep 2026): the owner is its only coder,
 * viewers are free, and a second coder needs Team. Adding one answers
 * 402 TEAM_REQUIRED with the upgrade quote (Pro -> Team, one seat for the
 * owner and one per coder); nothing changes until the owner confirms.
 * Student is single-seat (no collaborators). Trials, the closed grandfathered
 * cohort and complimentary (non-Stripe) subscriptions have nothing to bill,
 * so Team seats are not enforced for them.
 *
 * The quantity column in our DB is a MIRROR of Stripe: it is only written
 * after Stripe has accepted a change, or from a webhook / reconciliation.
 */

/** Plans billed per seat. */
export const SEAT_PLANS = new Set(['team']);
/** One-person plans: the owner is the only coder (PLAN_LIMITS.maxCoders === 0, viewers allowed). */
export const SOLO_PLANS = new Set(['pro']);
// Same set that keeps the paid plan (lib/subscriptionStatus.ts): while the
// plan is kept, so are the seats.
export const BILLABLE_SUBSCRIPTION_STATUSES = ENTITLED_SUBSCRIPTION_STATUSES;
export const SEAT_GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * billed        Team on a Stripe subscription: seats = the Stripe quantity.
 * solo          Pro: one seat, the owner's. Existing coders get the grace period.
 * trial         Free-plan trial (Pro features): nothing billed, no new coders.
 * grandfathered Team without a subscription (closed legacy cohort).
 * comp          Team on a complimentary subscription row that has no Stripe
 *               subscription behind it (written by hand, id not "sub_...").
 * none          Free, Student.
 */
export type SeatMode = 'billed' | 'solo' | 'trial' | 'grandfathered' | 'comp' | 'none';

/** Modes in which coders beyond the seats become read-only once grace ends. */
const ENFORCED_MODES = new Set<SeatMode>(['billed', 'solo']);

/**
 * Real Stripe subscription ids start with "sub_"; complimentary rows ("comp_...")
 * were never in Stripe. Treating those as billed would start a grace period and
 * then lock a comped team's coders out, and every seat change would fail
 * against Stripe. Lives in lib/stripeIds.ts so non-seat code can share it.
 */
export { isStripeSubscriptionId };

export interface SeatHolder {
  userId: string;
  name: string;
  email: string;
  /** When they first took a seat (earliest editor invite or team join). Seats go oldest-first. */
  since: Date;
  canvases: { id: string; name: string; inTrash: boolean }[];
  teams: { id: string; name: string }[];
  seated: boolean;
}

export interface SeatStatus {
  ownerId: string;
  mode: SeatMode;
  plan: string;
  /** Plan in force, trial overlay included (a Free user in their trial is 'pro'). */
  effectivePlan: string;
  subscriptionStatus: string | null;
  /**
   * Seats that let someone edit: the Stripe quantity on Team, always 1 on Pro
   * (the owner's). Null when seats are not limited.
   */
  seatsPurchased: number | null;
  /** The quantity on the subscription row (a mirror of Stripe), if any. */
  subscriptionQuantity: number | null;
  /**
   * Pro or trial only: how the owner gets to Team. 'in_place' swaps a real
   * Stripe Pro subscription to Team; 'checkout' means Team checkout.
   */
  teamUpgrade: 'in_place' | 'checkout' | null;
  /** Owner + holders. */
  seatsUsed: number;
  holders: SeatHolder[];
  unseatedCount: number;
  graceEndsAt: Date | null;
  /** True once grace has passed: unseated coders are read-only. */
  enforcing: boolean;
}

// ─── Pure helpers (unit-tested) ──────────────────────────────────────────────

export function seatModeFor(input: {
  plan: string;
  effectivePlan: string;
  subscriptionStatus: string | null | undefined;
  stripeSubscriptionId?: string | null;
}): SeatMode {
  if (SOLO_PLANS.has(input.plan)) return 'solo';
  const entitled = !!input.subscriptionStatus && BILLABLE_SUBSCRIPTION_STATUSES.has(input.subscriptionStatus);
  if (SEAT_PLANS.has(input.plan) && entitled) {
    return isStripeSubscriptionId(input.stripeSubscriptionId) ? 'billed' : 'comp';
  }
  if (input.plan === 'free' && input.effectivePlan !== 'free') return 'trial';
  if (SEAT_PLANS.has(input.plan)) return 'grandfathered';
  return 'none';
}

/** Seats that let someone edit, or null when seats are not limited. */
export function seatCapacity(mode: SeatMode, subscriptionQuantity: number | null | undefined): number | null {
  if (mode === 'billed') return Math.max(1, subscriptionQuantity ?? 1);
  if (mode === 'solo') return 1;
  return null;
}

/** Oldest holders get the paid seats; the rest are unseated. The owner always holds seat 1. */
export function assignSeats<T extends { userId: string; since: Date }>(
  holders: T[],
  seatsPurchased: number,
): { seated: T[]; unseated: T[] } {
  const ordered = [...holders].sort(
    (a, b) => a.since.getTime() - b.since.getTime() || a.userId.localeCompare(b.userId),
  );
  const forOthers = Math.max(0, seatsPurchased - 1);
  return { seated: ordered.slice(0, forOthers), unseated: ordered.slice(forOthers) };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

function ownedCanvasWhere(ownerId: string) {
  return { OR: [{ userId: ownerId }, { dashboardAccess: { userId: ownerId } }] };
}

/** The user id that owns (and pays for) a canvas, or null for an unlinked legacy access code. */
export async function canvasOwnerUserId(canvasId: string): Promise<string | null> {
  const canvas = await prisma.codingCanvas.findUnique({
    where: { id: canvasId },
    select: { userId: true, dashboardAccess: { select: { userId: true } } },
  });
  return canvas?.userId ?? canvas?.dashboardAccess?.userId ?? null;
}

async function loadHolders(ownerId: string): Promise<Omit<SeatHolder, 'seated'>[]> {
  const [editors, members] = await Promise.all([
    prisma.canvasCollaborator.findMany({
      where: { role: 'editor', userId: { not: ownerId }, canvas: ownedCanvasWhere(ownerId) },
      select: {
        userId: true,
        createdAt: true,
        canvas: { select: { id: true, name: true, deletedAt: true } },
      },
    }),
    prisma.teamMember.findMany({
      where: { userId: { not: ownerId }, team: { ownerId } },
      select: { userId: true, joinedAt: true, team: { select: { id: true, name: true } } },
    }),
  ]);
  const byUser = new Map<string, Omit<SeatHolder, 'seated' | 'name' | 'email'>>();
  const entry = (userId: string, since: Date) => {
    let e = byUser.get(userId);
    if (!e) {
      e = { userId, since, canvases: [], teams: [] };
      byUser.set(userId, e);
    }
    if (since < e.since) e.since = since;
    return e;
  };
  for (const row of editors) {
    entry(row.userId, row.createdAt).canvases.push({
      id: row.canvas.id,
      name: row.canvas.name,
      inTrash: row.canvas.deletedAt !== null,
    });
  }
  for (const row of members) entry(row.userId, row.joinedAt).teams.push({ id: row.team.id, name: row.team.name });
  if (byUser.size === 0) return [];
  const users = await prisma.user.findMany({
    where: { id: { in: [...byUser.keys()] } },
    select: { id: true, name: true, email: true },
  });
  const names = new Map(users.map((u) => [u.id, u]));
  return [...byUser.values()].map((h) => ({
    ...h,
    name: names.get(h.userId)?.name ?? 'Unknown',
    email: names.get(h.userId)?.email ?? '',
  }));
}

/**
 * Seat status for an owner. With `persistGrace` (the default) the first
 * shortfall ever seen starts the owner's one-off grace period.
 */
export async function getSeatStatus(ownerId: string, opts: { persistGrace?: boolean } = {}): Promise<SeatStatus> {
  const owner = await prisma.user.findUnique({
    where: { id: ownerId },
    select: {
      plan: true,
      emailVerified: true,
      trialEndsAt: true,
      seatGraceEndsAt: true,
      subscription: { select: { status: true, quantity: true, stripeSubscriptionId: true } },
    },
  });
  if (!owner) throw new AppError('Account not found', 404);
  const effectivePlan = effectivePlanOf(owner);
  const mode = seatModeFor({
    plan: owner.plan,
    effectivePlan,
    subscriptionStatus: owner.subscription?.status,
    stripeSubscriptionId: owner.subscription?.stripeSubscriptionId,
  });
  const raw = await loadHolders(ownerId);
  const seatsPurchased = seatCapacity(mode, owner.subscription?.quantity);
  const enforced = ENFORCED_MODES.has(mode);
  const stripeBilledPro =
    mode === 'solo' &&
    !!owner.subscription &&
    BILLABLE_SUBSCRIPTION_STATUSES.has(owner.subscription.status) &&
    isStripeSubscriptionId(owner.subscription.stripeSubscriptionId);
  const { unseated } = assignSeats(raw, seatsPurchased ?? Number.MAX_SAFE_INTEGER);
  const unseatedIds = new Set(unseated.map((h) => h.userId));
  const holders = [...raw]
    .sort((a, b) => a.since.getTime() - b.since.getTime() || a.userId.localeCompare(b.userId))
    .map((h) => ({ ...h, seated: !unseatedIds.has(h.userId) }));

  let graceEndsAt = owner.seatGraceEndsAt;
  if (enforced && unseated.length > 0 && !graceEndsAt && opts.persistGrace !== false) {
    const candidate = new Date(Date.now() + SEAT_GRACE_DAYS * DAY_MS);
    // Conditional write: two concurrent first observations must not push the
    // date out twice.
    await prisma.user.updateMany({
      where: { id: ownerId, seatGraceEndsAt: null },
      data: { seatGraceEndsAt: candidate },
    });
    graceEndsAt =
      (await prisma.user.findUnique({ where: { id: ownerId }, select: { seatGraceEndsAt: true } }))?.seatGraceEndsAt ??
      candidate;
  }
  const enforcing = enforced && unseated.length > 0 && (!graceEndsAt || graceEndsAt.getTime() <= Date.now());
  return {
    ownerId,
    mode,
    plan: owner.plan,
    effectivePlan,
    subscriptionStatus: owner.subscription?.status ?? null,
    seatsPurchased,
    subscriptionQuantity: owner.subscription?.quantity ?? null,
    teamUpgrade: mode === 'solo' || mode === 'trial' ? (stripeBilledPro ? 'in_place' : 'checkout') : null,
    seatsUsed: 1 + raw.length,
    holders,
    unseatedCount: enforced ? unseated.length : 0,
    graceEndsAt: enforced && unseated.length > 0 ? graceEndsAt : null,
    enforcing,
  };
}

/**
 * May this editor collaborator write to this canvas? False only when the
 * owner is billed per seat, this person has no seat, and the grace period
 * is over. Viewers, owners and strangers are not this function's concern.
 */
export async function editorHasSeat(canvasId: string, userId: string): Promise<boolean> {
  const ownerId = await canvasOwnerUserId(canvasId);
  if (!ownerId || ownerId === userId) return true;
  const quick = await prisma.user.findUnique({
    where: { id: ownerId },
    select: { plan: true, subscription: { select: { status: true, stripeSubscriptionId: true } } },
  });
  // Fast path: only Pro owners, and Team owners billed on Stripe, can have
  // unseated coders.
  const couldBeUnseated =
    !!quick &&
    (SOLO_PLANS.has(quick.plan) ||
      (SEAT_PLANS.has(quick.plan) &&
        !!quick.subscription &&
        BILLABLE_SUBSCRIPTION_STATUSES.has(quick.subscription.status) &&
        isStripeSubscriptionId(quick.subscription.stripeSubscriptionId)));
  if (!couldBeUnseated) return true;
  const status = await getSeatStatus(ownerId);
  if (!status.enforcing) return true;
  return status.holders.find((h) => h.userId === userId)?.seated ?? true;
}

// ─── Serialisation ───────────────────────────────────────────────────────────

/**
 * Run `fn` holding a per-owner Postgres advisory lock, so two invites for the
 * same owner cannot both read quantity N and both set N+1.
 */
export async function withSeatLock<T>(ownerId: string, fn: () => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`qc-seats:${ownerId}`}))`;
      return fn();
    },
    { timeout: 45_000, maxWait: 15_000 },
  );
}

// ─── Stripe ──────────────────────────────────────────────────────────────────

export interface SeatPreview {
  currentQuantity: number;
  newQuantity: number;
  currency: string;
  /** List price of one seat per interval, in the smallest currency unit. */
  unitAmount: number | null;
  interval: string | null;
  /**
   * What the card is charged now: Stripe's own preview of the immediate
   * (always_invoice) invoice — the prorated seats, net of any unused-time
   * credits already waiting and of the customer's credit balance.
   */
  dueNow: number;
  /** List price x new quantity per interval (before any discount). */
  nextRenewal: number;
  hasDiscount: boolean;
  prorationDate: number;
  currentPeriodEnd: string | null;
  /** Set on a plan change quote (Pro -> Team): the plans before and after. */
  fromPlan?: string;
  toPlan?: string;
  /** Pro -> Team: the Pro price being replaced, per interval, for the dialog. */
  currentUnitAmount?: number | null;
}

async function billedSubscription(ownerId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId: ownerId } });
  if (!sub || !BILLABLE_SUBSCRIPTION_STATUSES.has(sub.status)) {
    throw new AppError('An active paid subscription is required to change seats.', 409);
  }
  // Complimentary rows ("comp_...") are not in Stripe: never send their id there.
  if (!isStripeSubscriptionId(sub.stripeSubscriptionId)) {
    throw new AppError('This subscription is not billed through Stripe. Contact support to change seats.', 409);
  }
  return sub;
}

async function seatItem(stripe: Stripe, stripeSubscriptionId: string, stripePriceId: string) {
  const live = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const item = live.items.data.find((i) => i.price.id === stripePriceId) ?? live.items.data[0];
  if (!item) throw new AppError('The subscription has no billable item.', 409);
  return { live, item };
}

export async function previewSeatChange(
  ownerId: string,
  newQuantity: number,
  prorationDate = Math.floor(Date.now() / 1000),
): Promise<SeatPreview> {
  const sub = await billedSubscription(ownerId);
  const stripe = getStripe();
  const { live, item } = await seatItem(stripe, sub.stripeSubscriptionId, sub.stripePriceId);
  // Preview exactly the invoice setSeatQuantity will create: always_invoice
  // bills the proration now and sweeps up pending items (e.g. the credit from
  // a coder removed earlier this period), and amount_due applies the
  // customer's credit balance. That is the real charge, so quote it.
  const preview = await stripe.invoices.createPreview({
    customer: typeof live.customer === 'string' ? live.customer : live.customer.id,
    subscription: live.id,
    subscription_details: {
      items: [{ id: item.id, quantity: newQuantity }],
      proration_date: prorationDate,
      proration_behavior: 'always_invoice',
    },
  });
  const dueNow = Math.max(0, preview.amount_due ?? 0);
  const nextRenewal = (item.price.unit_amount ?? 0) * newQuantity;
  return {
    currentQuantity: item.quantity ?? 1,
    newQuantity,
    currency: item.price.currency ?? preview.currency ?? 'usd',
    unitAmount: item.price.unit_amount ?? null,
    interval: item.price.recurring?.interval ?? null,
    dueNow,
    nextRenewal,
    hasDiscount: Array.isArray(live.discounts) && live.discounts.length > 0,
    prorationDate,
    currentPeriodEnd: item.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
  };
}

export class SeatPaymentError extends AppError {
  constructor(public hostedInvoiceUrl: string | null) {
    super(
      'Your card was declined, so no seat was added and you have not been charged. Update your card under Account → Manage billing, then try again.',
      402,
      { code: 'SEAT_PAYMENT_FAILED', hostedInvoiceUrl },
    );
  }
}

/**
 * Set the seat quantity on Stripe, then mirror it locally.
 *  - Increase: the prorated charge is invoiced and paid now
 *    (`always_invoice`), and `pending_if_incomplete` means Stripe applies the
 *    new quantity ONLY if that payment succeeds. On a decline we void the
 *    invoice so nothing lingers, and throw SeatPaymentError.
 *  - Decrease: takes effect now and credits the unused time to the next
 *    invoice (`create_prorations`); never a card charge.
 */
export async function setSeatQuantity(
  ownerId: string,
  quantity: number,
  opts: { prorationDate?: number } = {},
): Promise<number> {
  if (!Number.isInteger(quantity) || quantity < 1) throw new AppError('Seat quantity must be at least 1', 400);
  const sub = await billedSubscription(ownerId);
  const stripe = getStripe();
  const { live, item } = await seatItem(stripe, sub.stripeSubscriptionId, sub.stripePriceId);
  const current = item.quantity ?? 1;
  if (quantity === current) {
    if (sub.quantity !== current) {
      await prisma.subscription.update({ where: { id: sub.id }, data: { quantity: current } });
    }
    return current;
  }
  if (quantity > current) {
    if (sub.status === 'past_due' || live.status === 'past_due') {
      throw new AppError(
        'Your last payment failed, so seats cannot be added yet. Update your card under Account → Manage billing first.',
        402,
        { code: 'PAYMENT_PAST_DUE' },
      );
    }
    const updated = await stripe.subscriptions.update(live.id, {
      items: [{ id: item.id, quantity }],
      proration_behavior: 'always_invoice',
      payment_behavior: 'pending_if_incomplete',
      // The same instant the owner was quoted, so the charge matches the preview.
      proration_date: opts.prorationDate ?? Math.floor(Date.now() / 1000),
      expand: ['latest_invoice'],
    });
    if (updated.pending_update) {
      const invoice =
        updated.latest_invoice && typeof updated.latest_invoice === 'object' ? updated.latest_invoice : null;
      if (invoice?.id) await stripe.invoices.voidInvoice(invoice.id).catch(() => undefined);
      throw new SeatPaymentError(invoice?.hosted_invoice_url ?? null);
    }
    const applied = updated.items.data.find((i) => i.id === item.id)?.quantity ?? quantity;
    await prisma.subscription.update({ where: { id: sub.id }, data: { quantity: applied } });
    return applied;
  }
  const updated = await stripe.subscriptions.update(live.id, {
    items: [{ id: item.id, quantity }],
    proration_behavior: 'create_prorations',
    proration_date: Math.floor(Date.now() / 1000),
  });
  const applied = updated.items.data.find((i) => i.id === item.id)?.quantity ?? quantity;
  await prisma.subscription.update({ where: { id: sub.id }, data: { quantity: applied } });
  return applied;
}

// ─── Pro -> Team ─────────────────────────────────────────────────────────────

/**
 * The live Team price for this interval and currency. QualCanvas prices are
 * tagged metadata.app='qualcanvas' + metadata.plan (the same tags checkout
 * trusts, see deriveQualcanvasPlan). If more than one matches, the one at the
 * published list price wins, so the quote and /pricing agree.
 */
export async function findTeamPrice(stripe: Stripe, interval: string, currency: string): Promise<Stripe.Price> {
  const found = await stripe.prices.search({
    query: "metadata['app']:'qualcanvas' AND metadata['plan']:'team' AND active:'true'",
    limit: 100,
  });
  const candidates = found.data.filter(
    (p) => p.recurring?.interval === interval && p.currency === currency && p.recurring?.usage_type !== 'metered',
  );
  const listed =
    currency === 'usd'
      ? (interval === 'year' ? PUBLISHED_PRICES_USD.team.annual : PUBLISHED_PRICES_USD.team.monthly) * 100
      : null;
  const price = candidates.find((p) => p.unit_amount === listed) ?? candidates[0];
  if (!price) {
    throw new AppError('The Team plan is not available for your billing interval. Contact support to upgrade.', 409, {
      code: 'TEAM_PRICE_UNAVAILABLE',
    });
  }
  return price;
}

/**
 * Stripe's own quote for moving a Pro subscription to Team with `quantity`
 * seats right now: the unused Pro time is credited and the Team seats for
 * the rest of the period are charged, on one invoice (`always_invoice`).
 */
export async function previewTeamUpgrade(
  ownerId: string,
  quantity: number,
  prorationDate = Math.floor(Date.now() / 1000),
): Promise<SeatPreview> {
  const sub = await billedSubscription(ownerId);
  if (!isStripeSubscriptionId(sub.stripeSubscriptionId)) {
    throw new AppError('This subscription is not billed through Stripe. Contact support to upgrade.', 409);
  }
  const stripe = getStripe();
  const { live, item } = await seatItem(stripe, sub.stripeSubscriptionId, sub.stripePriceId);
  const teamPrice = await findTeamPrice(stripe, item.price.recurring?.interval ?? 'month', item.price.currency);
  const preview = await stripe.invoices.createPreview({
    customer: typeof live.customer === 'string' ? live.customer : live.customer.id,
    subscription: live.id,
    subscription_details: {
      items: [{ id: item.id, price: teamPrice.id, quantity }],
      proration_date: prorationDate,
      proration_behavior: 'always_invoice',
    },
  });
  return {
    currentQuantity: item.quantity ?? 1,
    newQuantity: quantity,
    currency: teamPrice.currency,
    unitAmount: teamPrice.unit_amount ?? null,
    interval: teamPrice.recurring?.interval ?? null,
    dueNow: Math.max(0, preview.amount_due ?? 0),
    nextRenewal: (teamPrice.unit_amount ?? 0) * quantity,
    hasDiscount: Array.isArray(live.discounts) && live.discounts.length > 0,
    prorationDate,
    currentPeriodEnd: item.current_period_end ? new Date(item.current_period_end * 1000).toISOString() : null,
    fromPlan: 'pro',
    toPlan: 'team',
    currentUnitAmount: item.price.unit_amount ?? null,
  };
}

/**
 * Move a Pro subscription to Team with `quantity` seats. Same payment rules
 * as a seat increase: the prorated difference is invoiced and paid now, and
 * `pending_if_incomplete` means Stripe switches the plan ONLY if that payment
 * succeeds. On a decline the invoice is voided and nothing changes.
 */
export async function upgradeToTeam(
  ownerId: string,
  quantity: number,
  opts: { prorationDate?: number } = {},
): Promise<number> {
  if (!Number.isInteger(quantity) || quantity < 1) throw new AppError('Seat quantity must be at least 1', 400);
  const sub = await billedSubscription(ownerId);
  if (!isStripeSubscriptionId(sub.stripeSubscriptionId)) {
    throw new AppError('This subscription is not billed through Stripe. Contact support to upgrade.', 409);
  }
  const stripe = getStripe();
  const { live, item } = await seatItem(stripe, sub.stripeSubscriptionId, sub.stripePriceId);
  if (sub.status === 'past_due' || live.status === 'past_due') {
    throw new AppError(
      'Your last payment failed, so the plan cannot change yet. Update your card under Account → Manage billing first.',
      402,
      { code: 'PAYMENT_PAST_DUE' },
    );
  }
  const teamPrice = await findTeamPrice(stripe, item.price.recurring?.interval ?? 'month', item.price.currency);
  const updated = await stripe.subscriptions.update(live.id, {
    items: [{ id: item.id, price: teamPrice.id, quantity }],
    proration_behavior: 'always_invoice',
    payment_behavior: 'pending_if_incomplete',
    proration_date: opts.prorationDate ?? Math.floor(Date.now() / 1000),
    expand: ['latest_invoice'],
  });
  if (updated.pending_update) {
    const invoice =
      updated.latest_invoice && typeof updated.latest_invoice === 'object' ? updated.latest_invoice : null;
    if (invoice?.id) await stripe.invoices.voidInvoice(invoice.id).catch(() => undefined);
    throw new SeatPaymentError(invoice?.hosted_invoice_url ?? null);
  }
  const newItem = updated.items.data.find((i) => i.id === item.id) ?? updated.items.data[0];
  const applied = newItem?.quantity ?? quantity;
  // Mirror what Stripe applied. The customer.subscription.updated webhook
  // re-derives the plan from the price too; both land on 'team'.
  await prisma.$transaction([
    prisma.subscription.update({
      where: { id: sub.id },
      data: { quantity: applied, stripePriceId: newItem?.price?.id ?? teamPrice.id },
    }),
    prisma.user.update({ where: { id: ownerId }, data: { plan: 'team' } }),
  ]);
  return applied;
}

/**
 * 402 TEAM_REQUIRED: a Pro owner (or a Free user in their Pro trial) tried to
 * add a second coder. `preview` is Stripe's quote for switching to Team in
 * place; it is null when the owner has no Stripe subscription to switch and
 * must go through Team checkout instead. Viewers stay free either way.
 */
export class TeamRequiredError extends AppError {
  constructor(details: { upgrade: 'in_place' | 'checkout'; preview: SeatPreview | null; seatsNeeded: number }) {
    super('Pro is a one-person plan. To add another coder, upgrade to Team, or add them as a viewer for free.', 402, {
      code: 'TEAM_REQUIRED',
      ...details,
    });
  }
}

export class SeatRequiredError extends AppError {
  constructor(public preview: SeatPreview) {
    super('This adds a paid seat to your plan. Confirm the charge to continue.', 402, {
      code: 'SEAT_REQUIRED',
      preview,
    });
  }
}

/**
 * Make sure `userId` can hold an editing seat on `ownerId`'s plan. Call inside
 * withSeatLock BEFORE writing the collaborator/member row.
 *  - Not billed per seat, or already a holder, or a spare seat exists → no-op.
 *  - Otherwise, without `confirm` → SeatRequiredError carrying a price preview
 *    (the API answers 402 SEAT_REQUIRED and the client shows it).
 *  - With `confirm` → Stripe quantity = everyone who needs a seat (this also
 *    seats anyone left unseated by an earlier shortfall; the preview says so).
 */
export async function ensureSeatFor(
  ownerId: string,
  userId: string,
  opts: { confirm?: boolean; prorationDate?: number; confirmTeamUpgrade?: boolean } = {},
): Promise<{ charged: boolean; quantity: number | null }> {
  const status = await getSeatStatus(ownerId, { persistGrace: false });
  if (userId === ownerId || status.holders.some((h) => h.userId === userId)) {
    return { charged: false, quantity: status.seatsPurchased };
  }
  // Pro (and the Pro-level trial) is one person. A second coder means Team:
  // quote the switch, and make it only once the owner has confirmed it.
  if (status.teamUpgrade) {
    const seatsNeeded = status.seatsUsed + 1;
    if (status.teamUpgrade === 'checkout') {
      throw new TeamRequiredError({ upgrade: 'checkout', preview: null, seatsNeeded });
    }
    if (status.subscriptionStatus === 'past_due') {
      throw new AppError(
        'Your last payment failed, so the plan cannot change yet. Update your card under Account → Manage billing first.',
        402,
        { code: 'PAYMENT_PAST_DUE' },
      );
    }
    if (!opts.confirmTeamUpgrade) {
      throw new TeamRequiredError({
        upgrade: 'in_place',
        preview: await previewTeamUpgrade(ownerId, seatsNeeded),
        seatsNeeded,
      });
    }
    const quantity = await upgradeToTeam(ownerId, seatsNeeded, { prorationDate: opts.prorationDate });
    return { charged: true, quantity };
  }
  if (status.mode !== 'billed') return { charged: false, quantity: null };
  const needed = status.seatsUsed + 1;
  if (needed <= (status.seatsPurchased ?? 1)) return { charged: false, quantity: status.seatsPurchased };
  if (status.subscriptionStatus === 'past_due') {
    // Don't quote a charge the card on file just failed to pay.
    throw new AppError(
      'Your last payment failed, so seats cannot be added yet. Update your card under Account → Manage billing first.',
      402,
      { code: 'PAYMENT_PAST_DUE' },
    );
  }
  if (!opts.confirm) {
    throw new SeatRequiredError(await previewSeatChange(ownerId, needed));
  }
  const quantity = await setSeatQuantity(ownerId, needed, { prorationDate: opts.prorationDate });
  return { charged: true, quantity };
}

/**
 * After someone stops needing a seat, drop paid seats that nobody holds.
 * Best effort: removing access must never fail because Stripe is down — the
 * weekly reconciliation retries. Never increases.
 */
export async function releaseUnusedSeats(ownerId: string): Promise<number | null> {
  try {
    const status = await getSeatStatus(ownerId, { persistGrace: false });
    // Pro holds one seat whatever the quantity. A Pro subscription left with
    // quantity > 1 by the per-seat Pro of #213 is paying for seats that no
    // longer let anyone edit: drop it to 1 and credit the unused time.
    if (status.mode === 'solo') {
      if (status.teamUpgrade === 'in_place' && (status.subscriptionQuantity ?? 1) > 1) {
        return await setSeatQuantity(ownerId, 1);
      }
      return status.subscriptionQuantity;
    }
    if (status.mode !== 'billed' || status.seatsPurchased === null) return null;
    const target = Math.max(1, status.seatsUsed);
    if (target >= status.seatsPurchased) return status.seatsPurchased;
    return await setSeatQuantity(ownerId, target);
  } catch (err) {
    console.error('[Seats] releaseUnusedSeats failed; reconciliation will retry', {
      ownerId,
      error: err instanceof Error ? err.message : String(err),
    });
    return null;
  }
}

/** Body fields a client sends to confirm a seat charge it was shown. */
export function seatConfirmation(body: unknown): {
  confirm: boolean;
  confirmTeamUpgrade: boolean;
  prorationDate?: number;
} {
  const b = (body ?? {}) as Record<string, unknown>;
  const prorationDate =
    typeof b.prorationDate === 'number' && Number.isInteger(b.prorationDate) ? b.prorationDate : undefined;
  // A preview is only honoured for 10 minutes; after that the client must re-confirm.
  const fresh = prorationDate === undefined || Math.abs(Date.now() / 1000 - prorationDate) <= 600;
  return {
    confirm: b.confirmSeatCharge === true && fresh,
    // The Team switch changes the plan and the price, so it has its own
    // explicit flag: a seat confirmation never upgrades anyone by accident.
    confirmTeamUpgrade: b.confirmTeamUpgrade === true && fresh,
    prorationDate: fresh ? prorationDate : undefined,
  };
}
