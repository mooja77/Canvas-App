import { useState } from 'react';
import toast from 'react-hot-toast';
import { useCanvasStore } from '../../stores/canvasStore';
import { canvasApi } from '../../services/api';
import ConfirmDialog from '../canvas/ConfirmDialog';

/**
 * Starter templates open on a small coded sample study. This strip says so
 * plainly and removes it in one click. The codebook and everything the
 * researcher made on their own transcripts stay. Only when the researcher has
 * coded the sample text themselves do we ask first, because that work goes
 * with it.
 */
export default function SampleDataBanner() {
  const activeCanvas = useCanvasStore((s) => s.activeCanvas);
  const refreshCanvas = useCanvasStore((s) => s.refreshCanvas);
  const [busy, setBusy] = useState(false);
  const [confirming, setConfirming] = useState(false);

  if (!activeCanvas) return null;
  const sampleTranscripts = activeCanvas.transcripts.filter((t) => t.sourceType === 'sample');
  if (sampleTranscripts.length === 0) return null;
  const sampleIds = new Set(sampleTranscripts.map((t) => t.id));
  const sampleCodings = activeCanvas.codings.filter((c) => c.source === 'sample').length;
  const ownCodingsOnSample = activeCanvas.codings.filter(
    (c) => c.source !== 'sample' && sampleIds.has(c.transcriptId),
  ).length;

  const remove = async () => {
    setBusy(true);
    try {
      await canvasApi.removeSampleData(activeCanvas.id);
      await refreshCanvas();
      toast.success('Sample study removed. Your codes and your own transcripts are unchanged.');
    } catch (err: unknown) {
      const message =
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error ??
        'Could not remove the sample study. Check your connection and try again.';
      toast.error(message);
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  };

  return (
    <>
      <div
        role="region"
        aria-label="Sample data"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-200 bg-amber-50 px-4 py-1.5 text-xs text-amber-900 dark:border-amber-800/60 dark:bg-amber-900/20 dark:text-amber-200"
      >
        <span className="rounded bg-amber-200 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:bg-amber-800 dark:text-amber-100">
          Sample
        </span>
        <span>
          This project includes a sample study ({sampleTranscripts.length} sample transcript
          {sampleTranscripts.length === 1 ? '' : 's'}, {sampleCodings} coded excerpt{sampleCodings === 1 ? '' : 's'}) so
          you can see a coded canvas. It never counts toward your plan.
        </span>
        <button
          type="button"
          disabled={busy}
          onClick={() => (ownCodingsOnSample > 0 ? setConfirming(true) : void remove())}
          className="ml-auto rounded-md border border-amber-300 bg-white px-2.5 py-1 font-medium text-amber-900 hover:bg-amber-100 disabled:opacity-60 dark:border-amber-700 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
        >
          {busy ? 'Removing…' : 'Remove sample data'}
        </button>
      </div>
      {confirming && (
        <ConfirmDialog
          title="Remove the sample study?"
          message={`You coded ${ownCodingsOnSample} excerpt${ownCodingsOnSample === 1 ? '' : 's'} in the sample transcripts. Those go with the sample. Your codes and your own transcripts stay.`}
          confirmLabel="Remove sample data"
          onConfirm={remove}
          onCancel={() => setConfirming(false)}
        />
      )}
    </>
  );
}
