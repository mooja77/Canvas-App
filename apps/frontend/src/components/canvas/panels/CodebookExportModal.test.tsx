import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockToast } = vi.hoisted(() => ({
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('react-hot-toast', () => ({ default: mockToast }));

vi.mock('../../../stores/canvasStore', () => ({
  useActiveCanvas: () => ({
    id: 'canvas-1',
    name: 'Étude',
    questions: [{ id: 'q1', text: 'Coopération', color: '#3B82F6', parentQuestionId: null }],
    transcripts: [{ id: 't1', title: 'Interview 1', content: 'a'.repeat(100), caseId: 'c1' }],
    codings: [
      {
        id: 'x1',
        transcriptId: 't1',
        questionId: 'q1',
        startOffset: 0,
        endOffset: 40,
        codedText: 'line one\n\nline two',
        annotation: 'note\twith tab',
        createdAt: '2026-08-18T00:00:00.000Z',
      },
    ],
    cases: [{ id: 'c1', name: 'Clarecare' }],
  }),
}));

import CodebookExportModal from './CodebookExportModal';

describe('CodebookExportModal output', () => {
  const blobs: Blob[] = [];
  const writeText = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    blobs.length = 0;
    global.URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:mock';
    }) as unknown as typeof URL.createObjectURL;
    global.URL.revokeObjectURL = vi.fn();
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: writeText.mockResolvedValue(undefined) },
    });
  });

  it('downloads a CSV that starts with the UTF-8 BOM', async () => {
    render(<CodebookExportModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /Download CSV/ }));
    await waitFor(() => expect(blobs).toHaveLength(1));
    // Blob.text() UTF-8-decodes and swallows the BOM, so check the bytes.
    const bytes = new Uint8Array(await blobs[0].arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    expect(await blobs[0].text()).toContain('Coopération');
  });

  it('copies TSV in which a multi-line excerpt stays on one row', async () => {
    render(<CodebookExportModal onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: /All Coded Data/ }));
    fireEvent.click(screen.getByRole('button', { name: /Copy/ }));
    await waitFor(() => expect(writeText).toHaveBeenCalled());

    const tsv: string = writeText.mock.calls[0][0];
    // Unquoted line count would be 4 (header + 3 fragments) if the excerpt and
    // the tabbed annotation were pasted raw.
    expect(tsv).toContain('"line one\n\nline two"');
    expect(tsv).toContain('"note\twith tab"');
  });
});
