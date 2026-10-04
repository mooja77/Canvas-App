import { useEffect, useId, useRef, useState } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface ConfirmDialogProps {
  title: string;
  message: string;
  confirmLabel?: string;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export default function ConfirmDialog({
  title,
  message,
  confirmLabel = 'Delete',
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const messageId = useId();
  const errorId = useId();
  const [submitting, setSubmitting] = useState(false);
  const [failed, setFailed] = useState(false);
  useFocusTrap(dialogRef);

  useEffect(() => {
    if (submitting) dialogRef.current?.focus();
    else cancelRef.current?.focus();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      // The canvas also uses Escape to deselect nodes. Consume it before
      // background shortcuts can unmount the control that opened this modal.
      e.preventDefault();
      e.stopPropagation();
      if (!submitting) onCancel();
    };
    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [onCancel, submitting]);

  const handleConfirm = async () => {
    if (submitting) return;
    setFailed(false);
    setSubmitting(true);
    try {
      await onConfirm();
    } catch (error) {
      setFailed(true);
      console.error('Confirmation action failed:', error);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      tabIndex={-1}
      className="modal-backdrop fixed inset-0 z-[9999] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm"
      onClick={() => {
        if (!submitting) onCancel();
      }}
      role="alertdialog"
      aria-modal="true"
      aria-busy={submitting}
      aria-labelledby={titleId}
      aria-describedby={failed ? `${messageId} ${errorId}` : messageId}
    >
      <div
        className="modal-enter max-h-[calc(100dvh-2rem)] w-full max-w-sm overflow-y-auto rounded-2xl bg-white p-5 shadow-xl ring-1 ring-black/5 dark:bg-gray-800"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-3 mb-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
            <svg
              className="h-4 w-4 text-red-600 dark:text-red-400"
              fill="none"
              viewBox="0 0 24 24"
              strokeWidth={1.5}
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
              />
            </svg>
          </div>
          <div>
            <h4 id={titleId} className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h4>
            <p id={messageId} className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {message}
            </p>
          </div>
        </div>
        {failed && (
          <p id={errorId} role="alert" className="mb-3 text-sm text-red-700 dark:text-red-300">
            We couldn’t confirm this action finished. Choose Cancel to check what changed before trying again.
          </p>
        )}
        <div className="flex justify-end gap-2">
          <button
            type="button"
            ref={cancelRef}
            onClick={onCancel}
            disabled={submitting}
            className="min-h-11 min-w-11 rounded-lg border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-400 dark:hover:bg-gray-750"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={submitting}
            className="min-h-11 min-w-11 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60 dark:bg-red-700 dark:hover:bg-red-600"
          >
            {submitting ? 'Working...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
