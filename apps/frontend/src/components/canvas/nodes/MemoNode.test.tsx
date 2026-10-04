/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@xyflow/react', () => ({
  NodeResizer: () => null,
  NodeToolbar: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Position: { Bottom: 'bottom' },
  useReactFlow: () => ({ setNodes: vi.fn(), getNode: vi.fn(() => undefined) }),
}));

const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { error: (...args: unknown[]) => mockToastError(...args), success: vi.fn() },
}));

vi.mock('../CrossCanvasRefBadge', () => ({ default: () => null }));
vi.mock('../ConfirmDialog', () => ({ default: () => null }));

const mockUpdateMemo = vi.fn();
const storeState: Record<string, any> = {
  updateMemo: (...args: unknown[]) => mockUpdateMemo(...args),
  deleteMemo: vi.fn(),
};
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (selector?: (s: any) => any) => (selector ? selector(storeState) : storeState),
}));

let zoomTier = 'full';
vi.mock('../../../stores/uiStore', () => ({ useUIStore: (selector: (s: any) => any) => selector({ zoomTier }) }));

import MemoNode from './MemoNode';

function renderNode() {
  const props: any = {
    id: 'memo-m1',
    data: { memoId: 'm1', title: 'Field note', content: 'Original body', color: '#fef3c7' },
    selected: false,
  };
  return render(<MemoNode {...props} />);
}

describe('MemoNode inline edit', () => {
  it('focuses the delete opener even when a pointer click does not focus buttons', () => {
    renderNode();
    const opener = screen.getByRole('button', { name: 'Delete memo' });
    expect(opener).not.toHaveFocus();
    fireEvent.click(opener);
    expect(opener).toHaveFocus();
    expect(storeState.deleteMemo).not.toHaveBeenCalled();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    zoomTier = 'full';
  });

  it('keeps memo content readable without microscopic actions in overview', () => {
    zoomTier = 'minimal';
    renderNode();
    expect(screen.getByText('Original body')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Collapse' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete memo' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
  });

  it('renders the memo title with an opaque readable foreground', () => {
    renderNode();
    expect(screen.getByText('Field note')).toHaveClass('text-gray-700');
    expect(screen.getByText('Field note')).not.toHaveClass('text-gray-600/70');
  });

  it('tells the user when the memo could not be saved and keeps the editor open', async () => {
    mockUpdateMemo.mockRejectedValue({ response: { data: { error: 'You have view-only access' } } });

    renderNode();
    fireEvent.click(screen.getByText('Edit'));
    const textarea = screen.getByPlaceholderText(/Write your memo/) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: 'Revised body' } });
    fireEvent.click(screen.getByText('Done'));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('You have view-only access'));
    const stillOpen = screen.getByPlaceholderText(/Write your memo/) as HTMLTextAreaElement;
    expect(stillOpen.value).toBe('Revised body');
  });

  it('closes the editor and stays quiet when the memo saves', async () => {
    mockUpdateMemo.mockResolvedValue(undefined);

    renderNode();
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByPlaceholderText(/Write your memo/), { target: { value: 'Revised body' } });
    fireEvent.click(screen.getByText('Done'));

    await waitFor(() => expect(screen.queryByPlaceholderText(/Write your memo/)).not.toBeInTheDocument());
    expect(mockUpdateMemo).toHaveBeenCalledWith('m1', { content: 'Revised body' });
    expect(mockToastError).not.toHaveBeenCalled();
  });

  it('opens a labelled screen-size editor outside the canvas node', () => {
    renderNode();
    fireEvent.click(screen.getByText('Edit'));
    const dialog = screen.getByRole('dialog', { name: 'Edit memo' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog.closest('.react-flow__node')).toBeNull();
    expect(screen.getByLabelText('Memo title (optional)')).toHaveFocus();
    expect(screen.getByLabelText('Memo text')).toBeVisible();
  });

  it('sends an explicit blank title when the optional title is cleared', async () => {
    mockUpdateMemo.mockResolvedValue(undefined);
    renderNode();
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Memo title (optional)'), { target: { value: '   ' } });
    fireEvent.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(mockUpdateMemo).toHaveBeenCalledWith('m1', { title: '' }));
    expect(JSON.parse(JSON.stringify(mockUpdateMemo.mock.calls[0][1]))).toEqual({ title: '' });
  });

  it('does not save on focus changes and cancels without writing', () => {
    renderNode();
    fireEvent.click(screen.getByText('Edit'));
    const body = screen.getByPlaceholderText(/Write your memo/);
    fireEvent.change(body, { target: { value: 'Unsaved draft' } });
    fireEvent.blur(body);
    expect(mockUpdateMemo).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mockUpdateMemo).not.toHaveBeenCalled();
  });

  it('lets keyboard users apply formatting before an explicit save', async () => {
    mockUpdateMemo.mockResolvedValue(undefined);
    renderNode();
    fireEvent.click(screen.getByText('Edit'));
    const body = screen.getByLabelText('Memo text') as HTMLTextAreaElement;
    body.setSelectionRange(0, 8);
    fireEvent.click(screen.getByRole('button', { name: 'Bold' }));
    expect(body.value).toBe('**Original** body');
    expect(mockUpdateMemo).not.toHaveBeenCalled();
    fireEvent.keyDown(body, { key: 'Enter', ctrlKey: true });
    await waitFor(() => expect(mockUpdateMemo).toHaveBeenCalledWith('m1', { content: '**Original** body' }));
  });

  it('keeps focus in the dialog and prevents duplicate saves while saving', async () => {
    let resolveSave!: () => void;
    mockUpdateMemo.mockReturnValue(
      new Promise<void>((resolve) => {
        resolveSave = resolve;
      }),
    );
    renderNode();
    fireEvent.click(screen.getByText('Edit'));
    fireEvent.change(screen.getByLabelText('Memo text'), { target: { value: 'Pending draft' } });
    const done = screen.getByRole('button', { name: 'Done' });
    done.focus();
    fireEvent.click(done);
    const dialog = screen.getByRole('dialog', { name: 'Edit memo' });
    expect(dialog).toHaveAttribute('aria-busy', 'true');
    expect(dialog).toHaveFocus();
    fireEvent.keyDown(dialog, { key: 'Enter', ctrlKey: true });
    fireEvent.keyDown(dialog, { key: 'Escape' });
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
    expect(mockUpdateMemo).toHaveBeenCalledTimes(1);
    resolveSave();
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
  });
});
