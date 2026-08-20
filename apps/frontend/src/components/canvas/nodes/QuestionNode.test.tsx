/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@xyflow/react', () => ({
  Handle: () => null,
  NodeResizer: () => null,
  Position: { Top: 'top', Bottom: 'bottom', Left: 'left', Right: 'right' },
  useReactFlow: () => ({ setNodes: vi.fn(), getNode: vi.fn(() => undefined) }),
}));

const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { error: (...args: unknown[]) => mockToastError(...args), success: vi.fn() },
}));

vi.mock('../CrossCanvasRefBadge', () => ({ default: () => null }));
vi.mock('../panels/ColorPicker', () => ({
  default: ({ onChange }: { onChange: (c: string) => void }) => (
    <button data-testid="pick-color" onClick={() => onChange('#00ff00')}>
      pick
    </button>
  ),
}));
vi.mock('../ConfirmDialog', () => ({ default: () => null }));

const mockUpdateQuestion = vi.fn();
const storeState: Record<string, any> = {
  deleteQuestion: vi.fn(),
  updateQuestion: (...args: unknown[]) => mockUpdateQuestion(...args),
  setSelectedQuestionId: vi.fn(),
};
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (selector?: (s: any) => any) => (selector ? selector(storeState) : storeState),
  useCanvasCodings: () => [],
  useCanvasQuestions: () => [{ id: 'q1', text: 'Original name', color: '#ff0000' }],
  useSelectedQuestionId: () => null,
}));

vi.mock('../../../stores/uiStore', () => ({
  useUIStore: (selector?: (s: any) => any) => (selector ? selector({ zoomTier: 'full' }) : { zoomTier: 'full' }),
}));

import QuestionNode from './QuestionNode';

function renderNode() {
  const props: any = {
    id: 'question-q1',
    data: { questionId: 'q1', text: 'Original name', color: '#ff0000' },
    selected: false,
  };
  return render(<QuestionNode {...props} />);
}

describe('QuestionNode inline rename', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('tells the user when the rename could not be saved and keeps the editor open', async () => {
    mockUpdateQuestion.mockRejectedValue({ response: { data: { error: 'You have view-only access' } } });

    renderNode();
    fireEvent.doubleClick(screen.getByText('Original name'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'New name' } });
    fireEvent.blur(textarea);

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('You have view-only access'));
    // The editor must not close on a failed save - closing throws away the
    // user's text and makes the revert look like the app forgot it.
    expect(screen.getByRole('textbox')).toBeInTheDocument();
    expect((screen.getByRole('textbox') as HTMLTextAreaElement).value).toBe('New name');
  });

  it('closes the editor and stays quiet when the rename succeeds', async () => {
    mockUpdateQuestion.mockResolvedValue(undefined);

    renderNode();
    fireEvent.doubleClick(screen.getByText('Original name'));
    const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'New name' } });
    fireEvent.blur(textarea);

    await waitFor(() => expect(screen.queryByRole('textbox')).not.toBeInTheDocument());
    expect(mockUpdateQuestion).toHaveBeenCalledWith('q1', { text: 'New name' });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('reports a failed colour change instead of silently reverting', async () => {
    mockUpdateQuestion.mockRejectedValue(new Error('network'));

    renderNode();
    fireEvent.click(screen.getByLabelText('Change code color'));
    fireEvent.click(screen.getByTestId('pick-color'));

    await waitFor(() => expect(mockToastError).toHaveBeenCalled());
  });
});
