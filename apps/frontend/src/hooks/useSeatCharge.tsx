import { useCallback, useRef, useState, type ReactNode } from 'react';
import SeatChargeDialog from '../components/billing/SeatChargeDialog';
import { seatQuoteFrom, type SeatConfirmation, type SeatPreview } from '../services/seatsApi';

interface Pending {
  preview: SeatPreview;
  reason: string;
  confirmLabel: string;
}

/**
 * Run an action that might need a paid seat.
 *
 *   const { withSeat, seatDialog } = useSeatCharge();
 *   await withSeat((c) => seatsApi.inviteCollaborator(id, data, c), { reason, confirmLabel });
 *
 * The first call goes out without confirmation. If the server answers
 * 402 SEAT_REQUIRED, the quote is shown; on confirm the SAME action is
 * retried with the confirmation, and its result resolves the original
 * promise. Cancel resolves to `null`. Any other error rejects as usual.
 */
export function useSeatCharge() {
  const [pending, setPending] = useState<Pending | null>(null);
  const [busy, setBusy] = useState(false);
  const resolver = useRef<{
    retry: (c: SeatConfirmation) => Promise<unknown>;
    resolve: (v: unknown) => void;
    reject: (e: unknown) => void;
  } | null>(null);

  const withSeat = useCallback(
    async <T,>(
      action: (confirmation?: SeatConfirmation) => Promise<T>,
      opts: { reason: string; confirmLabel: string },
    ): Promise<T | null> => {
      try {
        return await action();
      } catch (err) {
        const preview = seatQuoteFrom(err);
        if (!preview) throw err;
        return new Promise<T | null>((resolve, reject) => {
          resolver.current = {
            retry: action as (c: SeatConfirmation) => Promise<unknown>,
            resolve: resolve as (v: unknown) => void,
            reject,
          };
          setPending({ preview, ...opts });
        });
      }
    },
    [],
  );

  const onCancel = useCallback(() => {
    resolver.current?.resolve(null);
    resolver.current = null;
    setPending(null);
  }, []);

  const onConfirm = useCallback(async () => {
    if (!pending || !resolver.current) return;
    const r = resolver.current;
    setBusy(true);
    try {
      const result = await r.retry({ confirmSeatCharge: true, prorationDate: pending.preview.prorationDate });
      r.resolve(result);
    } catch (err) {
      r.reject(err);
    } finally {
      resolver.current = null;
      setBusy(false);
      setPending(null);
    }
  }, [pending]);

  const seatDialog: ReactNode = pending ? (
    <SeatChargeDialog
      preview={pending.preview}
      reason={pending.reason}
      confirmLabel={pending.confirmLabel}
      busy={busy}
      onConfirm={onConfirm}
      onCancel={onCancel}
    />
  ) : null;

  return { withSeat, seatDialog };
}
