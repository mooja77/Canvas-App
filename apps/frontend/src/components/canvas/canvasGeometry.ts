export function numericValue(value: unknown): number | undefined {
  // Reject NaN/Infinity: a non-finite number serializes to JSON `null`, which the
  // strict layout-save schema rejects — and because positions are validated as one
  // batch, a single bad width/height there fails the WHOLE save ("Layout save
  // failed") until the offending node is gone. Treat non-finite as "no value".
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}
