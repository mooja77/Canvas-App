import { canvasClient } from './api';

// Seat billing (backend: routes/seatRoutes.ts, utils/seats.ts). Kept out of
// api.ts so the seat work does not collide with other branches editing it.

export type SeatMode = 'billed' | 'trial' | 'grandfathered' | 'none';

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
  subscriptionStatus: string | null;
  seatsPurchased: number | null;
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
}

/** What the client sends back once the owner has accepted a quote. */
export interface SeatConfirmation {
  confirmSeatCharge: true;
  prorationDate: number;
}

export const seatsApi = {
  get: () => canvasClient.get<{ success: boolean; data: SeatStatus }>('/billing/seats'),
  setQuantity: (quantity: number, confirmation?: SeatConfirmation) =>
    canvasClient.post('/billing/seats', { quantity, ...(confirmation ?? {}) }),
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
