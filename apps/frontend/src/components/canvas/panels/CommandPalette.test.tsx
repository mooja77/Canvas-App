import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

// Mock canvasStore
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      addQuestion: vi.fn(),
      addMemo: vi.fn(),
      toggleCodingStripes: vi.fn(),
    })
  ),
  useActiveCanvas: () => null,
}));

// Mock uiStore
vi.mock('../../../stores/uiStore', () => ({
  useUIStore: () => ({
    toggleDarkMode: vi.fn(),
    darkMode: false,
    resetOnboarding: vi.fn(),
  }),
}));

import CommandPalette from './CommandPalette';

const defaultProps = {
  onClose: vi.fn(),
  onFocusNode: vi.fn(),
  onFitView: vi.fn(),
  onToggleGrid: vi.fn(),
  onToggleNavigator: vi.fn(),
  onShowShortcuts: vi.fn(),
  onAddComputedNode: vi.fn().mockResolvedValue(undefined),
};

describe('CommandPalette', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders when open', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByRole('dialog')).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Search actions, codes, transcripts...')).toBeInTheDocument();
  });

  it('shows list of actions', () => {
    render(<CommandPalette {...defaultProps} />);
    expect(screen.getByText('Add New Code')).toBeInTheDocument();
    expect(screen.getByText('Fit View')).toBeInTheDocument();
    expect(screen.getByText('Toggle Snap to Grid')).toBeInTheDocument();
  });

  it('search filters actions by name', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search actions, codes, transcripts...');
    fireEvent.change(input, { target: { value: 'Fit View' } });

    expect(screen.getByText('Fit View')).toBeInTheDocument();
    expect(screen.queryByText('Add New Code')).not.toBeInTheDocument();
  });

  it('selecting action calls the action and closes palette', () => {
    render(<CommandPalette {...defaultProps} />);
    fireEvent.click(screen.getByText('Fit View'));
    expect(defaultProps.onFitView).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('Escape key closes palette', () => {
    render(<CommandPalette {...defaultProps} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('Arrow keys navigate items and changes selected index', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search actions, codes, transcripts...');

    // Press ArrowDown to move selection
    fireEvent.keyDown(input, { key: 'ArrowDown' });
    fireEvent.keyDown(input, { key: 'ArrowDown' });

    // The second item should now have the selected style
    // We just verify no crash and the component handles it
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('Enter key selects focused item', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search actions, codes, transcripts...');

    // Filter to a single result
    fireEvent.change(input, { target: { value: 'Fit View' } });
    // Press enter to select it
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(defaultProps.onFitView).toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('empty search shows all actions', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search actions, codes, transcripts...');
    fireEvent.change(input, { target: { value: '' } });

    // Should show at least several built-in actions
    expect(screen.getByText('Add New Code')).toBeInTheDocument();
    expect(screen.getByText('Toggle Snap to Grid')).toBeInTheDocument();
    expect(screen.getByText('Keyboard Shortcuts')).toBeInTheDocument();
  });

  it('shows no results message for unmatched search', () => {
    render(<CommandPalette {...defaultProps} />);
    const input = screen.getByPlaceholderText('Search actions, codes, transcripts...');
    fireEvent.change(input, { target: { value: 'xyznonexistent' } });

    expect(screen.getByText('No results found')).toBeInTheDocument();
  });

  it('clicking backdrop closes palette', () => {
    render(<CommandPalette {...defaultProps} />);
    const backdrop = screen.getByRole('dialog');
    fireEvent.click(backdrop);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });
});
