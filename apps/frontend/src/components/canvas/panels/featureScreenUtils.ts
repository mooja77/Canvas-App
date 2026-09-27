/**
 * Small helpers shared by the audio-transcription, document region-coding and
 * training-centre screens.
 */

/** The server's own error sentence when there is one, else `fallback`. */
export function apiErrorMessage(err: unknown, fallback: string): string {
  const data = (err as { response?: { data?: { error?: unknown } } })?.response?.data;
  return typeof data?.error === 'string' && data.error.trim() ? data.error : fallback;
}

/** The server's machine-readable error code, if any. */
export function apiErrorCode(err: unknown): string | undefined {
  const code = (err as { response?: { data?: { code?: unknown } } })?.response?.data?.code;
  return typeof code === 'string' ? code : undefined;
}

/** Plain-English band for Cohen's κ (Landis & Koch, 1977). */
export function kappaBand(score: number): string {
  if (score >= 0.81) return 'almost perfect agreement';
  if (score >= 0.61) return 'substantial agreement';
  if (score >= 0.41) return 'moderate agreement';
  if (score >= 0.21) return 'fair agreement';
  if (score >= 0) return 'slight agreement';
  return 'less agreement than chance';
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
