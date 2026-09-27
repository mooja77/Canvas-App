import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { seatsApi, type SeatStatus } from '../../services/seatsApi';

const DISMISS_KEY = 'qc-seat-banner-dismissed';

/**
 * In-app prompt for an owner whose coders outnumber their paid seats
 * (e.g. they bought fewer seats than people at checkout, or reduced seats in
 * the billing portal). Coders keep editing through the grace period; the
 * banner says until when, and links to Account → Seats.
 */
export default function SeatShortfallBanner() {
  const [status, setStatus] = useState<SeatStatus | null>(null);
  const [dismissed, setDismissed] = useState(() => {
    try {
      return sessionStorage.getItem(DISMISS_KEY) === '1';
    } catch {
      return false;
    }
  });

  useEffect(() => {
    let cancelled = false;
    // Deferred so a synchronous failure (e.g. no API client) is just "no banner".
    Promise.resolve()
      .then(() => seatsApi.get())
      .then((res) => {
        if (!cancelled) setStatus(res.data.data);
      })
      .catch(() => {
        /* Not an owner billed per seat, or offline: no banner. */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!status || status.mode !== 'billed' || status.unseatedCount === 0) return null;
  if (dismissed && !status.enforcing) return null;
  const n = status.unseatedCount;
  const graceDate = status.graceEndsAt ? new Date(status.graceEndsAt).toLocaleDateString() : null;
  return (
    <div
      role="status"
      data-testid="seat-shortfall-banner"
      className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-sm ${
        status.enforcing
          ? 'bg-red-50 text-red-900 dark:bg-red-900/30 dark:text-red-200'
          : 'bg-amber-50 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100'
      }`}
    >
      <p>
        {status.enforcing
          ? `${n} coder${n === 1 ? ' is' : 's are'} view-only because they have no paid seat.`
          : `${n} coder${n === 1 ? " doesn't" : "s don't"} have a paid seat. They can keep editing until ${graceDate}, then they'll be view-only.`}
      </p>
      <div className="flex items-center gap-3">
        <Link to="/account#seats" className="font-semibold underline underline-offset-2">
          Review seats
        </Link>
        {!status.enforcing && (
          <button
            type="button"
            onClick={() => {
              setDismissed(true);
              try {
                sessionStorage.setItem(DISMISS_KEY, '1');
              } catch {
                /* private mode: dismiss for this page only */
              }
            }}
            className="text-xs underline"
            aria-label="Hide this reminder for now"
          >
            Not now
          </button>
        )}
      </div>
    </div>
  );
}
