import type { CanvasTranscript, UpdateTranscriptInput } from '@qualcanvas/shared';
import { canvasApi } from '../../../services/api';

export type TranscriptMetadata = Required<
  Pick<UpdateTranscriptInput, 'eventDate' | 'latitude' | 'longitude' | 'locationName'>
>;
const record = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);
const nullableCoordinate = (value: unknown, limit: number) =>
  value === null || (typeof value === 'number' && Number.isFinite(value) && Math.abs(value) <= limit);

function verifiedRow(value: unknown, canvasId: string, transcriptId: string): CanvasTranscript {
  if (
    !record(value) ||
    value.id !== transcriptId ||
    value.canvasId !== canvasId ||
    typeof value.title !== 'string' ||
    typeof value.content !== 'string' ||
    !(
      value.eventDate === null ||
      (typeof value.eventDate === 'string' && Number.isFinite(Date.parse(value.eventDate)))
    ) ||
    !nullableCoordinate(value.latitude, 90) ||
    !nullableCoordinate(value.longitude, 180) ||
    (value.latitude === null) !== (value.longitude === null) ||
    !(value.locationName === null || typeof value.locationName === 'string')
  ) {
    throw new Error('The saved transcript details could not be verified. Check saved details before saving again.');
  }
  return value as unknown as CanvasTranscript;
}

export async function readTranscriptMetadata(canvasId: string, transcriptId: string): Promise<CanvasTranscript> {
  const response = await canvasApi.getCanvas(canvasId);
  const body: unknown = response.data;
  if (
    !record(body) ||
    body.success !== true ||
    !record(body.data) ||
    body.data.id !== canvasId ||
    !Array.isArray(body.data.transcripts)
  )
    throw new Error('Could not check saved details. Your entries are still here; try checking again.');
  return verifiedRow(
    body.data.transcripts.find((row: unknown) => record(row) && row.id === transcriptId),
    canvasId,
    transcriptId,
  );
}

export async function saveTranscriptMetadata(
  canvasId: string,
  transcriptId: string,
  metadata: TranscriptMetadata,
): Promise<CanvasTranscript> {
  const response = await canvasApi.updateTranscript(canvasId, transcriptId, metadata);
  const body: unknown = response.data;
  if (!record(body) || body.success !== true)
    throw new Error('The save was not confirmed. Check saved details before saving again.');
  verifiedRow(body.data, canvasId, transcriptId);
  const row = await readTranscriptMetadata(canvasId, transcriptId);
  const datesEqual =
    metadata.eventDate === null
      ? row.eventDate === null
      : typeof row.eventDate === 'string' && Date.parse(metadata.eventDate) === Date.parse(row.eventDate);
  if (
    !datesEqual ||
    row.latitude !== metadata.latitude ||
    row.longitude !== metadata.longitude ||
    row.locationName !== metadata.locationName
  )
    throw new Error('The saved details do not match your entries. Check saved details before saving again.');
  return row;
}
