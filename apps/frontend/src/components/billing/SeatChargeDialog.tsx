import { useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';
import { useEscapeToClose } from '../../hooks/useEscapeToClose';
import { formatMoney, type SeatPreview } from '../../services/seatsApi';

interface Props {
  preview: SeatPreview;
  /** e.g. "Inviting jane@uni.edu as a coder" — what the charge is for. */
  reason: string;
  confirmLabel: string;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * Confirmation of a seat charge, shown BEFORE anything is billed. The numbers
 * come from Stripe's own invoice preview (dueNow, nextRenewal); the server
 * charges exactly this quote because the confirm call sends the same
 * proration instant back.
 */
export default function SeatChargeDialog({ preview, reason, confirmLabel, busy, onConfirm, onCancel }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  useFocusTrap(ref);
  useEscapeToClose(onCancel);
  const added = preview.newQuantity - preview.currentQuantity;
  const per = preview.interval === 'year' ? 'year' : 'month';
  const renewalDate = preview.currentPeriodEnd ? new Date(preview.currentPeriodEnd).toLocaleDateString() : null;
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={onCancel}
    >
      <div
        ref={ref}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="seat-charge-title"
        aria-describedby="seat-charge-body"
        className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id="seat-charge-title" className="text-lg font-semibold text-gray-900 dark:text-white">
          {added === 1 ? 'Add a paid seat?' : `Add ${added} paid seats?`}
        </h2>
        <div id="seat-charge-body" className="mt-2 space-y-3 text-sm text-gray-600 dark:text-gray-300">
          <p>
            {reason} adds {added === 1 ? 'a seat' : `${added} seats`} to your plan. Coders need a paid seat; viewers are
            free.
          </p>
          {added > 1 && (
            <p>
              This also gives a seat to {added - 1} coder{added - 1 === 1 ? '' : 's'} already on your canvases who
              {added - 1 === 1 ? " doesn't" : " don't"} have one yet.
            </p>
          )}
          <dl className="rounded-lg bg-gray-50 p-3 dark:bg-gray-700/50">
            <div className="flex justify-between py-0.5">
              <dt>Seats</dt>
              <dd className="font-medium text-gray-900 dark:text-white" data-testid="seat-quantity-change">
                {preview.currentQuantity} → {preview.newQuantity}
              </dd>
            </div>
            {preview.unitAmount !== null && (
              <div className="flex justify-between py-0.5">
                <dt>Price per seat</dt>
                <dd className="font-medium text-gray-900 dark:text-white">
                  {formatMoney(preview.unitAmount, preview.currency)} / {per}
                  {preview.hasDiscount ? ' before your discount' : ''}
                </dd>
              </div>
            )}
            <div className="flex justify-between py-0.5">
              <dt>Charged today</dt>
              <dd className="font-medium text-gray-900 dark:text-white" data-testid="seat-due-now">
                {formatMoney(preview.dueNow, preview.currency)}
              </dd>
            </div>
            <div className="flex justify-between py-0.5">
              <dt>{renewalDate ? `From ${renewalDate}` : 'Each renewal'}</dt>
              <dd className="font-medium text-gray-900 dark:text-white" data-testid="seat-next-renewal">
                {formatMoney(preview.nextRenewal, preview.currency)} / {per}
              </dd>
            </div>
          </dl>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Today&apos;s charge covers only the rest of this billing period. If you later remove a coder or make them a
            viewer, the unused time is credited to your next bill.
          </p>
        </div>
        <div className="mt-5 flex gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 rounded-lg border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="flex-1 rounded-lg bg-brand-600 py-2.5 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
          >
            {busy ? 'Charging…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
