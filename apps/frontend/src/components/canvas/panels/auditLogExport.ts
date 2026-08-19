import { UTF8_BOM, escapeCsvField } from '../../../utils/delimitedText';

export interface AuditEntry {
  id: string;
  timestamp: string;
  action: string;
  resource: string;
  actor: string;
  details: string;
}

export const AUDIT_CSV_HEADER = 'Date/Time,Action,Resource,Actor,Details';

/** The API clamps a page at 200 rows (see ethicsRoutes GET /audit-log). */
export const AUDIT_EXPORT_PAGE_SIZE = 200;

/**
 * Ceiling on a single export. The API rate-limits /audit-log to 60 requests
 * per 5 minutes, so 40 pages leaves headroom for the browsing the researcher
 * already did; past this the export says it was truncated instead of dying on
 * a 429.
 */
export const AUDIT_EXPORT_MAX_ROWS = AUDIT_EXPORT_PAGE_SIZE * 40;

export function buildAuditCsv(entries: AuditEntry[]): string {
  const rows = entries.map((e) =>
    [e.timestamp, e.action, e.resource, e.actor, e.details].map((v) => escapeCsvField(v ?? '')).join(','),
  );
  return UTF8_BOM + [AUDIT_CSV_HEADER, ...rows].join('\n');
}

export type AuditPageFetcher = (offset: number, limit: number) => Promise<AuditEntry[]>;

export interface AuditFetchResult {
  entries: AuditEntry[];
  /** True when the ceiling, or a failed page, stopped us short of the end. */
  truncated: boolean;
}

/**
 * Page through the whole audit log. The panel's table holds only the pages the
 * researcher happened to scroll through, which is not what "export the audit
 * trail" means - so the export re-reads the log from the API.
 */
export async function fetchAllAuditEntries(
  fetchPage: AuditPageFetcher,
  { pageSize = AUDIT_EXPORT_PAGE_SIZE, maxRows = AUDIT_EXPORT_MAX_ROWS }: { pageSize?: number; maxRows?: number } = {},
): Promise<AuditFetchResult> {
  const entries: AuditEntry[] = [];
  const seen = new Set<string>();
  let offset = 0;

  for (;;) {
    let page: AuditEntry[];
    try {
      page = await fetchPage(offset, pageSize);
    } catch (err) {
      // Hand back the rows already read (flagged as partial) rather than
      // losing the whole export to one failed page. A first-page failure is a
      // real failure and is reported as one.
      if (entries.length === 0) throw err;
      return { entries, truncated: true };
    }
    if (!page.length) return { entries, truncated: false };

    for (const entry of page) {
      // Rows are timestamp-ordered; a write between pages can repeat one.
      if (entry.id && seen.has(entry.id)) continue;
      if (entry.id) seen.add(entry.id);
      entries.push(entry);
    }

    if (entries.length >= maxRows) {
      return { entries: entries.slice(0, maxRows), truncated: true };
    }
    if (page.length < pageSize) return { entries, truncated: false };
    offset += page.length;
  }
}
