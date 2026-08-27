import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './authStore';

/**
 * Guards the distinction between a DELIBERATE logout and an INVOLUNTARY one.
 *
 * Browser caches, device-local preferences and pending offline writes must
 * survive an involuntary logout. Some research artefacts have a server copy,
 * but clearing the cache during session recovery still causes data loss for
 * unsent work and device-only preferences.
 */

const RESEARCH_KEYS = {
  'canvas-journal-abc': '[{"text":"my reflexivity note"}]',
  'canvas-weights-abc': '{"code1":5}',
  'canvas-stickies-abc': '[{"note":"hunch"}]',
  'canvas-groups-abc': '[{"theme":"trust"}]',
  'canvas-node-colors-abc': '{"n1":"#f00"}',
  'canvas-bookmarks-abc': '["n1"]',
  'canvas-code-bookmarks-abc': '["c1"]',
  'canvas-reroutes-abc': '[{"x":1}]',
  'canvas-open-tabs': '["abc"]',
  'qualcanvas-cross-refs': '{"a":"b"}',
  'qualcanvas-offline-queue': '[{"pendingWrite":true}]',
};

function seedResearchData() {
  for (const [k, v] of Object.entries(RESEARCH_KEYS)) localStorage.setItem(k, v);
}

const researchKeysPresent = () => Object.keys(RESEARCH_KEYS).filter((k) => localStorage.getItem(k) !== null);

beforeEach(() => {
  localStorage.clear();
  vi.stubGlobal(
    'fetch',
    vi.fn(() => Promise.resolve({ ok: true })),
  );
});

const EMAIL_USER = {
  email: 'a@example.com',
  userId: 'user-1',
  name: 'A',
  role: 'owner',
  plan: 'pro',
};

describe('deliberate logout', () => {
  it('still clears local research data for the next account', () => {
    seedResearchData();
    useAuthStore.getState().logout();
    expect(researchKeysPresent()).toEqual([]);
  });
});

describe('involuntary logout (expired JWT / idle timeout)', () => {
  it('preserves every category of local research data', () => {
    seedResearchData();
    useAuthStore.getState().logout({ preserveLocalData: true });
    expect(researchKeysPresent().sort()).toEqual(Object.keys(RESEARCH_KEYS).sort());
  });

  it('preserves the unsynced offline write queue', () => {
    seedResearchData();
    useAuthStore.getState().logout({ preserveLocalData: true });
    expect(localStorage.getItem('qualcanvas-offline-queue')).toBe('[{"pendingWrite":true}]');
  });

  it('still ends the session', () => {
    useAuthStore.getState().setEmailAuth(EMAIL_USER);
    expect(useAuthStore.getState().authenticated).toBe(true);
    useAuthStore.getState().logout({ preserveLocalData: true });
    expect(useAuthStore.getState().authenticated).toBe(false);
  });
});

describe('shared-browser guarantee, now tied to identity', () => {
  it('keeps the data when the SAME user signs back in after expiry', () => {
    useAuthStore.getState().setEmailAuth(EMAIL_USER);
    seedResearchData();
    useAuthStore.getState().logout({ preserveLocalData: true });

    useAuthStore.getState().setEmailAuth(EMAIL_USER);
    expect(researchKeysPresent().sort()).toEqual(Object.keys(RESEARCH_KEYS).sort());
  });

  it('clears it when a DIFFERENT user signs in on the same browser', () => {
    useAuthStore.getState().setEmailAuth(EMAIL_USER);
    seedResearchData();
    useAuthStore.getState().logout({ preserveLocalData: true });

    useAuthStore.getState().setEmailAuth({ ...EMAIL_USER, email: 'b@example.com', userId: 'user-2' });
    expect(researchKeysPresent()).toEqual([]);
  });

  it('clears it when a legacy access-code account signs in after an email one', () => {
    useAuthStore.getState().setEmailAuth(EMAIL_USER);
    seedResearchData();
    useAuthStore.getState().logout({ preserveLocalData: true });

    useAuthStore.getState().setAuth({
      dashboardCode: 'CODE',
      name: 'Legacy',
      role: 'owner',
      dashboardAccessId: 'dash-9',
    });
    expect(researchKeysPresent()).toEqual([]);
  });
});

/**
 * Linking an email to an existing access-code account is an UPGRADE, not a
 * different person signing in. The product actively nudges users into it
 * ("Add an email to secure your account"), and doing so used to wipe every
 * local-only artefact they had — including queued writes that had never
 * reached the server.
 */
describe('linking an email to a legacy account is the same person', () => {
  it('keeps local research data when a legacy session links an email', () => {
    useAuthStore.getState().setAuth({
      dashboardCode: 'CANVAS-LEZLW3M9',
      name: 'Legacy',
      role: 'owner',
      dashboardAccessId: 'dash-1',
    });
    seedResearchData();

    useAuthStore.getState().setEmailAuth({ ...EMAIL_USER, sameIdentity: true });

    expect(researchKeysPresent().sort()).toEqual(Object.keys(RESEARCH_KEYS).sort());
  });

  it('keeps the unsynced offline write queue across the link', () => {
    useAuthStore.getState().setAuth({
      dashboardCode: 'CANVAS-LEZLW3M9',
      name: 'Legacy',
      role: 'owner',
      dashboardAccessId: 'dash-1',
    });
    localStorage.setItem(
      'qualcanvas-offline-queue',
      JSON.stringify([{ method: 'POST', url: '/api/v1/canvas/C1/codings' }]),
    );

    useAuthStore.getState().setEmailAuth({ ...EMAIL_USER, sameIdentity: true });

    expect(localStorage.getItem('qualcanvas-offline-queue')).toContain('/api/v1/canvas/C1/codings');
  });

  it('still clears when a genuinely different email account signs in', () => {
    // The shared-browser guarantee must survive the fix: sameIdentity is only
    // ever set by the link-account flow, never by an ordinary sign-in.
    useAuthStore.getState().setAuth({
      dashboardCode: 'CANVAS-LEZLW3M9',
      name: 'Legacy',
      role: 'owner',
      dashboardAccessId: 'dash-1',
    });
    seedResearchData();

    useAuthStore.getState().setEmailAuth({ ...EMAIL_USER, email: 'other@example.com', userId: 'user-99' });

    expect(researchKeysPresent()).toEqual([]);
  });
});
