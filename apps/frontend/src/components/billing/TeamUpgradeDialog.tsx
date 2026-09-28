import { useRef } from 'react';
import { PUBLISHED_PRICES_USD, annualPricePerMonth } from '@qualcanvas/shared';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { formatMoney, type TeamRequired } from '../../services/seatsApi';

interface Props {
  team: TeamRequired;
  /** e.g. "Inviting jane@uni.edu as a coder". */
  reason: string;
  /** Offer "add as a viewer instead" (not for team membership: members always code). */
  allowViewer: boolean;
  busy?: boolean;
  onUpgrade: () => void;
  onViewer: () => void;
  onCancel: () => void;
}

/**
 * Shown when a Pro owner tries to add a second coder. Pro is a one-person
 * plan; coders need Team. Nothing is charged or changed until the owner
 * presses the upgrade button.
 *
 *  - in_place: the owner has a Stripe Pro subscription. The figures are
 *    Stripe's own quote (dueNow, nextRenewal) and the confirm call sends the
 *    same proration instant back, so the charge matches to the cent.
 *  - checkout: no subscription to switch (trial, legacy access). The owner
 *    picks Team on the pricing page; the per-seat price shown here is the one
 *    /pricing shows (PUBLISHED_PRICES_USD).
 */
export default function TeamUpgradeDialog({ team, reason, allowViewer, busy, onUpgrade, onViewer, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  useEscapeToClose(onCancel);
  const q = team.preview;
  const per = q?.interval === 'year' ? 'year' : 'month';
  const renewalDate = q?.currentPeriodEnd ? new Date(q.currentPeriodEnd).toLocaleDateString() : null;
  const coders = team.seatsNeeded - 1;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="team-upgrade-title"
        aria-describedby="team-upgrade-body"
        data-testid="team-upgrade-dialog"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="team-upgrade-title" className="text-lg font-semibold text-gray-900 dark:text-white">
          Upgrade to Team to add a coder?
        </h2>
        <div id="team-upgrade-body" className="mt-2 space-y-3 text-sm text-gray-600 dark:text-gray-300">
          <p>
            Pro is a one-person plan. {reason} needs Team, which has one seat for you and one for each coder
            {coders > 1 ? ` (${coders} coders, including people already coding on your canvases)` : ''}.
            {allowViewer ? ' Viewers are free on Pro, so you can add them as a viewer instead.' : ''}
          </p>
          {q ? (
            <>
              <dl className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
                <div className="flex justify-between py-0.5">
                  <dt>Plan</dt>
                  <dd className="font-medium text-gray-900 dark:text-white">Pro → Team</dd>
                </div>
                <div className="flex justify-between py-0.5">
                  <dt>Seats</dt>
                  <dd className="font-medium text-gray-900 dark:text-white" data-testid="team-upgrade-seats">
                    {q.newQuantity}
                  </dd>
                </div>
                {q.unitAmount !== null && (
                  <div className="flex justify-between py-0.5">
                    <dt>Team price per seat</dt>
                    <dd className="font-medium text-gray-900 dark:text-white">
                      {formatMoney(q.unitAmount, q.currency)} / {per}
                      {q.hasDiscount ? ' before your discount' : ''}
                    </dd>
                  </div>
                )}
                <div className="flex justify-between py-0.5">
                  <dt>Charged today</dt>
                  <dd className="font-medium text-gray-900 dark:text-white" data-testid="team-upgrade-due-now">
                    {formatMoney(q.dueNow, q.currency)}
                  </dd>
                </div>
                <div className="flex justify-between py-0.5">
                  <dt>{renewalDate ? `From ${renewalDate}` : 'Each renewal'}</dt>
                  <dd className="font-medium text-gray-900 dark:text-white" data-testid="team-upgrade-renewal">
                    {formatMoney(q.nextRenewal, q.currency)} / {per}
                    {q.hasDiscount ? ' before your discount' : ''}
                  </dd>
                </div>
              </dl>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                Today&apos;s charge covers Team for the rest of this billing period, less the unused part of your Pro
                plan and any credit you already have. Nothing is charged until you press the button below.
              </p>
            </>
          ) : (
            <p data-testid="team-upgrade-checkout">
              Team is ${PUBLISHED_PRICES_USD.team.monthly} per seat a month, or ${annualPricePerMonth('team')} per seat
              a month billed annually. Choose Team on the pricing page; nothing is charged until you confirm at
              checkout.
            </p>
          )}
        </div>
        <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          {allowViewer && (
            <button
              type="button"
              onClick={onViewer}
              disabled={busy}
              className="flex-1 rounded-lg border border-brand-600 py-2.5 text-sm font-medium text-brand-700 hover:bg-brand-50 disabled:opacity-50 dark:text-brand-300 dark:hover:bg-gray-700"
            >
              Add as viewer (free)
            </button>
          )}
          {q ? (
            <button
              type="button"
              onClick={onUpgrade}
              disabled={busy}
              className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
            >
              {busy ? 'Upgrading…' : 'Upgrade to Team'}
            </button>
          ) : (
            <a
              href="/pricing"
              className="flex-1 rounded-lg bg-brand-600 py-2.5 text-center text-sm font-semibold text-white hover:bg-brand-700"
            >
              See the Team plan
            </a>
          )}
        </div>
      </div>
    </div>
  );
}
