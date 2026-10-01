import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { NodeProps } from '@xyflow/react';

const mocks = vi.hoisted(() => ({
  zoomTier: 'full',
  toggle: vi.fn(),
  state: { activeCanvas: { myRole: 'owner', codings: [] }, deleteTranscript: vi.fn() },
}));
vi.mock('@xyflow/react', () => ({ Handle: () => null, Position: {}, NodeResizer: () => null }));
vi.mock('./useNodeCollapsed', () => ({
  useNodeCollapsed: () => ({ collapsed: false, toggleCollapsed: mocks.toggle }),
}));
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (s: typeof mocks.state) => unknown) => selector(mocks.state),
  useCanvasQuestions: () => [],
  useCanvasTranscripts: () => [],
  useCanvasCases: () => [],
  usePendingSelection: () => null,
  useShowCodingStripes: () => false,
}));
vi.mock('../../../stores/uiStore', () => ({
  useUIStore: (selector: (s: { zoomTier: string; verifyHighlight: null }) => unknown) =>
    selector({ zoomTier: mocks.zoomTier, verifyHighlight: null }),
}));
vi.mock('../CrossCanvasRefBadge', () => ({ default: () => null }));
vi.mock('../CodingDensityBar', () => ({ default: () => null }));
vi.mock('../panels/CodingStripesOverlay', () => ({ default: () => null }));
vi.mock('../panels/QuickCodePopover', () => ({ default: () => null }));
vi.mock('../panels/CodingSegmentPopover', () => ({ default: () => null }));
vi.mock('../TranscriptContextMenu', () => ({ default: () => null }));
vi.mock('../ConfirmDialog', () => ({ default: () => null }));

import TranscriptNode from './TranscriptNode';

const props = { id: 'transcript-t1', data: { transcriptId: 't1', title: 'Interview' } } as unknown as NodeProps;
beforeEach(() => {
  mocks.zoomTier = 'full';
  vi.clearAllMocks();
});

describe('transcript controls at overview zoom', () => {
  it('does not offer microscopic destructive controls in the minimal overview', () => {
    mocks.zoomTier = 'minimal';
    render(<TranscriptNode {...props} />);
    expect(screen.queryByRole('button', { name: 'Delete transcript' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Collapse' })).toBeNull();
    expect(screen.getByTitle(/Zoom in or choose a transcript/)).toBeVisible();
  });

  it('keeps collapse and delete available at editing zoom with larger hit areas', () => {
    render(<TranscriptNode {...props} />);
    const collapse = screen.getByRole('button', { name: 'Collapse' });
    expect(collapse.className).toContain('h-8');
    expect(screen.getByRole('button', { name: 'Delete transcript' }).className).toContain('w-8');
    fireEvent.click(collapse);
    expect(mocks.toggle).toHaveBeenCalledOnce();
  });
});
