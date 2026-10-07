import type { AuditEntry } from './auditLogExport';

const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const text = (value: unknown): value is string => typeof value === 'string';
const date = (value: unknown): value is string => text(value) && Number.isFinite(Date.parse(value));
const nullableText = (value: unknown) => value === null || value === undefined || text(value);

export function ethicsReadPayload(response: { data: unknown }): unknown {
  const body = response.data;
  if (record(body) && body.success === false) throw new Error('Read was not acknowledged');
  return record(body) && Object.prototype.hasOwnProperty.call(body, 'data') ? body.data : body;
}

export function readEthicsSettings(value: unknown) {
  if (
    !record(value) ||
    !Object.prototype.hasOwnProperty.call(value, 'ethicsApprovalId') ||
    !Object.prototype.hasOwnProperty.call(value, 'dataRetentionDate') ||
    !text(value.ethicsStatus) ||
    !['pending', 'approved', 'expired'].includes(value.ethicsStatus) ||
    !nullableText(value.ethicsApprovalId) ||
    !nullableText(value.dataRetentionDate) ||
    (value.dataRetentionDate != null && !date(value.dataRetentionDate))
  )
    throw new Error('Invalid ethics settings');
  return {
    irbNumber: (value.ethicsApprovalId as string | null) ?? '',
    ethicsStatus: value.ethicsStatus as 'pending' | 'approved' | 'expired',
    dataRetentionDate: (value.dataRetentionDate as string | null)?.split('T')[0] ?? '',
  };
}

export function readConsentRecords(value: unknown, canvasId: string) {
  if (!Array.isArray(value)) throw new Error('Invalid consent list');
  return value.map((row: unknown) => {
    if (
      !record(row) ||
      !text(row.id) ||
      !row.id ||
      !text(row.participantId) ||
      !text(row.consentType) ||
      !['informed', 'verbal', 'written'].includes(row.consentType) ||
      !text(row.consentStatus ?? row.status) ||
      !['active', 'withdrawn'].includes((row.consentStatus ?? row.status) as string) ||
      !date(row.createdAt) ||
      !nullableText(row.ethicsProtocol) ||
      !nullableText(row.notes) ||
      (row.canvasId !== undefined && row.canvasId !== canvasId)
    )
      throw new Error('Invalid consent record');
    return {
      id: row.id,
      participantId: row.participantId,
      consentType: row.consentType as 'informed' | 'verbal' | 'written',
      status: (row.consentStatus ?? row.status) as 'active' | 'withdrawn',
      ethicsProtocol: (row.ethicsProtocol as string | null) ?? '',
      notes: (row.notes as string | null) ?? '',
      createdAt: row.createdAt,
    };
  });
}

export function readJournalEntries(value: unknown, canvasId: string) {
  if (!Array.isArray(value)) throw new Error('Invalid journal list');
  return value.map((row: unknown) => {
    if (
      !record(row) ||
      !text(row.id) ||
      !row.id ||
      !text(row.content) ||
      !date(row.createdAt ?? row.date) ||
      !nullableText(row.category) ||
      (row.canvasId !== undefined && row.canvasId !== canvasId)
    )
      throw new Error('Invalid journal entry');
    return {
      id: row.id,
      content: row.content,
      date: (row.createdAt ?? row.date) as string,
      category: (row.category as string | null) ?? 'general',
    };
  });
}

export function readAuditEntries(value: unknown): AuditEntry[] {
  const entries = record(value) ? value.entries : value;
  if (!Array.isArray(entries)) throw new Error('Invalid audit page');
  return entries.map((row: unknown) => {
    if (
      !record(row) ||
      !text(row.id) ||
      !row.id ||
      !date(row.timestamp) ||
      !text(row.action) ||
      !text(row.resource) ||
      !nullableText(row.actor) ||
      !nullableText(row.actorId) ||
      !nullableText(row.details) ||
      !nullableText(row.meta)
    )
      throw new Error('Invalid audit entry');
    return {
      id: row.id,
      timestamp: row.timestamp,
      action: row.action,
      resource: row.resource,
      actor: (row.actor as string | null) ?? (row.actorId as string | null) ?? 'Not recorded',
      details: (row.details as string | null) ?? (row.meta as string | null) ?? '',
    };
  });
}
