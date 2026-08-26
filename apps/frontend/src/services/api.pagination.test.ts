import { afterEach, describe, expect, it, vi } from 'vitest';
import { canvasClient, canvasApi, getAllCanvases } from './api';

describe('canvas API pagination', () => {
  afterEach(() => vi.restoreAllMocks());

  it('loads every canvas-list page', async () => {
    const first = Array.from({ length: 200 }, (_, index) => ({ id: `c${index}` }));
    const get = vi
      .spyOn(canvasClient, 'get')
      .mockResolvedValueOnce({ data: { data: first, total: 201 } } as never)
      .mockResolvedValueOnce({ data: { data: [{ id: 'c200' }], total: 201 } } as never);

    const canvases = await getAllCanvases();

    expect(canvases).toHaveLength(201);
    expect(get).toHaveBeenNthCalledWith(2, '/canvas', { params: { limit: 200, offset: 200 } });
  });

  it('assembles bounded detail pages before returning a canvas', async () => {
    const emptyCollections = {
      questions: [],
      memos: [],
      codings: [],
      nodePositions: [],
      cases: [],
      relations: [],
      computedNodes: [],
    };
    vi.spyOn(canvasClient, 'get')
      .mockResolvedValueOnce({
        data: {
          data: {
            id: 'canvas-large',
            transcripts: Array.from({ length: 500 }, (_, index) => ({ id: `t${index}` })),
            ...emptyCollections,
          },
          detailPagination: { hasMore: { transcripts: true } },
        },
      } as never)
      .mockResolvedValueOnce({
        data: {
          data: { id: 'canvas-large', transcripts: [{ id: 't500' }], ...emptyCollections },
          detailPagination: { hasMore: { transcripts: false } },
        },
      } as never);

    const response = await canvasApi.getCanvas('canvas-large');

    expect(response.data.data.transcripts).toHaveLength(501);
  });
});
