import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// CanvasListPanel pulls from the canvas store + a few hooks/services. Mock the
// surface it touches so we can render it in isolation and assert the Trash
// disclosure exposes its expanded state to assistive tech.
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (k: string) => k }) }));

const canvasState = {
  canvases: [] as unknown[],
  fetchCanvases: vi.fn(),
  createCanvas: vi.fn(),
  deleteCanvas: vi.fn(),
  fetchTrash: vi.fn(),
  restoreCanvas: vi.fn(),
  permanentDeleteCanvas: vi.fn(),
};
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (s: typeof canvasState) => unknown) => selector(canvasState),
  useCanvasLoading: () => false,
  useTrashedCanvases: () => [],
  useTrashLoading: () => false,
}));
vi.mock('../../../hooks/useOpenCanvas', () => ({ useOpenCanvas: () => vi.fn() }));
vi.mock('../../../services/api', () => ({ canvasApi: { addQuestion: vi.fn(), cloneCanvas: vi.fn() } }));
vi.mock('../ConfirmDialog', () => ({ default: () => null }));
vi.mock('./CanvasThumbnail', () => ({ default: () => null }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

import CanvasListPanel from './CanvasListPanel';

describe('CanvasListPanel — Trash disclosure a11y', () => {
  beforeEach(() => {
    canvasState.fetchTrash.mockClear();
  });

  it('exposes the Trash disclosure state via aria-expanded (collapsed by default)', () => {
    render(<CanvasListPanel />);
    const trashBtn = screen.getByRole('button', { name: /trash/i });
    expect(trashBtn).toHaveAttribute('aria-expanded', 'false');
  });

  it('flips aria-expanded to true when the Trash section is opened', () => {
    render(<CanvasListPanel />);
    const trashBtn = screen.getByRole('button', { name: /trash/i });
    fireEvent.click(trashBtn);
    expect(trashBtn).toHaveAttribute('aria-expanded', 'true');
  });
});
