import { useEffect, useRef, useState } from 'react';
import type { CanvasDetail, CanvasTranscript } from '@qualcanvas/shared';
import { useActiveCanvas, useCanvasStore } from '../../../stores/canvasStore';
import { useEscapeToClose } from '../../../hooks/useEscapeToClose';
import { useFocusTrap } from '../../../hooks/useFocusTrap';
import { emitSocketEvent } from '../../../lib/socket';
import {
  readTranscriptMetadata,
  saveTranscriptMetadata,
  type TranscriptMetadata,
} from './transcriptMetadataPersistence';

export default function TranscriptDetailsPanel({ onClose }: { onClose: () => void }) {
  const canvas = useActiveCanvas();
  return canvas ? <Details key={canvas.id} canvas={canvas} onClose={onClose} /> : null;
}

function Details({ canvas, onClose }: { canvas: CanvasDetail; onClose: () => void }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusTrap(dialogRef);
  useEscapeToClose(onClose);
  const mounted = useRef(false);
  const requestEpoch = useRef(0);
  const busyRef = useRef(false);
  const [sourceId, setSourceId] = useState(canvas.transcripts[0]?.id ?? '');
  const [date, setDate] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [location, setLocation] = useState('');
  const [busy, setBusy] = useState(false);
  const [verified, setVerified] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [saved, setSaved] = useState<CanvasTranscript | null>(null);
  const isViewer = canvas.myRole === 'viewer';
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const publish = (row: CanvasTranscript) => {
    useCanvasStore.setState((state) =>
      state.activeCanvasId === canvas.id && state.activeCanvas?.id === canvas.id
        ? {
            activeCanvas: {
              ...state.activeCanvas,
              transcripts: state.activeCanvas.transcripts.map((item) =>
                item.id === row.id ? { ...item, ...row } : item,
              ),
            },
          }
        : {},
    );
    setSaved(row);
  };

  useEffect(() => {
    setVerified(false);
    setUncertain(false);
    setSaved(null);
    setError('');
    setMessage('');
    setDate('');
    setLatitude('');
    setLongitude('');
    setLocation('');
    if (!sourceId) return;
    const epoch = ++requestEpoch.current;
    busyRef.current = true;
    setBusy(true);
    readTranscriptMetadata(canvas.id, sourceId)
      .then((row) => {
        if (!mounted.current || epoch !== requestEpoch.current) return;
        setSaved(row);
        setDate(row.eventDate ? new Date(row.eventDate).toISOString().slice(0, 19) : '');
        setLatitude(row.latitude === null ? '' : String(row.latitude));
        setLongitude(row.longitude === null ? '' : String(row.longitude));
        setLocation(row.locationName ?? '');
        setVerified(true);
      })
      .catch(() => {
        if (mounted.current && epoch === requestEpoch.current)
          setError('Could not load saved details. Check saved details before making changes.');
      })
      .finally(() => {
        if (mounted.current && epoch === requestEpoch.current) {
          busyRef.current = false;
          setBusy(false);
        }
      });
  }, [canvas.id, sourceId]);

  const checkSaved = async () => {
    if (busyRef.current || !sourceId) return;
    const epoch = ++requestEpoch.current;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      const row = await readTranscriptMetadata(canvas.id, sourceId);
      if (!mounted.current || epoch !== requestEpoch.current) return;
      publish(row);
      setVerified(true);
      setUncertain(false);
      if (saved === null) {
        setDate(row.eventDate ? new Date(row.eventDate).toISOString().slice(0, 19) : '');
        setLatitude(row.latitude === null ? '' : String(row.latitude));
        setLongitude(row.longitude === null ? '' : String(row.longitude));
        setLocation(row.locationName ?? '');
      }
      setMessage('Saved details checked below. Your typed entries are still here; compare them before saving.');
    } catch {
      if (mounted.current && epoch === requestEpoch.current)
        setError('Could not check saved details. Your entries are still here; try checking again.');
    } finally {
      if (mounted.current && epoch === requestEpoch.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  const save = async () => {
    if (busyRef.current || !verified || isViewer || !sourceId) return;
    const lat = latitude.trim() ? Number(latitude) : null;
    const lng = longitude.trim() ? Number(longitude) : null;
    const eventDate = date ? new Date(`${date}Z`) : null;
    if (
      (lat === null) !== (lng === null) ||
      (lat !== null && (!Number.isFinite(lat) || Math.abs(lat) > 90)) ||
      (lng !== null && (!Number.isFinite(lng) || Math.abs(lng) > 180)) ||
      (eventDate &&
        (!Number.isFinite(eventDate.getTime()) || eventDate.toISOString().slice(0, 16) !== date.slice(0, 16))) ||
      location.trim().length > 200
    ) {
      setError(
        'Enter a valid UTC date and both coordinates, or leave both coordinates blank. Latitude must be −90 to 90; longitude −180 to 180. Keep the location label under 201 characters.',
      );
      return;
    }
    const metadata: TranscriptMetadata = {
      eventDate: eventDate?.toISOString() ?? null,
      latitude: lat,
      longitude: lng,
      locationName: location.trim() || null,
    };
    const epoch = ++requestEpoch.current;
    busyRef.current = true;
    setBusy(true);
    setError('');
    setMessage('');
    try {
      const row = await saveTranscriptMetadata(canvas.id, sourceId, metadata);
      if (!mounted.current || epoch !== requestEpoch.current) return;
      publish(row);
      setMessage(
        // Only a confirmed write broadcasts a change; a read-only check does not.
        'Details saved and checked. Return to your timeline or location plot and choose Run to update its result.',
      );
      emitSocketEvent('canvas:transcript-updated', { canvasId: canvas.id, data: { transcriptId: sourceId } });
    } catch {
      if (mounted.current && epoch === requestEpoch.current) {
        setVerified(false);
        setUncertain(true);
        setError(
          'We could not confirm the save. Your entries are still here. Check saved details before saving again; checking never repeats a save.',
        );
      }
    } finally {
      if (mounted.current && epoch === requestEpoch.current) {
        busyRef.current = false;
        setBusy(false);
      }
    }
  };

  return (
    <div className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-2">
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="transcript-details-title"
        className="modal-content max-h-[90vh] w-full max-w-xl overflow-auto rounded-xl bg-white p-5 text-sm text-gray-700 shadow-xl dark:bg-gray-800 dark:text-gray-200"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id="transcript-details-title" className="text-base font-semibold">
            Transcript dates and locations
          </h2>
          <button className="min-h-8 min-w-8" aria-label="Close transcript details" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="my-3">
          Add when and where an interview or event happened so you can compare it on a timeline or location plot. These
          details are optional and do not change your transcript text or codes.
        </p>
        <p className="mb-3">
          Use only locations you have permission to record. A broad area is often enough; avoid identifying a
          participant’s home. We do not look up or guess coordinates.
        </p>
        {canvas.transcripts.length === 0 ? (
          <div>
            <p>Add your interview or document first.</p>
            <button
              className="btn-primary my-3 min-h-11 px-3"
              onClick={() => {
                onClose();
                window.dispatchEvent(new CustomEvent('qualcanvas:open-transcript-picker'));
              }}
            >
              Paste or import a transcript
            </button>
            <a className="block underline" href="/help/first-code.html">
              See a worked transcript example
            </a>
          </div>
        ) : (
          <>
            <label className="block" htmlFor="details-source">
              Transcript
            </label>
            <select
              id="details-source"
              className="input my-2 w-full"
              value={sourceId}
              disabled={busy || uncertain}
              onChange={(event) => setSourceId(event.target.value)}
            >
              {canvas.transcripts.map((source) => (
                <option key={source.id} value={source.id}>
                  {source.title}
                </option>
              ))}
            </select>
            {busy && <p role="status">Checking transcript details…</p>}
            {isViewer && <p>This canvas is read-only. Ask its owner or editor to change these details.</p>}
            {error && (
              <p role="alert" className="my-3">
                {error}
              </p>
            )}
            {message && (
              <p role="status" className="my-3">
                {message}
              </p>
            )}
            <fieldset disabled={busy || !verified || isViewer} className="space-y-3">
              <div>
                <label className="block" htmlFor="details-date">
                  Event date and time (UTC, optional)
                </label>
                <input
                  id="details-date"
                  type="datetime-local"
                  step="1"
                  className="input w-full"
                  value={date}
                  onChange={(event) => setDate(event.target.value)}
                />
                <p className="mt-1 text-xs">
                  Enter UTC, not your computer’s local time. Leave blank if you do not know the date.
                </p>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="block" htmlFor="details-lat">
                    Latitude (optional)
                  </label>
                  <input
                    id="details-lat"
                    className="input w-full"
                    inputMode="decimal"
                    value={latitude}
                    onChange={(event) => setLatitude(event.target.value)}
                  />
                </div>
                <div>
                  <label className="block" htmlFor="details-lng">
                    Longitude (optional)
                  </label>
                  <input
                    id="details-lng"
                    className="input w-full"
                    inputMode="decimal"
                    value={longitude}
                    onChange={(event) => setLongitude(event.target.value)}
                  />
                </div>
              </div>
              <div>
                <label className="block" htmlFor="details-location">
                  Location label (optional)
                </label>
                <input
                  id="details-location"
                  className="input w-full"
                  maxLength={200}
                  value={location}
                  onChange={(event) => setLocation(event.target.value)}
                />
              </div>
              <p className="text-xs">
                Clearing a date removes it from timeline analysis. Clearing both coordinates removes it from the
                location plot; your transcript remains.
              </p>
              <button className="btn-primary min-h-11 px-3" onClick={save}>
                Save transcript details
              </button>
            </fieldset>
            <button className="my-3 min-h-11 rounded border border-gray-400 px-3" disabled={busy} onClick={checkSaved}>
              Check saved details
            </button>
            {saved && (
              <div className="rounded border border-gray-300 p-3 text-xs dark:border-gray-600">
                <h3 className="font-semibold">Last verified saved details</h3>
                <p>Date (UTC): {saved.eventDate ?? 'Not set'}</p>
                <p>Coordinates: {saved.latitude === null ? 'Not set' : `${saved.latitude}, ${saved.longitude}`}</p>
                <p>Location: {saved.locationName || 'Not set'}</p>
              </div>
            )}
          </>
        )}
        <p className="mt-4">
          <a className="underline" href="/help/transcript-dates-locations.html">
            Read the date and location setup guide
          </a>
        </p>
        <p className="mt-4">
          <a className="underline" href="mailto:support@qualcanvas.com">
            Email us for setup help
          </a>
          . We reply within two working days. No call needed; please do not email sensitive research data.
        </p>
      </div>
    </div>
  );
}
