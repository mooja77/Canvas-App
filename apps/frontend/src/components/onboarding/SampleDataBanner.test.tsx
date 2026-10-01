import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SampleDataBanner from './SampleDataBanner';

const mocks = vi.hoisted(() => ({
  activeCanvas: null as null | {
    id: string;
    transcripts: { id: string; sourceType?: string | null }[];
    codings: { id: string; transcriptId: string; source?: string }[];
  },
  refreshCanvas: vi.fn().mockResolvedValue(undefined),
  removeSampleData: vi.fn().mockResolvedValue({ data: { success: true, data: { removed: {} } } }),
}));

vi.mock('../../stores/canvasStore', () => ({
  useCanvasStore: (selector: (state: Record<string, unknown>) => unknown) =>
    selector({ activeCanvas: mocks.activeCanvas, refreshCanvas: mocks.refreshCanvas }),
}));
vi.mock('../../services/api', () => ({ canvasApi: { removeSampleData: mocks.removeSampleData } }));
vi.mock('react-hot-toast', () => ({ default: Object.assign(vi.fn(), { success: vi.fn(), error: vi.fn() }) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.activeCanvas = {
    id: 'canvas-1',
    transcripts: [
      { id: 's1', sourceType: 'sample' },
      { id: 's2', sourceType: 'sample' },
      { id: 'own', sourceType: null },
    ],
    codings: [
      { id: 'c1', transcriptId: 's1', source: 'sample' },
      { id: 'c2', transcriptId: 's2', source: 'sample' },
      { id: 'c3', transcriptId: 'own', source: 'human' },
    ],
  };
});

describe('SampleDataBanner', () => {
  it('labels the seeded study and removes it in one click', async () => {
    render(<SampleDataBanner />);
    expect(screen.getByText(/2 sample transcripts, 2 coded excerpts/)).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Remove sample data' }));
    await waitFor(() => expect(mocks.refreshCanvas).toHaveBeenCalledOnce());
    expect(mocks.removeSampleData).toHaveBeenCalledWith('canvas-1');
  });

  it('asks first only when the researcher coded the sample text themselves', async () => {
    mocks.activeCanvas!.codings.push({ id: 'c4', transcriptId: 's1', source: 'human' });
    render(<SampleDataBanner />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove sample data' }));
    expect(mocks.removeSampleData).not.toHaveBeenCalled();
    expect(screen.getByText(/You coded 1 excerpt in the sample transcripts/)).toBeTruthy();
  });

  it('is absent once a project has no sample material', () => {
    mocks.activeCanvas!.transcripts = [{ id: 'own', sourceType: null }];
    const { container } = render(<SampleDataBanner />);
    expect(container.textContent).toBe('');
  });
});
