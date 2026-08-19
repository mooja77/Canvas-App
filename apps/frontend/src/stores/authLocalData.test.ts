import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAuthStore } from './authStore';

/**
 * Guards the distinction between a DELIBERATE logout and an INVOLUNTARY one.
 *
 * Per-canvas research data - reflexivity journals, code weights, sticky notes,
 * theme groups, node colours, bookmarks, edge waypoints - lives only in
 * localStorage. There is no server copy. Wiping it when a 24h JWT expires, or
 * when the 35-minute idle timer fires, destroys the user's work before they
 * have done anything.
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
