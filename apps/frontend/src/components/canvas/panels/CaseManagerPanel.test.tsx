import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import CaseManagerPanel from './CaseManagerPanel';

const addCase = vi.fn();

vi.mock('../../../stores/canvasStore', () => ({
  useActiveCanvas: () => ({ cases: [], transcripts: [] }),
  useCanvasStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({
      addCase,
      updateCase: vi.fn(),
      deleteCase: vi.fn(),
      updateTranscript: vi.fn(),
    }),
}));
vi.mock('../../../hooks/useFocusTrap', () => ({ useFocusTrap: vi.fn() }));
vi.mock('../../../hooks/useEscapeToClose', () => ({ useEscapeToClose: vi.fn() }));
vi.mock('react-hot-toast', () => ({ default: { success: vi.fn(), error: vi.fn() } }));

describe('CaseManagerPanel first-use help', () => {
  it('explains cases and focuses the real creation field', () => {
    render(<CaseManagerPanel onClose={vi.fn()} />);

    expect(screen.getByText('No cases yet')).toBeVisible();
    expect(screen.getByText(/compare people or groups across your transcripts/)).toBeVisible();
    fireEvent.click(screen.getByRole('button', { name: 'Create your first case' }));
    expect(screen.getByRole('textbox', { name: 'Case name' })).toHaveFocus();
  });

  it('fills but never saves a clearly fictional example', () => {
    addCase.mockClear();
    render(<CaseManagerPanel onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Fill a fictional example (not saved)' }));
    expect(screen.getByRole('textbox', { name: 'Case name' })).toHaveValue('Participant A');
    expect(screen.getByRole('textbox', { name: 'Attributes (optional)' })).toHaveValue('role: Interview participant');
    expect(addCase).not.toHaveBeenCalled();
  });
});
