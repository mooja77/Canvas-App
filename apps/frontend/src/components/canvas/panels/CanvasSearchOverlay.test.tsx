import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import CanvasSearchOverlay from './CanvasSearchOverlay';

const mockState = vi.hoisted(() => ({
  activeCanvas: {
    transcripts: [{ id: 't1', title: 'Interview Alpha', content: 'A participant mentions access barriers.' }],
    questions: [{ id: 'q1', text: 'Access Barriers', color: '#123456' }],
    memos: [{ id: 'm1', title: 'Memo Alpha', content: 'Memo content' }],
    codings: [],
  },
}));

vi.mock('../../../stores/canvasStore', () => ({
  useActiveCanvas: () => mockState.activeCanvas,
}));

describe('CanvasSearchOverlay', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('focuses a matching node when a search result is clicked', async () => {
    const onClose = vi.fn();
    const onResults = vi.fn();
    const onFocusNode = vi.fn();

    render(<CanvasSearchOverlay onClose={onClose} onResults={onResults} onFocusNode={onFocusNode} />);

    fireEvent.change(screen.getByPlaceholderText('Search nodes, text, codings...'), {
      target: { value: 'Interview' },
    });

    await waitFor(() => expect(onResults).toHaveBeenCalledWith(new Set(['transcript-t1'])));
    fireEvent.click(screen.getByRole('button', { name: /Interview Alpha/i }));

    expect(onFocusNode).toHaveBeenCalledWith('transcript-t1');
    expect(onClose).toHaveBeenCalled();
  });
});
