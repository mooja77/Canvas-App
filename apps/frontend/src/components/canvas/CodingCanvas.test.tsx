import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';

// Mock react-router-dom
const mockUseParams = vi.fn<() => Record<string, string | undefined>>(() => ({}));
vi.mock('react-router-dom', () => ({
  useParams: () => mockUseParams(),
}));

// Mock canvasStore
const mockOpenCanvas = vi.fn(() => Promise.resolve());
const mockCloseCanvas = vi.fn();
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockCanvasStoreState: Record<string, any> = {
  activeCanvasId: null,
  openCanvas: mockOpenCanvas,
  closeCanvas: mockCloseCanvas,
};
vi.mock('../../stores/canvasStore', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  useCanvasStore: (selector?: (state: any) => any) => {
    if (typeof selector === 'function') return selector(mockCanvasStoreState);
    return mockCanvasStoreState;
  },
  useActiveCanvasId: () => mockCanvasStoreState.activeCanvasId,
}));

// Mock child components to avoid rendering their complex trees
vi.mock('./panels/CanvasListPanel', () => ({
  default: () => <div data-testid="canvas-list-panel">CanvasListPanel</div>,
}));
vi.mock('./CanvasWorkspace', () => ({
  default: () => <div data-testid="canvas-workspace">CanvasWorkspace</div>,
}));

import CodingCanvas from './CodingCanvas';

describe('CodingCanvas', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvasStoreState.activeCanvasId = null;
    mockCanvasStoreState.openCanvas = mockOpenCanvas;
    mockCanvasStoreState.closeCanvas = mockCloseCanvas;
    mockUseParams.mockReturnValue({});
  });

  it('renders CanvasListPanel when no activeCanvasId', () => {
    render(<CodingCanvas />);
    expect(screen.getByTestId('canvas-list-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('canvas-workspace')).not.toBeInTheDocument();
  });

  it('renders CanvasWorkspace when activeCanvasId is set and URL matches', () => {
    mockCanvasStoreState.activeCanvasId = 'canvas-123';
    mockUseParams.mockReturnValue({ canvasId: 'canvas-123' });
    render(<CodingCanvas />);
    expect(screen.getByTestId('canvas-workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('canvas-list-panel')).not.toBeInTheDocument();
  });

  it('opens URL canvas when no active canvas', () => {
    mockUseParams.mockReturnValue({ canvasId: 'url-canvas-456' });
    render(<CodingCanvas />);
    expect(mockOpenCanvas).toHaveBeenCalledWith('url-canvas-456');
  });

  it('opens URL canvas when a different canvas is already active (route is source of truth)', () => {
    mockCanvasStoreState.activeCanvasId = 'canvas-123';
    mockUseParams.mockReturnValue({ canvasId: 'url-canvas-456' });
    render(<CodingCanvas />);
    expect(mockOpenCanvas).toHaveBeenCalledWith('url-canvas-456');
  });

  it('does not re-open when URL canvasId matches active canvas', () => {
    mockCanvasStoreState.activeCanvasId = 'canvas-123';
    mockUseParams.mockReturnValue({ canvasId: 'canvas-123' });
    render(<CodingCanvas />);
    expect(mockOpenCanvas).not.toHaveBeenCalled();
  });

  it('closes canvas when URL has no canvasId but a canvas is active', () => {
    mockCanvasStoreState.activeCanvasId = 'canvas-123';
    mockUseParams.mockReturnValue({});
    render(<CodingCanvas />);
    expect(mockCloseCanvas).toHaveBeenCalled();
  });

  it('does nothing when no URL canvasId and no active canvas', () => {
    mockUseParams.mockReturnValue({});
    render(<CodingCanvas />);
    expect(mockOpenCanvas).not.toHaveBeenCalled();
    expect(mockCloseCanvas).not.toHaveBeenCalled();
  });
});
