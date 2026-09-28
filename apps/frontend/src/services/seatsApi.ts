import { canvasClient } from './api';

// Seat billing (backend: routes/seatRoutes.ts, utils/seats.ts). Kept out of
// api.ts so the seat work does not collide with other branches editing it.

/** See backend utils/seats.ts SeatMode. 'solo' = Pro, a one-person plan. */
export type SeatMode = 'billed' | 'solo' | 'trial' | 'grandfathered' | 'comp' | 'none';

export interface SeatHolder {
  userId: string;
  name: string;
  email: string;
  since: string;
  seated: boolean;
  canvases: { id: string; name: string; inTrash: boolean }[];
  teams: { id: string; name: string }[];
}

export interface SeatStatus {
  mode: SeatMode;
  plan: string;
  effectivePlan: string;
  subscriptionStatus: string | null;
  /** Seats that let someone edit: Team's Stripe quantity, 1 on Pro. */
  seatsPurchased: number | null;
  subscriptionQuantity: number | null;
  /** Pro/trial: switch to Team in place, or via Team checkout. */
  teamUpgrade: 'in_place' | 'checkout' | null;
  seatsUsed: number;
  unseatedCount: number;
  graceEndsAt: string | null;
  enforcing: boolean;
  holders: SeatHolder[];
  price: { unitAmount: number | null; currency: string; interval: string | null } | null;
}

export interface SeatPreview {
  currentQuantity: number;
  newQuantity: number;
  currency: string;
  unitAmount: number | null;
  interval: string | null;
  dueNow: number;
  nextRenewal: number;
  hasDiscount: boolean;
  prorationDate: number;
  currentPeriodEnd: string | null;
  /** Present on a Pro -> Team quote. */
  fromPlan?: string;
  toPlan?: string;
  currentUnitAmount?: number | null;
}

/** 402 TEAM_REQUIRED: a Pro owner tried to add a second coder. */
export interface TeamRequired {
  upgrade: 'in_place' | 'checkout';
  /** Stripe's quote for switching in place; null when Team checkout is needed. */
  preview: SeatPreview | null;
  seatsNeeded: number;
}

/**
 * What the client sends back once the owner has chosen: a seat charge, the
 * switch to Team (a separate flag, so one never implies the other), or to
 * add the person as a free viewer instead.
 */
export type SeatConfirmation =
  | { confirmSeatCharge: true; prorationDate: number }
  | { confirmTeamUpgrade: true; prorationDate: number }
  | { role: 'viewer' };

export const seatsApi = {
  get: () => canvasClient.get<{ success: boolean; data: SeatStatus }>('/billing/seats'),
  setQuantity: (quantity: number, confirmation?: SeatConfirmation) =>
    canvasClient.post('/billing/seats', { quantity, ...(confirmation ?? {}) }),
  /** Pro -> Team with a seat for you and each coder (402 TEAM_REQUIRED quote first). */
  upgradeToTeam: (confirmation?: SeatConfirmation) =>
    canvasClient.post<{ success: boolean; data: SeatStatus }>('/billing/seats/upgrade-to-team', confirmation ?? {}),
  release: (userId: string) =>
    canvasClient.post<{ success: boolean; data: SeatStatus }>(
      `/billing/seats/holders/${encodeURIComponent(userId)}/release`,
    ),
};

export function formatMoney(amountMinor: number, currency = 'usd'): string {
  return new Intl.NumberFormat(undefined, { style: 'currency', currency: currency.toUpperCase() }).format(
    amountMinor / 100,
  );
}

/** Pull a SEAT_REQUIRED quote out of an axios error, if that is what it is. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function seatQuoteFrom(err: any): SeatPreview | null {
  const data = err?.response?.data;
  return err?.response?.status === 402 && data?.code === 'SEAT_REQUIRED' && data.preview ? data.preview : null;
}

/** Pull a TEAM_REQUIRED answer out of an axios error, if that is what it is. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function teamRequiredFrom(err: any): TeamRequired | null {
  const data = err?.response?.data;
  if (err?.response?.status !== 402 || data?.code !== 'TEAM_REQUIRED') return null;
  if (data.upgrade !== 'in_place' && data.upgrade !== 'checkout') return null;
  return { upgrade: data.upgrade, preview: data.preview ?? null, seatsNeeded: Number(data.seatsNeeded) || 2 };
}
