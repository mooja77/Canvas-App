import toast from 'react-hot-toast';
import { apiErrorMessage } from '../../../services/api';

/**
 * Node editors save through the store, which talks to the API. When that call
 * fails (view-only role, plan limit, offline) the node re-renders from the
 * unchanged store and the user's text simply vanishes. These helpers make the
 * failure visible instead of pretending the edit was saved.
 */
export function reportNodeSaveError(err: unknown, fallback: string): void {
  toast.error(apiErrorMessage(err, fallback));
}

/**
 * Fire-and-forget save (dropdowns, colour pickers) that still reports failure.
 */
export function saveOrReport(save: () => void | Promise<unknown>, fallback: string): void {
  try {
    Promise.resolve(save()).catch((err) => reportNodeSaveError(err, fallback));
  } catch (err) {
    reportNodeSaveError(err, fallback);
  }
}
