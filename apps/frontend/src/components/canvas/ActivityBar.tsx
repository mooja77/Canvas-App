import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { trackEvent } from '../../utils/analytics';

/**
 * Sprint G — VS Code-style activity bar.
 *
 * 48-px left rail with 8 icons. Clicking an icon either:
 *   - Selects an active "activity" (Canvases / Codebook / Cases / Analyze /
 *     AI / Collaborate / Quality / Schedule) which the parent Sidebar
 *     component reads via `activeActivity` prop to render the right panel
 *   - Or, for Settings (bottom-anchored), navigates to /account
 *
 * Renders only when the `activity_bar_v2` feature flag is true; gated by
 * the parent. The original toolbar continues to render in parallel during
 * the soft-launch period so existing users see no breaking change.
 */
export type ActivityId = 'canvases' | 'codebook' | 'cases' | 'analyze' | 'ai' | 'collaborate' | 'quality' | 'schedule';

interface Props {
  activeActivity: ActivityId | null;
  onSelectActivity: (id: ActivityId) => void;
}

const ACTIVITIES: { id: ActivityId; label: string; icon: string; description: string }[] = [
  { id: 'canvases', label: 'Canvases', icon: '📋', description: 'Recent, pinned, all canvases' },
  { id: 'codebook', label: 'Codebook', icon: '📚', description: 'Code list + hierarchy' },
  { id: 'cases', label: 'Cases', icon: '👥', description: 'Cases + cross-case analysis' },
  { id: 'analyze', label: 'Analyze', icon: '📊', description: '10 analysis tools' },
  { id: 'ai', label: 'AI', icon: '✨', description: 'Auto-code, AI Chat, Summarize' },
  { id: 'collaborate', label: 'Collaborate', icon: '🤝', description: 'Share, comments, intercoder' },
  { id: 'quality', label: 'Quality', icon: '🛡️', description: 'Krippendorff α, ethics, audit' },
  { id: 'schedule', label: 'Schedule', icon: '📅', description: 'Research calendar' },
];

export default function ActivityBar({ activeActivity, onSelectActivity }: Props) {
  const navigate = useNavigate();
  const [hoveredId, setHoveredId] = useState<ActivityId | 'settings' | null>(null);

  const handleSelect = (id: ActivityId) => {
    onSelectActivity(id);
    trackEvent('activity_panel_opened', { panel_id: id });
  };

  return (
    <nav
      aria-label="Activity bar"
      data-testid="activity-bar"
      className="flex-shrink-0 w-12 flex flex-col items-center justify-between bg-gray-50 dark:bg-gray-900 border-r border-gray-200 dark:border-gray-700 py-2 z-30 relative"
    >
      <ul className="flex flex-col gap-1">
        {ACTIVITIES.map((a) => {
          const isActive = activeActivity === a.id;
          const showTooltip = hoveredId === a.id;
          return (
            <li key={a.id} className="relative">
              <button
                type="button"
                onClick={() => handleSelect(a.id)}
                onMouseEnter={() => setHoveredId(a.id)}
                onMouseLeave={() => setHoveredId(null)}
                aria-label={a.label}
                aria-pressed={isActive}
                className={`flex h-10 w-10 items-center justify-center rounded-lg text-lg transition-colors relative ${
                  isActive
                    ? 'bg-brand-100 text-brand-700 dark:bg-brand-900/40 dark:text-brand-300'
                    : 'text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100'
                }`}
              >
                <span aria-hidden="true">{a.icon}</span>
                {isActive && (
                  <span
                    className="absolute left-0 top-1.5 bottom-1.5 w-0.5 rounded-r bg-brand-500"
                    aria-hidden="true"
                  />
                )}
              </button>
              {showTooltip && (
                <div
                  role="tooltip"
                  className="absolute left-12 top-1/2 -translate-y-1/2 ml-2 z-50 rounded-md bg-gray-900 text-white dark:bg-gray-700 px-2 py-1 text-xs whitespace-nowrap shadow-lg pointer-events-none"
                >
                  <div className="font-medium">{a.label}</div>
                  <div className="text-[10px] text-gray-300 dark:text-gray-400">{a.description}</div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      <button
        type="button"
        onClick={() => navigate('/account')}
        onMouseEnter={() => setHoveredId('settings')}
        onMouseLeave={() => setHoveredId(null)}
        aria-label="Settings"
        className="relative flex h-10 w-10 items-center justify-center rounded-lg text-lg text-gray-500 hover:bg-gray-200 hover:text-gray-800 dark:text-gray-400 dark:hover:bg-gray-800 dark:hover:text-gray-100"
      >
        <span aria-hidden="true">⚙️</span>
        {hoveredId === 'settings' && (
          <div
            role="tooltip"
            className="absolute left-12 top-1/2 -translate-y-1/2 ml-2 z-50 rounded-md bg-gray-900 text-white dark:bg-gray-700 px-2 py-1 text-xs whitespace-nowrap shadow-lg pointer-events-none"
          >
            Settings &amp; account
          </div>
        )}
      </button>
    </nav>
  );
}
