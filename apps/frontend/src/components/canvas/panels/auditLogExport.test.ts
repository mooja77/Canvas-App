import { describe, it, expect, vi } from 'vitest';
import { parseCsvRecords } from '../../../utils/csv';
import { buildAuditCsv, fetchAllAuditEntries, type AuditEntry } from './auditLogExport';

function entry(i: number, over: Partial<AuditEntry> = {}): AuditEntry {
  return {
    id: `a${i}`,
    timestamp: `2026-08-18T10:00:${String(i % 60).padStart(2, '0')}.000Z`,
    action: 'coding.create',
    resource: `coding/${i}`,
    actor: 'researcher@example.com',
    details: `entry ${i}`,
    ...over,
  };
}

describe('buildAuditCsv', () => {
  it('emits one parsable record per entry, plus the header', () => {
    const csv = buildAuditCsv([entry(1), entry(2)]);
    const rows = parseCsvRecords(csv.replace(/^\uFEFF/, ''));
    expect(rows).toHaveLength(3);
    expect(rows[0]).toEqual(['Date/Time', 'Action', 'Resource', 'Actor', 'Details']);
    expect(rows[1][2]).toBe('coding/1');
  });

  it('starts with a UTF-8 BOM', () => {
    expect(buildAuditCsv([entry(1)]).charCodeAt(0)).toBe(0xfeff);
  });

  it('keeps a detail containing a comma, quote or newline in one record', () => {
    const csv = buildAuditCsv([entry(1, { details: 'a, b "c"\nsecond line' })]);
    const rows = parseCsvRecords(csv.replace(/^\uFEFF/, ''));
    expect(rows).toHaveLength(2);
    expect(rows[1][4]).toBe('a, b "c"\nsecond line');
  });
});

describe('fetchAllAuditEntries', () => {
  it('pages until the log runs out', async () => {
    const all = Array.from({ length: 250 }, (_, i) => entry(i));
    const fetchPage = vi.fn(async (offset: number, limit: number) => all.slice(offset, offset + limit));
    const { entries, truncated } = await fetchAllAuditEntries(fetchPage, { pageSize: 100 });
    expect(entries).toHaveLength(250);
    expect(truncated).toBe(false);
    expect(fetchPage).toHaveBeenCalledTimes(3);
  });

  it('stops at the row ceiling and says so', async () => {
    const fetchPage = vi.fn(async (offset: number, limit: number) =>
      Array.from({ length: limit }, (_, i) => entry(offset + i)),
    );
    const { entries, truncated } = await fetchAllAuditEntries(fetchPage, { pageSize: 100, maxRows: 250 });
    expect(entries).toHaveLength(250);
    expect(truncated).toBe(true);
  });

  it('does not duplicate a row that shifts between pages', async () => {
    const page1 = [entry(1), entry(2)];
    const page2 = [entry(2), entry(3)];
    const fetchPage = vi.fn(async (offset: number) => (offset === 0 ? page1 : offset === 2 ? page2 : []));
    const { entries } = await fetchAllAuditEntries(fetchPage, { pageSize: 2 });
    expect(entries.map((e) => e.id)).toEqual(['a1', 'a2', 'a3']);
  });

  it('keeps the rows it already has when a later page fails', async () => {
    const fetchPage = vi.fn(async (offset: number) => {
      if (offset === 0) return [entry(1), entry(2)];
      throw new Error('429');
    });
    const { entries, truncated } = await fetchAllAuditEntries(fetchPage, { pageSize: 2 });
    expect(entries.map((e) => e.id)).toEqual(['a1', 'a2']);
    expect(truncated).toBe(true);
  });

  it('rethrows when the very first page fails', async () => {
    await expect(
      fetchAllAuditEntries(async () => {
        throw new Error('500');
      }),
    ).rejects.toThrow('500');
  });

  it('handles an empty log', async () => {
    const { entries, truncated } = await fetchAllAuditEntries(async () => []);
    expect(entries).toEqual([]);
    expect(truncated).toBe(false);
  });
});
