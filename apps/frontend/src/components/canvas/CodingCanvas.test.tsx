import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { type Mock } from 'vitest';

// Mock react-router-dom
const mockUseParams = vi.fn<() => Record<string, string | undefined>>(() => ({}));
vi.mock('react-router-dom', () => ({
  useParams: () => mockUseParams(),
}));

// Mock canvasStore
const mockOpenCanvas = vi.fn(() => Promise.resolve());
const mockCanvasStoreState: Record<string, any> = {
  activeCanvasId: null,
  openCanvas: mockOpenCanvas,
};
vi.mock('../../stores/canvasStore', () => ({
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
    mockUseParams.mockReturnValue({});
  });

  it('renders CanvasListPanel when no activeCanvasId', () => {
    render(<CodingCanvas />);
    expect(screen.getByTestId('canvas-list-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('canvas-workspace')).not.toBeInTheDocument();
  });

  it('renders CanvasWorkspace when activeCanvasId is set', () => {
    mockCanvasStoreState.activeCanvasId = 'canvas-123';
    render(<CodingCanvas />);
    expect(screen.getByTestId('canvas-workspace')).toBeInTheDocument();
    expect(screen.queryByTestId('canvas-list-panel')).not.toBeInTheDocument();
  });

  it('calls openCanvas when URL has canvasId param and no active canvas', () => {
    mockUseParams.mockReturnValue({ canvasId: 'url-canvas-456' });
    render(<CodingCanvas />);
    expect(mockOpenCanvas).toHaveBeenCalledWith('url-canvas-456');
  });

  it('does not call openCanvas when activeCanvasId is already set', () => {
    mockCanvasStoreState.activeCanvasId = 'canvas-123';
    mockUseParams.mockReturnValue({ canvasId: 'url-canvas-456' });
    render(<CodingCanvas />);
    expect(mockOpenCanvas).not.toHaveBeenCalled();
  });

  it('does not call openCanvas when no URL canvasId param', () => {
    mockUseParams.mockReturnValue({});
    render(<CodingCanvas />);
    expect(mockOpenCanvas).not.toHaveBeenCalled();
  });
});
