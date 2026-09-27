import { test, expect } from '@playwright/test';
import { outbox, clock } from './support/api';

// Runs last. Proves the whole run was hermetic: the backend's preload refused
// or stubbed every outbound connection, and nothing tried to reach the internet.
test('no outbound connection left the machine during the suite', async () => {
  const entries = outbox();
  expect(entries.some((e) => e.kind === 'guard-installed')).toBe(true);
  const blocked = entries.filter((e) => e.kind.startsWith('blocked'));
  expect(blocked, JSON.stringify(blocked.slice(0, 5))).toEqual([]);
  expect((await clock()).blocked).toBe(0);
  // Every email went to a reserved test domain.
  const recipients = entries.filter((e) => e.kind === 'email').flatMap((e) => (Array.isArray(e.to) ? e.to : [e.to]));
  expect(recipients.length).toBeGreaterThan(0);
  expect(recipients.every((r) => /@example\.(com|edu)$/.test(String(r)))).toBe(true);
});
