import { beforeEach, describe, expect, it, vi } from 'vitest';
const { update, getCanvas } = vi.hoisted(() => ({ update: vi.fn(), getCanvas: vi.fn() }));
vi.mock('../../../services/api', () => ({ canvasApi: { updateTranscript: update, getCanvas } }));
import { readTranscriptMetadata, saveTranscriptMetadata } from './transcriptMetadataPersistence';

const input = { eventDate: '2026-10-07T12:30:00Z', latitude: 0, longitude: 0, locationName: 'Fictional location' };
const row = { id: 'source-a', canvasId: 'canvas-a', title: 'Fictional interview', content: 'Original', ...input };
const saved = () => ({ data: { success: true, data: { ...row, eventDate: '2026-10-07T12:30:00.000Z' } } });
const read = () => ({ data: { success: true, data: { id: 'canvas-a', transcripts: [row] } } });

describe('metadata acknowledgement and durable read confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    update.mockResolvedValue(saved());
    getCanvas.mockResolvedValue(read());
  });
  it('accepts canonical ISO formatting only after an authoritative read confirms the metadata', async () => {
    expect(await saveTranscriptMetadata('canvas-a', 'source-a', input)).toMatchObject(row);
    expect(update).toHaveBeenCalledTimes(1);
    expect(getCanvas).toHaveBeenCalledTimes(1);
  });
  it('rejects a negative acknowledgement without interpreting an invented row as saved', async () => {
    update.mockResolvedValue({ data: { success: false, data: row } });
    await expect(saveTranscriptMetadata('canvas-a', 'source-a', input)).rejects.toThrow();
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('rejects an acknowledgement belonging to a different canvas', async () => {
    update.mockResolvedValue({ data: { success: true, data: { ...row, canvasId: 'other' } } });
    await expect(saveTranscriptMetadata('canvas-a', 'source-a', input)).rejects.toThrow();
  });
  it('does not claim success if the follow-up read still has old metadata', async () => {
    getCanvas.mockResolvedValue({
      data: { success: true, data: { id: 'canvas-a', transcripts: [{ ...row, latitude: 52 }] } },
    });
    await expect(saveTranscriptMetadata('canvas-a', 'source-a', input)).rejects.toThrow();
    expect(update).toHaveBeenCalledTimes(1);
  });
  it('provides a read-only recovery that never repeats a write', async () => {
    expect(await readTranscriptMetadata('canvas-a', 'source-a')).toMatchObject(row);
    expect(update).not.toHaveBeenCalled();
  });
  it.each([
    null,
    { success: false, data: { id: 'canvas-a', transcripts: [row] } },
    { success: true, data: { id: 'other', transcripts: [row] } },
  ])('rejects unverifiable read data %j', async (body) => {
    getCanvas.mockResolvedValue({ data: body });
    await expect(readTranscriptMetadata('canvas-a', 'source-a')).rejects.toThrow();
    expect(update).not.toHaveBeenCalled();
  });
});
