import { useEffect, useRef, useState } from 'react';
import { useUIStore } from '../../stores/uiStore';

interface Props {
  id: string;
  message: string;
  // Anchor element ref. If absent, tooltip renders inline.
  anchor?: React.RefObject<HTMLElement | null>;
  // Side relative to anchor. Default 'top'.
  side?: 'top' | 'bottom' | 'left' | 'right';
  // Skip dismissal-on-dismiss-button entirely; useful for tests.
  noDismissButton?: boolean;
}

/**
 * Just-in-time tooltip. Fires once per user per tooltip-id, then dismisses
 * itself (persisted to uiStore.dismissedJitTooltips). Auto-dismisses after
 * 8 seconds so it doesn't linger if the user ignores it.
 */
export default function JustInTimeTooltip({ id, message, anchor, side = 'top', noDismissButton }: Props) {
  const dismissedSet = useUIStore((s) => s.dismissedJitTooltips);
  const dismiss = useUIStore((s) => s.dismissJitTooltip);
  const [visible, setVisible] = useState(false);
  const [position, setPosition] = useState<{ top: number; left: number } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const alreadyDismissed = dismissedSet.includes(id);

  useEffect(() => {
    if (alreadyDismissed) return;
    setVisible(true);
    timerRef.current = setTimeout(() => {
      setVisible(false);
      dismiss(id);
    }, 8000);
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [alreadyDismissed, dismiss, id]);

  useEffect(() => {
    if (!visible || !anchor?.current) {
      setPosition(null);
      return;
    }
    const rect = anchor.current.getBoundingClientRect();
    const gap = 8;
    switch (side) {
      case 'bottom':
        setPosition({ top: rect.bottom + gap, left: rect.left + rect.width / 2 });
        break;
      case 'left':
        setPosition({ top: rect.top + rect.height / 2, left: rect.left - gap });
        break;
      case 'right':
        setPosition({ top: rect.top + rect.height / 2, left: rect.right + gap });
        break;
      case 'top':
      default:
        setPosition({ top: rect.top - gap, left: rect.left + rect.width / 2 });
    }
  }, [visible, anchor, side]);

  if (!visible) return null;

  const handleDismiss = () => {
    setVisible(false);
    dismiss(id);
  };

  const transform =
    side === 'top'
      ? 'translate(-50%, -100%)'
      : side === 'bottom'
        ? 'translate(-50%, 0)'
        : side === 'left'
          ? 'translate(-100%, -50%)'
          : 'translate(0, -50%)';

  const style: React.CSSProperties = position
    ? { position: 'fixed', top: position.top, left: position.left, transform, zIndex: 50 }
    : { position: 'relative' };

  return (
    <div
      role="tooltip"
      data-jit-tooltip-id={id}
      style={style}
      className="max-w-xs rounded-lg bg-gray-900 dark:bg-gray-700 px-3 py-2 text-xs text-white shadow-xl"
    >
      <div className="flex items-start gap-2">
        <span>{message}</span>
        {!noDismissButton && (
          <button
            type="button"
            onClick={handleDismiss}
            aria-label="Dismiss tooltip"
            className="shrink-0 text-gray-400 hover:text-white"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
