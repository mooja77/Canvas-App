import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
const { state, read, save, publish } = vi.hoisted(() => ({
  state: {
    canvas: { id: 'canvas-a', myRole: 'owner', transcripts: [{ id: 'source-a', title: 'Fictional interview' }] },
  },
  read: vi.fn(),
  save: vi.fn(),
  publish: vi.fn(),
}));
vi.mock('../../../stores/canvasStore', () => ({
  useActiveCanvas: () => state.canvas,
  useCanvasStore: { setState: publish },
}));
vi.mock('./transcriptMetadataPersistence', () => ({ readTranscriptMetadata: read, saveTranscriptMetadata: save }));
vi.mock('../../../lib/socket', () => ({ emitSocketEvent: vi.fn() }));
import TranscriptDetailsPanel from './TranscriptDetailsPanel';
import { emitSocketEvent } from '../../../lib/socket';
const row = {
  id: 'source-a',
  canvasId: 'canvas-a',
  title: 'Fictional interview',
  content: 'Original',
  eventDate: null,
  latitude: null,
  longitude: null,
  locationName: null,
};

describe('transcript metadata setup and uncertain-save recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    state.canvas = { id: 'canvas-a', myRole: 'owner', transcripts: [{ id: 'source-a', title: 'Fictional interview' }] };
    read.mockResolvedValue(row);
    save.mockResolvedValue(row);
  });
  const ready = async () => {
    render(<TranscriptDetailsPanel onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save transcript details' })).toBeEnabled());
  };
  it('loads authoritative details before enabling a save and never invents coordinates', async () => {
    await ready();
    expect(read).toHaveBeenCalledWith('canvas-a', 'source-a');
    expect(screen.getByLabelText('Latitude (optional)')).toHaveValue('');
    expect(screen.getByLabelText('Longitude (optional)')).toHaveValue('');
    expect(screen.getByText(/Enter UTC, not your computer/)).toBeInTheDocument();
    expect(save).not.toHaveBeenCalled();
  });
  it('does not submit an incomplete coordinate pair', async () => {
    await ready();
    fireEvent.change(screen.getByLabelText('Latitude (optional)'), { target: { value: '52' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save transcript details' }));
    expect(screen.getByRole('alert')).toHaveTextContent('both coordinates');
    expect(save).not.toHaveBeenCalled();
  });
  it('retains entries after uncertain failure and checking does not repeat the save', async () => {
    save.mockRejectedValue(new Error('network failed'));
    await ready();
    fireEvent.change(screen.getByLabelText('Location label (optional)'), { target: { value: 'Fictional location' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save transcript details' }));
    await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('could not confirm'));
    expect(screen.getByRole('button', { name: 'Save transcript details' })).toBeDisabled();
    expect(screen.getByLabelText('Location label (optional)')).toHaveValue('Fictional location');
    fireEvent.click(screen.getByRole('button', { name: 'Check saved details' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save transcript details' })).toBeEnabled());
    expect(save).toHaveBeenCalledTimes(1);
    expect(read).toHaveBeenCalledTimes(2);
    expect(screen.getByLabelText('Location label (optional)')).toHaveValue('Fictional location');
  });
  it('keeps viewers read-only even after a successful read', async () => {
    state.canvas.myRole = 'viewer';
    render(<TranscriptDetailsPanel onClose={vi.fn()} />);
    await screen.findByText('Last verified saved details');
    expect(screen.getByRole('button', { name: 'Save transcript details' })).toBeDisabled();
    expect(save).not.toHaveBeenCalled();
  });
  it('loads saved values when recovering an initial read failure rather than presenting clearing defaults', async () => {
    read
      .mockRejectedValueOnce(new Error('failed'))
      .mockResolvedValue({ ...row, latitude: 51.9, longitude: -8.5, locationName: 'Existing place' });
    render(<TranscriptDetailsPanel onClose={vi.fn()} />);
    await screen.findByRole('alert');
    expect(screen.getByRole('button', { name: 'Save transcript details' })).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: 'Check saved details' }));
    await waitFor(() => expect(screen.getByLabelText('Latitude (optional)')).toHaveValue('51.9'));
    expect(screen.getByLabelText('Location label (optional)')).toHaveValue('Existing place');
    expect(save).not.toHaveBeenCalled();
  });
  it('confirms a legitimate zero coordinate pair and broadcasts only the confirmed write', async () => {
    save.mockResolvedValue({ ...row, latitude: 0, longitude: 0 });
    await ready();
    fireEvent.change(screen.getByLabelText('Latitude (optional)'), { target: { value: '0' } });
    fireEvent.change(screen.getByLabelText('Longitude (optional)'), { target: { value: '0' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save transcript details' }));
    await screen.findByText(/Details saved and checked/);
    expect(save).toHaveBeenCalledWith('canvas-a', 'source-a', {
      eventDate: null,
      latitude: 0,
      longitude: 0,
      locationName: null,
    });
    expect(emitSocketEvent).toHaveBeenCalledTimes(1);
  });
  it('ignores a save resolving after the editor was closed', async () => {
    let resolve!: (value: typeof row) => void;
    save.mockReturnValue(
      new Promise((done) => {
        resolve = done;
      }),
    );
    const view = render(<TranscriptDetailsPanel onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Save transcript details' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Save transcript details' }));
    view.unmount();
    resolve(row);
    await Promise.resolve();
    expect(publish).not.toHaveBeenCalled();
    expect(emitSocketEvent).not.toHaveBeenCalled();
  });
});
