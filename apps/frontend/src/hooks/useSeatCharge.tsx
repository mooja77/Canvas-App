import { useCallback, useRef, useState, type ReactNode } from 'react';
import SeatChargeDialog from '../components/billing/SeatChargeDialog';
import TeamUpgradeDialog from '../components/billing/TeamUpgradeDialog';
import {
  seatQuoteFrom,
  teamRequiredFrom,
  type SeatConfirmation,
  type SeatPreview,
  type TeamRequired,
} from '../services/seatsApi';

interface SeatOpts {
  reason: string;
  confirmLabel: string;
  /**
   * When a Pro owner adds a second coder, also offer "add as a viewer
   * instead" (retries the action with `{ role: 'viewer' }`). Off for team
   * membership, where everyone codes.
   */
  viewerFallback?: boolean;
}

type Pending = ({ kind: 'seat'; preview: SeatPreview } & SeatOpts) | ({ kind: 'team'; team: TeamRequired } & SeatOpts);

/**
 * Run an action that might need a paid seat or, on Pro, the Team plan.
 *
 *   const { withSeat, seatDialog } = useSeatCharge();
 *   await withSeat((c) => seatsApi.inviteCollaborator(id, data, c), { reason, confirmLabel });
 *
 * The first call goes out without confirmation. If the server answers
 * 402 SEAT_REQUIRED, the seat quote is shown; 402 TEAM_REQUIRED shows the
 * Pro -> Team quote (or, without a Stripe subscription, a link to Team
 * checkout). On confirm the SAME action is retried with the confirmation, and
 * its result resolves the original promise. "Add as viewer" retries with
 * `{ role: 'viewer' }`. Cancel resolves to `null`. Any other error rejects.
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
    async <T,>(action: (confirmation?: SeatConfirmation) => Promise<T>, opts: SeatOpts): Promise<T | null> => {
      try {
        return await action();
      } catch (err) {
        const preview = seatQuoteFrom(err);
        const team = preview ? null : teamRequiredFrom(err);
        if (!preview && !team) throw err;
        return new Promise<T | null>((resolve, reject) => {
          resolver.current = {
            retry: action as (c: SeatConfirmation) => Promise<unknown>,
            resolve: resolve as (v: unknown) => void,
            reject,
          };
          setPending(preview ? { kind: 'seat', preview, ...opts } : { kind: 'team', team: team!, ...opts });
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

  const retryWith = useCallback(async (confirmation: SeatConfirmation) => {
    if (!resolver.current) return;
    const r = resolver.current;
    setBusy(true);
    try {
      r.resolve(await r.retry(confirmation));
    } catch (err) {
      r.reject(err);
    } finally {
      resolver.current = null;
      setBusy(false);
      setPending(null);
    }
  }, []);

  let seatDialog: ReactNode = null;
  if (pending?.kind === 'seat') {
    seatDialog = (
      <SeatChargeDialog
        preview={pending.preview}
        reason={pending.reason}
        confirmLabel={pending.confirmLabel}
        busy={busy}
        onConfirm={() => retryWith({ confirmSeatCharge: true, prorationDate: pending.preview.prorationDate })}
        onCancel={onCancel}
      />
    );
  } else if (pending?.kind === 'team') {
    const quote = pending.team.preview;
    seatDialog = (
      <TeamUpgradeDialog
        team={pending.team}
        reason={pending.reason}
        allowViewer={pending.viewerFallback === true}
        busy={busy}
        onUpgrade={() => {
          if (quote) void retryWith({ confirmTeamUpgrade: true, prorationDate: quote.prorationDate });
        }}
        onViewer={() => retryWith({ role: 'viewer' })}
        onCancel={onCancel}
      />
    );
  }

  return { withSeat, seatDialog };
}
