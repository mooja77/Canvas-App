import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const canvas = vi.hoisted(() => ({
  active: {
    id: 'canvas-1',
    name: 'Interview project',
    transcripts: [] as Array<{ id: string; title: string; content: string }>,
    questions: [],
    codings: [],
    memos: [],
    cases: [],
  },
}));

vi.mock('../../../stores/canvasStore', () => ({ useActiveCanvas: () => canvas.active }));

import ProjectDashboard from './ProjectDashboard';

describe('ProjectDashboard teaching empty states', () => {
  afterEach(() => {
    canvas.active.transcripts.length = 0;
    vi.restoreAllMocks();
  });

  it('explains empty code and transcript charts and opens the transcript picker', () => {
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    render(<ProjectDashboard onClose={vi.fn()} />);

    expect(screen.getByText(/Code a passage to see which themes/)).toBeVisible();
    expect(screen.getByText(/Add an interview or document/)).toBeVisible();
    expect(screen.getByRole('link', { name: 'See a coding example' })).toHaveAttribute('href', '/help/first-code.html');
    fireEvent.click(screen.getAllByRole('button', { name: 'Add a transcript' })[0]);
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'qualcanvas:open-transcript-picker' }));
  });

  it('focuses an existing transcript when codes are absent', () => {
    canvas.active.transcripts.push({ id: 'transcript-1', title: 'Interview 1', content: 'A passage' });
    const dispatch = vi.spyOn(window, 'dispatchEvent');
    render(<ProjectDashboard onClose={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Open a transcript to code' }));
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'qualcanvas:focus-node', detail: { nodeId: 'transcript-transcript-1' } }),
    );
  });
});
