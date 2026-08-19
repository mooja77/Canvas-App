import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const { mockCanvasClient, mockToast } = vi.hoisted(() => ({
  mockCanvasClient: { get: vi.fn(), put: vi.fn(), post: vi.fn() },
  mockToast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock('../../../services/api', () => ({
  canvasClient: mockCanvasClient,
}));

vi.mock('react-hot-toast', () => ({
  default: mockToast,
}));

vi.mock('../../../stores/canvasStore', () => ({
  useActiveCanvas: () => ({ id: 'canvas-1', name: 'Study', transcripts: [] }),
}));

import EthicsCompliancePanel from './EthicsCompliancePanel';

const TOTAL_ENTRIES = 260;

function makeEntry(i: number) {
  return {
    id: `a${i}`,
    timestamp: `2026-08-${String((i % 28) + 1).padStart(2, '0')}T10:00:00.000Z`,
    action: i % 2 === 0 ? 'coding.create' : 'coding.delete',
    resource: `coding/${i}`,
    actor: 'researcher@example.com',
    details: i === 7 ? 'note with "quotes" and\na newline' : `entry ${i}`,
  };
}

const allEntries = Array.from({ length: TOTAL_ENTRIES }, (_, i) => makeEntry(i));

/** Minimal RFC4180 parser so we inspect the produced CSV, not the call args. */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"' && field === '') inQuotes = true;
    else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n') {
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else if (ch !== '\r') field += ch;
  }
  row.push(field);
  rows.push(row);
  return rows;
}

describe('EthicsCompliancePanel audit log export', () => {
  const blobs: Blob[] = [];

  beforeEach(() => {
    vi.clearAllMocks();
    blobs.length = 0;
    mockCanvasClient.get.mockImplementation(async (url: string) => {
      if (!url.startsWith('/audit-log')) return { data: { data: {} } };
      const params = new URLSearchParams(url.split('?')[1] || '');
      const limit = Number(params.get('limit') || 50);
      const offset = Number(params.get('offset') || 0);
      return { data: { data: { entries: allEntries.slice(offset, offset + limit), total: TOTAL_ENTRIES } } };
    });
    global.URL.createObjectURL = vi.fn((blob: Blob) => {
      blobs.push(blob);
      return 'blob:mock';
    }) as unknown as typeof URL.createObjectURL;
    global.URL.revokeObjectURL = vi.fn();
  });

  async function openAuditTabAndExport() {
    render(<EthicsCompliancePanel onClose={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Audit Trail' }));
    await waitFor(() => expect(screen.getByRole('button', { name: /Export Audit Log/ })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: /Export Audit Log/ }));
    await waitFor(() => expect(blobs.length).toBe(1));
    return parseCsv((await blobs[0].text()).replace(/^\uFEFF/, ''));
  }

  it('exports every audit entry, not just the page held in state', async () => {
    const rows = await openAuditTabAndExport();
    expect(rows[0]).toEqual(['Date/Time', 'Action', 'Resource', 'Actor', 'Details']);
    expect(rows).toHaveLength(TOTAL_ENTRIES + 1);
  });

  it('keeps a multi-line detail in a single CSV record', async () => {
    const rows = await openAuditTabAndExport();
    const withNewline = rows.find((r) => r[2] === 'coding/7');
    expect(withNewline).toBeDefined();
    expect(withNewline![4]).toBe('note with "quotes" and\na newline');
  });
});
