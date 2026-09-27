import { Router } from 'express';
import type { Request, Response, NextFunction } from 'express';
import { prisma } from '../lib/prisma.js';
import { getStripe } from '../lib/stripe.js';
import { AppError } from '../middleware/errorHandler.js';
import { revokeCanvasAccess } from '../lib/socket.js';
import {
  getSeatStatus,
  previewSeatChange,
  releaseUnusedSeats,
  seatConfirmation,
  setSeatQuantity,
  withSeatLock,
  type SeatStatus,
} from '../utils/seats.js';

/**
 * Seat management for the account owner (docs/qa/SEAT-BILLING.md).
 * Mounted behind `auth`. Everything here acts on the CALLER's own plan.
 *
 *   GET  /billing/seats                      status + who holds a seat
 *   POST /billing/seats/preview {quantity}   price preview (no change)
 *   POST /billing/seats {quantity, confirmSeatCharge, prorationDate}
 *        add seats for coders who don't have one, or drop unheld seats
 *   POST /billing/seats/holders/:userId/release
 *        make that person a viewer on all your canvases and remove them from
 *        your teams, then credit back the freed seat
 */
export const seatRoutes = Router();

function requireEmailUser(req: Request): string {
  if (!req.userId) throw new AppError('Link an email account to manage seats.', 403);
  return req.userId;
}

async function seatPrice(ownerId: string) {
  const sub = await prisma.subscription.findUnique({ where: { userId: ownerId } });
  if (!sub?.stripePriceId) return null;
  try {
    const price = await getStripe().prices.retrieve(sub.stripePriceId);
    return {
      unitAmount: price.unit_amount ?? null,
      currency: price.currency,
      interval: price.recurring?.interval ?? null,
    };
  } catch {
    return null; // The status is still useful without the price.
  }
}

function serialize(status: SeatStatus) {
  return {
    mode: status.mode,
    plan: status.plan,
    subscriptionStatus: status.subscriptionStatus,
    seatsPurchased: status.seatsPurchased,
    seatsUsed: status.seatsUsed,
    unseatedCount: status.unseatedCount,
    graceEndsAt: status.graceEndsAt ? status.graceEndsAt.toISOString() : null,
    enforcing: status.enforcing,
    holders: status.holders.map((h) => ({
      userId: h.userId,
      name: h.name,
      email: h.email,
      since: h.since.toISOString(),
      seated: h.seated,
      canvases: h.canvases,
      teams: h.teams,
    })),
  };
}

seatRoutes.get('/billing/seats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    // A legacy access-code session has no seats to manage. Answer "not billed
    // per seat" rather than 403: the canvas page asks on every load, and an
    // error status there is a console error for every legacy researcher.
    if (!req.userId) {
      return res.json({
        success: true,
        data: {
          mode: 'none',
          plan: req.userPlan ?? 'free',
          subscriptionStatus: null,
          seatsPurchased: null,
          seatsUsed: 1,
          unseatedCount: 0,
          graceEndsAt: null,
          enforcing: false,
          holders: [],
          price: null,
        },
      });
    }
    const ownerId = req.userId;
    // Credit back seats nobody holds any more (e.g. a coder's canvas was
    // purged from the trash). Decrease-only, customer-favourable, best effort.
    await releaseUnusedSeats(ownerId);
    const status = await getSeatStatus(ownerId);
    res.json({
      success: true,
      data: { ...serialize(status), price: status.mode === 'billed' ? await seatPrice(ownerId) : null },
    });
  } catch (err) {
    next(err);
  }
});

function parseQuantity(body: unknown): number {
  const q = (body as { quantity?: unknown })?.quantity;
  if (typeof q !== 'number' || !Number.isInteger(q) || q < 1 || q > 1000) {
    throw new AppError('quantity must be a whole number of seats between 1 and 1000', 400);
  }
  return q;
}

seatRoutes.post('/billing/seats/preview', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = requireEmailUser(req);
    const quantity = parseQuantity(req.body);
    const status = await getSeatStatus(ownerId, { persistGrace: false });
    if (status.mode !== 'billed') throw new AppError('Your plan is not billed per seat.', 409);
    res.json({ success: true, data: await previewSeatChange(ownerId, quantity) });
  } catch (err) {
    next(err);
  }
});

seatRoutes.post('/billing/seats', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = requireEmailUser(req);
    const quantity = parseQuantity(req.body);
    const result = await withSeatLock(ownerId, async () => {
      const status = await getSeatStatus(ownerId, { persistGrace: false });
      if (status.mode !== 'billed') throw new AppError('Your plan is not billed per seat.', 409);
      if (quantity < status.seatsUsed) {
        throw new AppError(
          `${status.seatsUsed} people hold seats. To go below that, make coders viewers first (Account → Seats).`,
          409,
          { code: 'SEATS_IN_USE', seatsUsed: status.seatsUsed },
        );
      }
      // More seats than people is never useful here: seats are added when a
      // coder is invited. Refusing it avoids paying for empty seats.
      if (quantity > status.seatsUsed && quantity > (status.seatsPurchased ?? 1)) {
        throw new AppError(
          `You need ${status.seatsUsed} seat${status.seatsUsed === 1 ? '' : 's'}. Seats are added automatically when you invite a coder.`,
          409,
          { code: 'SEATS_NOT_NEEDED', seatsUsed: status.seatsUsed },
        );
      }
      const increasing = quantity > (status.seatsPurchased ?? 1);
      const confirmation = seatConfirmation(req.body);
      if (increasing && !confirmation.confirm) {
        throw new AppError('Confirm the charge to add seats.', 402, {
          code: 'SEAT_REQUIRED',
          preview: await previewSeatChange(ownerId, quantity),
        });
      }
      return setSeatQuantity(ownerId, quantity, { prorationDate: confirmation.prorationDate });
    });
    const status = await getSeatStatus(ownerId);
    res.json({ success: true, data: { quantity: result, ...serialize(status) } });
  } catch (err) {
    next(err);
  }
});

seatRoutes.post('/billing/seats/holders/:userId/release', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const ownerId = requireEmailUser(req);
    const targetId = req.params.userId;
    if (typeof targetId !== 'string' || !targetId || targetId === ownerId) {
      throw new AppError('Choose a coder other than yourself.', 400);
    }
    const owned = { OR: [{ userId: ownerId }, { dashboardAccess: { userId: ownerId } }] };
    const editorRows = await prisma.canvasCollaborator.findMany({
      where: { userId: targetId, role: 'editor', canvas: owned },
      select: { canvasId: true },
    });
    const teamRows = await prisma.teamMember.findMany({
      where: { userId: targetId, team: { ownerId } },
      select: { id: true },
    });
    if (editorRows.length === 0 && teamRows.length === 0) {
      throw new AppError('That person does not hold one of your seats.', 404);
    }
    await prisma.$transaction([
      prisma.canvasCollaborator.updateMany({
        where: { userId: targetId, role: 'editor', canvas: owned },
        data: { role: 'viewer' },
      }),
      prisma.teamMember.deleteMany({ where: { id: { in: teamRows.map((t) => t.id) } } }),
    ]);
    // Live sockets rejoin with their new (viewer) role.
    for (const row of editorRows) await revokeCanvasAccess(row.canvasId, targetId);
    await releaseUnusedSeats(ownerId);
    const status = await getSeatStatus(ownerId);
    res.json({ success: true, data: serialize(status) });
  } catch (err) {
    next(err);
  }
});
