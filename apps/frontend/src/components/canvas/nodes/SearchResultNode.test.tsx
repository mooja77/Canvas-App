/* eslint-disable @typescript-eslint/no-explicit-any */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@xyflow/react', () => ({}));

const mockToastError = vi.fn();
vi.mock('react-hot-toast', () => ({
  default: { error: (...args: unknown[]) => mockToastError(...args), success: vi.fn() },
}));

vi.mock('./ComputedNodeShell', () => ({
  default: ({ children, onConfigure }: any) => (
    <div>
      <button data-testid="configure" onClick={onConfigure}>
        Configure
      </button>
      {children}
    </div>
  ),
}));

const mockUpdateComputedNode = vi.fn();
const storeState: Record<string, any> = {
  updateComputedNode: (...args: unknown[]) => mockUpdateComputedNode(...args),
  computedNodes: [{ id: 'cn1', label: 'Text Search', config: { pattern: 'care', mode: 'keyword' }, result: null }],
};
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: (selector?: (s: any) => any) => (selector ? selector(storeState) : storeState),
  useCanvasComputedNodes: () => storeState.computedNodes,
}));

import SearchResultNode from './SearchResultNode';

function renderNode() {
  const props: any = { id: 'computed-cn1', data: { computedNodeId: 'cn1' }, selected: false };
  return render(<SearchResultNode {...props} />);
}

describe('SearchResultNode config save', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('reports a failed config save instead of closing the editor', async () => {
    mockUpdateComputedNode.mockRejectedValue({ response: { data: { error: 'You have view-only access' } } });

    renderNode();
    fireEvent.click(screen.getByTestId('configure'));
    fireEvent.change(screen.getByPlaceholderText('Search pattern...'), { target: { value: 'support' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(mockToastError).toHaveBeenCalledWith('You have view-only access'));
    expect(screen.getByPlaceholderText('Search pattern...')).toBeInTheDocument();
  });

  it('closes the editor when the config saves', async () => {
    mockUpdateComputedNode.mockResolvedValue(undefined);

    renderNode();
    fireEvent.click(screen.getByTestId('configure'));
    fireEvent.change(screen.getByPlaceholderText('Search pattern...'), { target: { value: 'support' } });
    fireEvent.click(screen.getByText('Save'));

    await waitFor(() => expect(screen.queryByPlaceholderText('Search pattern...')).not.toBeInTheDocument());
    expect(mockToastError).not.toHaveBeenCalled();
  });
});

describe('SearchResultNode truncation notice', () => {
  const match = (i: number) => ({
    transcriptId: 't1',
    transcriptTitle: 'Interview 1',
    offset: i,
    matchText: 'e',
    context: 'the e here',
  });

  it('says how many matches exist when the server capped the payload', () => {
    storeState.computedNodes = [
      {
        id: 'cn1',
        label: 'Text Search',
        config: { pattern: 'e', mode: 'keyword' },
        result: { matches: Array.from({ length: 100 }, (_, i) => match(i)), totalMatches: 220000, truncated: true },
      },
    ];
    renderNode();
    expect(screen.getByText('220,000 matches, showing the first 100')).toBeInTheDocument();
  });

  it('keeps the plain count for results that predate the cap', () => {
    storeState.computedNodes = [
      {
        id: 'cn1',
        label: 'Text Search',
        config: { pattern: 'e', mode: 'keyword' },
        result: { matches: [match(0), match(1)] },
      },
    ];
    renderNode();
    expect(screen.getByText('2 matches')).toBeInTheDocument();
  });
});
