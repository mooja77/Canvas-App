import { useCanvasStore } from '../../../stores/canvasStore';
import { useAuthStore } from '../../../stores/authStore';
import { trackEvent } from '../../../utils/analytics';

/**
 * Sprint G — Quality panel. Single hub for the institutional / academic
 * features that previously lived buried in the Tools dropdown: intercoder
 * reliability scores, code weighting, ethics + consent, audit trail. Each
 * row dispatches the same window event the Cmd+K palette uses
 * (qualcanvas:open-canvas-modal), so the existing CanvasToolbar event
 * listener already knows how to open them. No new prop drilling required.
 */
export default function QualityPanel() {
  const activeCanvasId = useCanvasStore((s) => s.activeCanvasId);
  const plan = useAuthStore((s) => s.plan);
  const effectivePlan = useAuthStore((s) => s.effectivePlan);
  const isProOrTeam = ['pro', 'team'].includes(effectivePlan ?? plan ?? 'free');

  const openModal = (modal: string) => {
    window.dispatchEvent(new CustomEvent('qualcanvas:open-canvas-modal', { detail: { modal } }));
  };

  if (!activeCanvasId) {
    return (
      <p className="px-3 py-3 text-[11px] text-gray-400 dark:text-gray-500">
        Open a canvas to see its quality + compliance tools.
      </p>
    );
  }

  return (
    <div className="py-2 px-1 space-y-3">
      <Section title="Intercoder reliability">
        <Row
          label="Compute Cohen κ (2 coders)"
          onClick={() => openModal('intercoder')}
          proGated
          isProOrTeam={isProOrTeam}
        />
        <Row
          label="Compute Krippendorff α / Fleiss κ"
          onClick={() => openModal('intercoder-panel')}
          proGated
          isProOrTeam={isProOrTeam}
        />
      </Section>

      <Section title="Code weighting">
        <Row label="View code weights" onClick={() => openModal('weighting')} />
      </Section>

      <Section title="Ethics &amp; consent">
        <Row
          label="Open ethics &amp; consent panel"
          onClick={() => openModal('ethics')}
          proGated
          isProOrTeam={isProOrTeam}
        />
      </Section>

      <Section title="Audit trail">
        <Row
          label="View canvas audit trail"
          onClick={() => {
            trackEvent('audit_trail_viewed', { canvas_id: activeCanvasId });
            window.open(`/api/v1/canvas/${activeCanvasId}/audit?limit=200`, '_blank');
          }}
        />
        <p className="px-2 pt-1 text-[10px] text-gray-400 dark:text-gray-500">
          Returns up to 200 recent events as JSON.
        </p>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="px-3 pb-1 text-[10px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400">
        {title}
      </h3>
      <ul>{children}</ul>
    </div>
  );
}

function Row({
  label,
  onClick,
  proGated,
  isProOrTeam,
}: {
  label: string;
  onClick: () => void;
  proGated?: boolean;
  isProOrTeam?: boolean;
}) {
  const locked = proGated && !isProOrTeam;
  return (
    <li>
      <button
        type="button"
        onClick={onClick}
        disabled={locked}
        className={`w-full flex items-center justify-between rounded-md px-2 py-1.5 text-left transition-colors ${
          locked
            ? 'text-gray-400 dark:text-gray-600 cursor-not-allowed'
            : 'text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800'
        }`}
      >
        <span className="text-xs">{label}</span>
        {locked && (
          <span className="text-[9px] uppercase tracking-wider bg-gray-100 dark:bg-gray-800 text-gray-500 px-1 rounded">
            Pro
          </span>
        )}
      </button>
    </li>
  );
}
