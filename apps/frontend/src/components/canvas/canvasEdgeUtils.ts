import type { CanvasTextCoding } from '@qualcanvas/shared';

export function getCodingIdsFromEdgeData(edgeData: Record<string, unknown> | undefined): string[] {
  if (!edgeData) return [];

  const bundledCodings = Array.isArray(edgeData.codings) ? (edgeData.codings as Pick<CanvasTextCoding, 'id'>[]) : [];
  if (bundledCodings.length > 0) {
    return bundledCodings.map((coding) => coding.id).filter(Boolean);
  }

  return typeof edgeData.codingId === 'string' && edgeData.codingId ? [edgeData.codingId] : [];
}
