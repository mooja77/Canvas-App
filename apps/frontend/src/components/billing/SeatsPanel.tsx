import { useCallback, useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { formatMoney, seatsApi, type SeatHolder, type SeatStatus } from '../../services/seatsApi';
import { useSeatCharge } from '../../hooks/useSeatCharge';
import ConfirmDialog from '../canvas/ConfirmDialog';

function where(h: SeatHolder): string {
  const parts = [
    ...h.canvases.map((c) => (c.inTrash ? `${c.name} (in trash)` : c.name)),
    ...h.teams.map((t) => `team ${t.name}`),
  ];
  return parts.length > 3 ? `${parts.slice(0, 3).join(', ')} and ${parts.length - 3} more` : parts.join(', ');
}

/**
 * Account → Seats. Who holds a paid seat on this account, what it costs, and
 * the one-off grace period for coders who don't have a seat yet. Renders
 * nothing for plans that are not billed per seat and have no coders.
 */
export default function SeatsPanel() {
  const [status, setStatus] = useState<SeatStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [releasing, setReleasing] = useState<SeatHolder | null>(null);
  const [busy, setBusy] = useState(false);
  const { withSeat, seatDialog } = useSeatCharge();

  const load = useCallback(async () => {
    setError(null);
    try {
      const res = await seatsApi.get();
      setStatus(res.data.data);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      // Legacy access-code sessions get 403: there is nothing to manage.
      if (err?.response?.status === 403) setStatus(null);
      else setError(err?.response?.data?.error || 'Could not load your seats.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // The shortfall banner links to /account#seats: bring the panel into view.
  useEffect(() => {
    if (!loading && status && window.location.hash === '#seats') {
      document.getElementById('seats')?.scrollIntoView?.({ block: 'start' });
    }
  }, [loading, status]);

  if (loading) {
    return (
      <div
        className="bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6"
        aria-busy="true"
      >
        <p className="text-sm text-gray-500 dark:text-gray-400">Loading seats…</p>
      </div>
    );
  }
  if (error) {
    return (
      <div
        className="bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6"
        role="alert"
      >
        <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        <button onClick={load} className="mt-2 text-sm font-medium text-brand-600 hover:underline dark:text-brand-400">
          Try again
        </button>
      </div>
    );
  }
  if (!status || (status.mode !== 'billed' && status.mode !== 'trial' && status.holders.length === 0)) return null;

  const per = status.price?.interval === 'year' ? 'year' : 'month';
  const priceText =
    status.price?.unitAmount != null
      ? `${formatMoney(status.price.unitAmount, status.price.currency)} per seat / ${per}`
      : null;
  const graceDate = status.graceEndsAt ? new Date(status.graceEndsAt).toLocaleDateString() : null;

  const addMissingSeats = async () => {
    setBusy(true);
    try {
      const res = await withSeat((c) => seatsApi.setQuantity(status.seatsUsed, c), {
        reason: `Giving ${status.unseatedCount} coder${status.unseatedCount === 1 ? '' : 's'} a seat`,
        confirmLabel: 'Add seats',
      });
      if (res) {
        toast.success('Seats added. Everyone can edit again.');
        await load();
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not add seats. Nothing was charged.');
    } finally {
      setBusy(false);
    }
  };

  const release = async () => {
    if (!releasing) return;
    setBusy(true);
    try {
      const res = await seatsApi.release(releasing.userId);
      setStatus({ ...res.data.data, price: status.price });
      toast.success(`${releasing.name} is now a viewer. The unused seat time is credited to your next bill.`);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } catch (err: any) {
      toast.error(err?.response?.data?.error || 'Could not change their access.');
    } finally {
      setBusy(false);
      setReleasing(null);
    }
  };

  return (
    <section
      id="seats"
      aria-labelledby="seats-heading"
      className="bg-white dark:bg-gray-800 rounded-xl ring-1 ring-gray-200 dark:ring-gray-700 p-6 mb-6 scroll-mt-6"
    >
      <h2
        id="seats-heading"
        className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-4"
      >
        Seats
      </h2>

      {status.mode === 'trial' && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          During your trial, coders you invite are free. When you subscribe to Pro or Team, each coder needs a paid
          seat; checkout suggests one seat per person and you can change it there. Viewers are always free.
        </p>
      )}
      {status.mode === 'grandfathered' && (
        <p className="text-sm text-gray-600 dark:text-gray-300">
          Your account keeps its original access, so coders on your canvases are not billed per seat.
        </p>
      )}

      {status.mode === 'billed' && (
        <>
          <p className="text-sm text-gray-700 dark:text-gray-200" data-testid="seats-summary">
            {status.seatsUsed > (status.seatsPurchased ?? 1)
              ? `${status.seatsUsed} people need a seat (you hold one); ${status.seatsPurchased} paid for.`
              : `${status.seatsUsed} of ${status.seatsPurchased} paid seat${status.seatsPurchased === 1 ? '' : 's'} in use (you hold one).`}
            {priceText ? ` ${priceText}.` : ''}
          </p>
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            A seat is added, with your confirmation, when you invite a coder. Viewers are free. Removing a coder, or
            making them a viewer, frees their seat and credits the unused time to your next bill.
          </p>

          {status.unseatedCount > 0 && (
            <div
              role="status"
              className={`mt-4 rounded-lg p-3 text-sm ${
                status.enforcing
                  ? 'bg-red-50 text-red-800 dark:bg-red-900/20 dark:text-red-300'
                  : 'bg-amber-50 text-amber-900 dark:bg-amber-900/20 dark:text-amber-200'
              }`}
            >
              <p>
                {status.unseatedCount} coder{status.unseatedCount === 1 ? " doesn't" : "s don't"} have a paid seat.{' '}
                {status.enforcing
                  ? 'They can still open your canvases but cannot edit until you add seats.'
                  : `They can keep editing until ${graceDate}; after that they can view but not edit until you add seats.`}
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <button
                  onClick={addMissingSeats}
                  disabled={busy}
                  className="rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
                >
                  Add {status.unseatedCount} seat{status.unseatedCount === 1 ? '' : 's'}
                </button>
                <span className="self-center text-xs">or make some of them viewers below.</span>
              </div>
            </div>
          )}
        </>
      )}

      {status.holders.length === 0 ? (
        <div className="mt-4 rounded-lg border border-dashed border-gray-300 p-4 text-sm text-gray-600 dark:border-gray-600 dark:text-gray-300">
          <p className="font-medium text-gray-800 dark:text-gray-100">No coders yet</p>
          <p className="mt-1">
            Coding with colleagues lets you compare coders with Intercoder Agreement. Open a canvas, choose{' '}
            <span className="font-medium">Share</span>, and invite a coder by email — or invite a viewer for free.
          </p>
        </div>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 dark:divide-gray-700" aria-label="People holding a seat">
          {status.holders.map((h) => (
            <li key={h.userId} className="flex items-center justify-between gap-3 py-2">
              <div className="min-w-0">
                <p className="truncate text-sm text-gray-900 dark:text-white">
                  {h.name}{' '}
                  {status.mode === 'billed' && (
                    <span
                      className={`ml-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-medium align-middle ${
                        h.seated
                          ? 'bg-green-50 text-green-700 dark:bg-green-900/30 dark:text-green-300'
                          : 'bg-amber-50 text-amber-800 dark:bg-amber-900/30 dark:text-amber-200'
                      }`}
                    >
                      {h.seated ? 'Seat' : status.enforcing ? 'No seat · view only' : 'No seat'}
                    </span>
                  )}
                </p>
                <p className="truncate text-xs text-gray-500 dark:text-gray-400">
                  {h.email}
                  {where(h) ? ` · ${where(h)}` : ''}
                </p>
              </div>
              <button
                onClick={() => setReleasing(h)}
                disabled={busy}
                className="shrink-0 rounded-lg border border-gray-300 px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-600 dark:text-gray-300 dark:hover:bg-gray-700 disabled:opacity-50"
                aria-label={`Make ${h.name} a viewer and free their seat`}
              >
                Make viewer
              </button>
            </li>
          ))}
        </ul>
      )}

      {releasing && (
        <ConfirmDialog
          title="Make viewer?"
          message={`${releasing.name} will be able to open your canvases but not change them, and will leave your teams. Their existing coding stays.`}
          confirmLabel="Make viewer"
          onConfirm={release}
          onCancel={() => setReleasing(null)}
        />
      )}
      {seatDialog}
    </section>
  );
}
