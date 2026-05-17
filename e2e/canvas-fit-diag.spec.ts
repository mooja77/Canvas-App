import { test, expect, type Page } from '@playwright/test';

/**
 * TEMPORARY diagnostic for finding #1 — not a real regression test.
 *
 * The flex-col / absolute-overlay status-bar fixes destabilized React Flow
 * (canvas-coding/crud/ux-phase4 fail "element not stable"; visual-regression
 * canvas screenshot is non-deterministic). This spec instruments the canvas:
 * it opens a seeded canvas, polls the React Flow viewport transform for 6s,
 * and dumps the transform timeline + window.__fitDiag (every runFit call and
 * every workspace-size observation, added in CanvasWorkspace.tsx). The CI job
 * log then shows exactly whether the canvas is perpetually re-fitting and what
 * triggers it. Delete this file + the __fitDiag instrumentation once finding
 * #1 is fixed.
 */

const API = 'http://localhost:3007/api/v1';
const PREFIX = `E2E-DIAG ${Date.now()}`;
let jwt = '';
let canvasId = '';

function headers() {
  return { Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json' };
}

test.describe('Finding #1 fit diagnostic', () => {
  test.beforeAll(async ({ browser }) => {
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    await p.goto('http://localhost:5174/canvas');
    await p.waitForLoadState('domcontentloaded');
    jwt = await p.evaluate(() => {
      const raw = localStorage.getItem('qualcanvas-auth');
      return raw ? JSON.parse(raw)?.state?.jwt || '' : '';
    });
    const res = await p.request.post(`${API}/canvas`, { headers: headers(), data: { name: PREFIX } });
    canvasId = (await res.json()).data.id;
    const tRes = await p.request.post(`${API}/canvas/${canvasId}/transcripts`, {
      headers: headers(),
      data: {
        title: 'Diag Interview',
        content: 'The research methodology involved semi-structured interviews across institutions.',
      },
    });
    const transcriptId = (await tRes.json()).data.id;
    let firstQuestionId = '';
    for (const t of ['Methodology', 'Culture', 'Findings']) {
      const qRes = await p.request.post(`${API}/canvas/${canvasId}/questions`, {
        headers: headers(),
        data: { text: t, color: '#4F46E5' },
      });
      if (!firstQuestionId) firstQuestionId = (await qRes.json()).data.id;
    }
    // A coding so the first question node renders the "View coded segments"
    // button — the element canvas-coding:98 fails to click.
    if (transcriptId && firstQuestionId) {
      await p.request.post(`${API}/canvas/${canvasId}/codings`, {
        headers: headers(),
        data: {
          transcriptId,
          questionId: firstQuestionId,
          startOffset: 0,
          endOffset: 31,
          codedText: 'The research methodology involved',
        },
      });
    }
    await p.close();
    await ctx.close();
  });

  test.afterAll(async ({ browser }) => {
    if (!canvasId) return;
    const ctx = await browser.newContext({ storageState: 'e2e/.auth/user.json' });
    const p = await ctx.newPage();
    await p.goto('http://localhost:5174/canvas');
    await p.waitForLoadState('domcontentloaded');
    jwt = await p.evaluate(() => {
      const raw = localStorage.getItem('qualcanvas-auth');
      return raw ? JSON.parse(raw)?.state?.jwt || '' : '';
    });
    await p.request.delete(`${API}/canvas/${canvasId}`, { headers: headers() });
    await p.request.delete(`${API}/canvas/${canvasId}/permanent`, { headers: headers() });
    await p.close();
    await ctx.close();
  });

  test('DIAG: capture fit timeline + viewport transform samples', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
      localStorage.setItem('jms_cookie_consent', 'rejected');
    });
    await page.goto(`/canvas/${canvasId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });

    // Poll the viewport transform every 150ms for 6s.
    const samples: { t: number; transform: string }[] = [];
    const start = Date.now();
    for (let i = 0; i < 40; i++) {
      const transform = await page.evaluate(() => {
        const vp = document.querySelector('.react-flow__viewport') as HTMLElement | null;
        return vp ? vp.style.transform : 'NO-VIEWPORT';
      });
      samples.push({ t: Date.now() - start, transform });
      await page.waitForTimeout(150);
    }

    const fitDiag = await page.evaluate(() => {
      return (window as unknown as { __fitDiag?: unknown[] }).__fitDiag || [];
    });

    // Count unique transforms in the last 2s (steady-state) — if > 1, the
    // canvas never settles.
    const steady = samples.filter((s) => s.t > 4000);
    const uniqueSteady = new Set(steady.map((s) => s.transform));

    console.log('=== FINDING-1 DIAG START ===');
    console.log('FIT_DIAG_LOG: ' + JSON.stringify(fitDiag));
    console.log('TRANSFORM_SAMPLES: ' + JSON.stringify(samples));
    console.log('STEADY_STATE_UNIQUE_TRANSFORMS: ' + uniqueSteady.size);
    console.log('STEADY_STATE_TRANSFORMS: ' + JSON.stringify([...uniqueSteady]));
    console.log('=== FINDING-1 DIAG END ===');

    // Always pass — this is a data-collection probe, not a gate.
    expect(samples.length).toBe(40);
  });

  test('DIAG: capture "View coded segments" click-interception geometry', async ({ page }) => {
    await page.addInitScript(() => {
      const s = JSON.parse(localStorage.getItem('qualcanvas-ui') || '{"state":{},"version":0}');
      s.state = { ...s.state, onboardingComplete: true, setupWizardComplete: true };
      localStorage.setItem('qualcanvas-ui', JSON.stringify(s));
      localStorage.setItem('jms_cookie_consent', 'rejected');
    });
    await page.goto(`/canvas/${canvasId}`);
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('.react-flow__pane', { timeout: 15000 });
    await page.waitForTimeout(2000); // let fit + node measurement settle

    const report = await page.evaluate(() => {
      const describe = (el: Element | null): string => {
        if (!el) return 'null';
        const e = el as HTMLElement;
        const cls = (e.className || '').toString().slice(0, 60);
        const z = getComputedStyle(e).zIndex;
        const nodeAncestor = e.closest('.react-flow__node');
        const nodeId = nodeAncestor?.getAttribute('data-id') || '';
        return `<${e.tagName.toLowerCase()} class="${cls}" z=${z}${nodeId ? ' node=' + nodeId : ''}>`;
      };
      const btn = document.querySelector('button[title="View coded segments"]') as HTMLElement | null;
      const out: Record<string, unknown> = {};
      if (!btn) {
        out.error = 'no View coded segments button found';
        return JSON.stringify(out);
      }
      const r = btn.getBoundingClientRect();
      const cx = Math.round(r.x + r.width / 2);
      const cy = Math.round(r.y + r.height / 2);
      out.button = { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), cx, cy };
      out.buttonZ = getComputedStyle(btn).zIndex;
      // What element is actually at the button's centre? (Playwright's hit test.)
      const hit = document.elementFromPoint(cx, cy);
      out.hitAtCentre = describe(hit);
      out.hitIsButtonOrChild = !!(hit && (hit === btn || btn.contains(hit) || hit.contains(btn)));
      // Walk the elementsFromPoint stack at the centre.
      out.stackAtCentre = document.elementsFromPoint(cx, cy).slice(0, 6).map(describe);
      // The button's own node.
      const ownNode = btn.closest('.react-flow__node');
      out.buttonNode = ownNode?.getAttribute('data-id') || '';
      // All rendered nodes + their on-screen rects.
      out.nodes = Array.from(document.querySelectorAll('.react-flow__node')).map((n) => {
        const nr = n.getBoundingClientRect();
        return {
          id: n.getAttribute('data-id'),
          x: Math.round(nr.x),
          y: Math.round(nr.y),
          w: Math.round(nr.width),
          h: Math.round(nr.height),
          z: getComputedStyle(n as HTMLElement).zIndex,
        };
      });
      // Status bar overlay rect.
      const status = document.querySelector('[data-tour="canvas-status-bar"]') as HTMLElement | null;
      if (status) {
        const sr = status.getBoundingClientRect();
        out.statusBar = {
          x: Math.round(sr.x),
          y: Math.round(sr.y),
          w: Math.round(sr.width),
          h: Math.round(sr.height),
          z: getComputedStyle(status).zIndex,
          position: getComputedStyle(status).position,
        };
      }
      return JSON.stringify(out);
    });

    console.log('=== FINDING-1 INTERCEPT DIAG START ===');
    console.log('INTERCEPT_REPORT: ' + report);
    console.log('=== FINDING-1 INTERCEPT DIAG END ===');

    expect(typeof report).toBe('string');
  });
});
