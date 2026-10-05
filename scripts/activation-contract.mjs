export const activationSteps = Object.freeze([
  'first-transcript',
  'first-coded-excerpt',
  'create-theme',
  'run-analysis',
  'export-csv',
]);

export function assertObservedProgress(response, expectedSteps) {
  const data = response?.body?.data;
  if (response?.status !== 200 || !Array.isArray(data?.observedSteps)) throw new Error('Observed progress unavailable');
  if (JSON.stringify(data.observedSteps) !== JSON.stringify(expectedSteps))
    throw new Error('Observed setup steps do not match completed actions');
  if (expectedSteps.includes('first-coded-excerpt') && !Number.isFinite(Date.parse(data.firstValueAt)))
    throw new Error('First value was not durably observed');
  if (
    !Array.isArray(data.state?.checklistComplete) ||
    expectedSteps.some((step) => !data.state.checklistComplete.includes(step))
  )
    throw new Error('Persisted checklist does not match observed steps');
  return data;
}

export function assertLocalOrigins(appOrigin, apiOrigin) {
  for (const value of [appOrigin, apiOrigin]) {
    const url = new URL(value);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname) ||
      url.username ||
      url.password
    )
      throw new Error('Local-only activation requires loopback origins without URL credentials');
  }
}
