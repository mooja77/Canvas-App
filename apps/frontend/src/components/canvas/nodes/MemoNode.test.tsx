/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@xyflow/react', () => ({
  NodeResizer: () => null,
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
  beforeEach(() => {
    vi.clearAllMocks();
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
});
