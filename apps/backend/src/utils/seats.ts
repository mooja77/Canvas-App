import type Stripe from 'stripe';
import { prisma } from '../lib/prisma.js';
import { getStripe } from '../lib/stripe.js';
import { AppError } from '../middleware/errorHandler.js';
import { effectivePlanOf } from './ownerPlan.js';

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
 * Pro and Team are billed per seat through the Stripe subscription item
 * quantity. Student is single-seat (no collaborators). Trials and the closed
 * grandfathered legacy cohort have no subscription to bill, so seats are not
 * enforced for them (the plan's collaborator cap still is).
 *
 * The quantity column in our DB is a MIRROR of Stripe: it is only written
 * after Stripe has accepted a change, or from a webhook / reconciliation.
 */

export const SEAT_PLANS = new Set(['pro', 'team']);
export const BILLABLE_SUBSCRIPTION_STATUSES = new Set(['active', 'trialing', 'past_due']);
export const SEAT_GRACE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

export type SeatMode = 'billed' | 'trial' | 'grandfathered' | 'none';

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
  subscriptionStatus: string | null;
  /** Seats paid for on Stripe (billed mode only). */
  seatsPurchased: number | null;
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
}): SeatMode {
  if (
    SEAT_PLANS.has(input.plan) &&
    input.subscriptionStatus &&
    BILLABLE_SUBSCRIPTION_STATUSES.has(input.subscriptionStatus)
  ) {
    return 'billed';
  }
  if (input.plan === 'free' && SEAT_PLANS.has(input.effectivePlan)) return 'trial';
  if (SEAT_PLANS.has(input.plan)) return 'grandfathered';
  return 'none';
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
      subscription: { select: { status: true, quantity: true } },
    },
  });
  if (!owner) throw new AppError('Account not found', 404);
  const mode = seatModeFor({
    plan: owner.plan,
    effectivePlan: effectivePlanOf(owner),
    subscriptionStatus: owner.subscription?.status,
  });
  const raw = await loadHolders(ownerId);
  const seatsPurchased = mode === 'billed' ? Math.max(1, owner.subscription?.quantity ?? 1) : null;
  const { unseated } = assignSeats(raw, seatsPurchased ?? Number.MAX_SAFE_INTEGER);
  const unseatedIds = new Set(unseated.map((h) => h.userId));
  const holders = [...raw]
    .sort((a, b) => a.since.getTime() - b.since.getTime() || a.userId.localeCompare(b.userId))
    .map((h) => ({ ...h, seated: !unseatedIds.has(h.userId) }));

  let graceEndsAt = owner.seatGraceEndsAt;
  if (mode === 'billed' && unseated.length > 0 && !graceEndsAt && opts.persistGrace !== false) {
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
  const enforcing = mode === 'billed' && unseated.length > 0 && (!graceEndsAt || graceEndsAt.getTime() <= Date.now());
  return {
    ownerId,
    mode,
    plan: owner.plan,
    subscriptionStatus: owner.subscription?.status ?? null,
    seatsPurchased,
    seatsUsed: 1 + raw.length,
    holders,
    unseatedCount: mode === 'billed' ? unseated.length : 0,
    graceEndsAt: mode === 'billed' && unseated.length > 0 ? graceEndsAt : null,
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
    select: { plan: true, subscription: { select: { status: true } } },
  });
  // Fast path: only billed owners can have unseated coders.
  if (
    !quick ||
    !SEAT_PLANS.has(quick.plan) ||
    !quick.subscription ||
    !BILLABLE_SUBSCRIPTION_STATUSES.has(quick.subscription.status)
  ) {
    return true;
  }
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
  /** Prorated amount charged immediately for the rest of this billing period (after discounts). */
  dueNow: number;
  /** Recurring amount of the next renewal at the new quantity (after discounts). */
  nextRenewal: number;
  hasDiscount: boolean;
  prorationDate: number;
  currentPeriodEnd: string | null;
}

async function billedSubscription(ownerId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId: ownerId } });
  if (!sub || !BILLABLE_SUBSCRIPTION_STATUSES.has(sub.status)) {
    throw new AppError('An active paid subscription is required to change seats.', 409);
  }
  return sub;
}

async function seatItem(stripe: Stripe, stripeSubscriptionId: string, stripePriceId: string) {
  const live = await stripe.subscriptions.retrieve(stripeSubscriptionId);
  const item = live.items.data.find((i) => i.price.id === stripePriceId) ?? live.items.data[0];
  if (!item) throw new AppError('The subscription has no billable item.', 409);
  return { live, item };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function isProrationLine(line: any): boolean {
  return Boolean(line?.proration ?? line?.parent?.subscription_item_details?.proration);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function netAmount(line: any): number {
  const discounts = Array.isArray(line?.discount_amounts)
    ? line.discount_amounts.reduce((s: number, d: { amount?: number }) => s + (d.amount ?? 0), 0)
    : 0;
  return (line?.amount ?? 0) - discounts;
}

export async function previewSeatChange(
  ownerId: string,
  newQuantity: number,
  prorationDate = Math.floor(Date.now() / 1000),
): Promise<SeatPreview> {
  const sub = await billedSubscription(ownerId);
  const stripe = getStripe();
  const { live, item } = await seatItem(stripe, sub.stripeSubscriptionId, sub.stripePriceId);
  const preview = await stripe.invoices.createPreview({
    customer: typeof live.customer === 'string' ? live.customer : live.customer.id,
    subscription: live.id,
    subscription_details: {
      items: [{ id: item.id, quantity: newQuantity }],
      proration_date: prorationDate,
    },
  });
  const lines = preview.lines?.data ?? [];
  const dueNow = Math.max(
    0,
    lines.filter(isProrationLine).reduce((s, l) => s + netAmount(l), 0),
  );
  const nextRenewal = lines.filter((l) => !isProrationLine(l)).reduce((s, l) => s + netAmount(l), 0);
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
  opts: { confirm?: boolean; prorationDate?: number } = {},
): Promise<{ charged: boolean; quantity: number | null }> {
  const status = await getSeatStatus(ownerId, { persistGrace: false });
  if (status.mode !== 'billed') return { charged: false, quantity: null };
  if (userId === ownerId || status.holders.some((h) => h.userId === userId)) {
    return { charged: false, quantity: status.seatsPurchased };
  }
  const needed = status.seatsUsed + 1;
  if (needed <= (status.seatsPurchased ?? 1)) return { charged: false, quantity: status.seatsPurchased };
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
export function seatConfirmation(body: unknown): { confirm: boolean; prorationDate?: number } {
  const b = (body ?? {}) as Record<string, unknown>;
  const prorationDate =
    typeof b.prorationDate === 'number' && Number.isInteger(b.prorationDate) ? b.prorationDate : undefined;
  // A preview is only honoured for 10 minutes; after that the client must re-confirm.
  const fresh = prorationDate === undefined || Math.abs(Date.now() / 1000 - prorationDate) <= 600;
  return { confirm: b.confirmSeatCharge === true && fresh, prorationDate: fresh ? prorationDate : undefined };
}
