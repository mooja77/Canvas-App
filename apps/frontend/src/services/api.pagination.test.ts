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

  // ─── Bug hunt 2026-09-02: M1 / M2 (offset paging duplicates) + M3 (layout timeout) ───

  it('M1: drops a detail row repeated across pages after a concurrent delete', async () => {
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
          // A row deleted before page 1 shifted t499 into the second page.
          data: { id: 'canvas-large', transcripts: [{ id: 't499' }, { id: 't500' }], ...emptyCollections },
          detailPagination: { hasMore: { transcripts: false } },
        },
      } as never);

    const response = await canvasApi.getCanvas('canvas-large');

    const ids = response.data.data.transcripts.map((t: { id: string }) => t.id);
    expect(ids).toHaveLength(501);
    expect(new Set(ids).size).toBe(501);
  });

  it('M2: drops a canvas repeated across list pages after a concurrent update', async () => {
    const first = Array.from({ length: 200 }, (_, index) => ({ id: `c${index}` }));
    vi.spyOn(canvasClient, 'get')
      .mockResolvedValueOnce({ data: { data: first, total: 201 } } as never)
      // A canvas touched between pages (updatedAt desc) reappears on page 2.
      .mockResolvedValueOnce({ data: { data: [{ id: 'c199' }], total: 201 } } as never);

    const canvases = await getAllCanvases();

    expect(canvases).toHaveLength(200);
    expect(new Set(canvases.map((c) => c.id)).size).toBe(200);
  });

  it('M3: sends layout saves with a 15 s timeout so a hung PUT cannot wedge the queue', async () => {
    const put = vi.spyOn(canvasClient, 'put').mockResolvedValue({} as never);

    await canvasApi.saveLayout('c1', { positions: [] });

    expect(put).toHaveBeenCalledWith('/canvas/c1/layout', { positions: [] }, { timeout: 15000 });
  });
});
