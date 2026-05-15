import { describe, expect, it } from 'vitest';
import { breakpointFor, computeFit, nodesToBbox } from './canvasFit';

/**
 * Test cases are keyed to numbered findings in
 * `test-results/ui-ux-review-2026-05-14-deep-live-report.md`.
 *
 * Spec: docs/canvas-ux/fit-framing-algorithm.md.
 */

describe('breakpointFor', () => {
  it('returns mobile for widths under 640', () => {
    expect(breakpointFor(320)).toBe('mobile');
    expect(breakpointFor(390)).toBe('mobile');
    expect(breakpointFor(568)).toBe('mobile');
    expect(breakpointFor(639)).toBe('mobile');
  });

  it('returns tablet for 640 to under 1024', () => {
    expect(breakpointFor(640)).toBe('tablet');
    expect(breakpointFor(768)).toBe('tablet');
    expect(breakpointFor(1023)).toBe('tablet');
  });

  it('returns desktop for 1024 and up', () => {
    expect(breakpointFor(1024)).toBe('desktop');
    expect(breakpointFor(1440)).toBe('desktop');
    expect(breakpointFor(1920)).toBe('desktop');
  });
});

describe('nodesToBbox', () => {
  it('returns null for empty array', () => {
    expect(nodesToBbox([])).toBeNull();
  });

  it('computes bbox using measured dimensions when present', () => {
    const result = nodesToBbox([
      { position: { x: 100, y: 200 }, measured: { width: 300, height: 150 } },
      { position: { x: 500, y: 400 }, measured: { width: 200, height: 100 } },
    ]);
    expect(result).toEqual({ minX: 100, minY: 200, maxX: 700, maxY: 500 });
  });

  it('falls back to style dimensions when measured is missing', () => {
    const result = nodesToBbox([{ position: { x: 0, y: 0 }, style: { width: 320, height: 180 } }]);
    expect(result).toEqual({ minX: 0, minY: 0, maxX: 320, maxY: 180 });
  });

  it('falls back to defaults (280x200) when both measured and style missing', () => {
    const result = nodesToBbox([{ position: { x: 0, y: 0 } }]);
    expect(result).toEqual({ minX: 0, minY: 0, maxX: 280, maxY: 200 });
  });

  it('handles negative positions correctly', () => {
    const result = nodesToBbox([{ position: { x: -100, y: -50 }, measured: { width: 200, height: 100 } }]);
    expect(result).toEqual({ minX: -100, minY: -50, maxX: 100, maxY: 50 });
  });
});

describe('computeFit — empty / boundary', () => {
  it('returns identity when bbox is null', () => {
    expect(computeFit(null, { w: 1440, h: 900 }, 'desktop', 'initial')).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    });
  });

  it('returns identity when viewport is zero', () => {
    const bbox = { minX: 0, minY: 0, maxX: 1000, maxY: 800 };
    expect(computeFit(bbox, { w: 0, h: 0 }, 'desktop', 'initial')).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    });
  });

  it('returns identity for degenerate bbox (zero width or height)', () => {
    expect(computeFit({ minX: 0, minY: 0, maxX: 0, maxY: 0 }, { w: 1440, h: 900 }, 'desktop', 'initial')).toEqual({
      x: 0,
      y: 0,
      zoom: 1,
    });
  });
});

describe('computeFit — finding #1 mobile dense', () => {
  // Live QA: mobile viewport 390x844 showed 14 visible nodes with 11 clipped
  // because the static minZoom: 0.5 floor was too high for the graph bounds.
  it('fits a 25-node dense graph inside mobile portrait without clipping horizontally', () => {
    const bbox = { minX: 0, minY: 0, maxX: 1800, maxY: 1200 };
    const viewport = { w: 390, h: 844 };
    const result = computeFit(bbox, viewport, 'mobile', 'initial');

    // Floor is 0.10 on mobile — not 0.5.
    expect(result.zoom).toBeGreaterThanOrEqual(0.1);
    expect(result.zoom).toBeLessThanOrEqual(0.65);
    // Graph fits horizontally inside the viewport at the computed zoom.
    expect(result.zoom * 1800).toBeLessThanOrEqual(390);
    // Centered: the bbox center lands at viewport center.
    const bboxCenterScreen = result.x + (result.zoom * (0 + 1800)) / 2;
    expect(Math.abs(bboxCenterScreen - 390 / 2)).toBeLessThan(1);
  });
});

describe('computeFit — finding #2 desktop dense', () => {
  // Live QA: desktop initial fit used scale 0.5 and rendered only 19 of
  // 27 nodes. Manual fit measured 0.186434 to show all 27.
  it('lands near 0.186 zoom for a wide dense graph at 1440x900', () => {
    const bbox = { minX: 0, minY: 0, maxX: 5400, maxY: 3200 };
    const viewport = { w: 1440, h: 900 };
    const result = computeFit(bbox, viewport, 'desktop', 'initial');

    // Should NOT clamp to 0.5 like the old static FIT_OPTIONS did.
    expect(result.zoom).toBeLessThan(0.5);
    // Should produce a meaningful, legible scale.
    expect(result.zoom).toBeGreaterThanOrEqual(0.15);
    expect(result.zoom).toBeLessThanOrEqual(0.25);
  });
});

describe('computeFit — finding #11 post-layout vertical column', () => {
  // Live QA: after select-all + auto-layout, the graph became a long
  // vertical stack with extensive blank space. No post-layout fit was run.
  it('produces a real (non-floor) zoom for an extreme vertical bbox', () => {
    const bbox = { minX: 0, minY: 0, maxX: 8000, maxY: 14000 };
    const viewport = { w: 1440, h: 900 };
    const result = computeFit(bbox, viewport, 'desktop', 'post-layout');

    expect(result.zoom).toBeGreaterThanOrEqual(0.05); // overview floor
    // Viewport center should be near the bbox center on screen.
    const cyScreen = result.y + (result.zoom * 14000) / 2;
    expect(Math.abs(cyScreen - 900 / 2)).toBeLessThan(2);
  });

  it('preserves visibility at the worst-case scale', () => {
    // A bbox that needs zoom < minZoom should fall through to the overview
    // floor, not clamp upward (which would crop content).
    const bbox = { minX: 0, minY: 0, maxX: 100_000, maxY: 100_000 };
    const viewport = { w: 1440, h: 900 };
    const result = computeFit(bbox, viewport, 'desktop', 'post-layout');

    expect(result.zoom).toBeLessThan(0.15); // env.minZoom for desktop
    expect(result.zoom).toBeGreaterThanOrEqual(0.05); // OVERVIEW_FLOOR
  });
});

describe('computeFit — finding #17 compact mobile 320x568', () => {
  // Live QA: at 320x568 the user saw mostly chrome and white canvas.
  // 26 visible / 10 clipped after manual fit.
  it('fits 1200x1000 graph inside 320x568 without clipping either axis', () => {
    const bbox = { minX: 0, minY: 0, maxX: 1200, maxY: 1000 };
    const viewport = { w: 320, h: 568 };
    const result = computeFit(bbox, viewport, 'mobile', 'initial');

    expect(result.zoom).toBeGreaterThanOrEqual(0.1);
    expect(result.zoom * 1200).toBeLessThanOrEqual(320);
    expect(result.zoom * 1000).toBeLessThanOrEqual(568);
  });
});

describe('computeFit — finding #18 orientation change', () => {
  // Live QA: rotating mobile portrait -> landscape left the toolbar/status
  // offscreen and the graph blank. recover-intent must re-center.
  it('produces a different transform for portrait vs landscape, both centered', () => {
    const bbox = { minX: 0, minY: 0, maxX: 1500, maxY: 900 };
    const portrait = computeFit(bbox, { w: 390, h: 844 }, 'mobile', 'recover');
    const landscape = computeFit(bbox, { w: 844, h: 390 }, 'mobile', 'recover');

    // Different orientations -> different zoom (one is width-bound, other
    // height-bound).
    expect(landscape.zoom).not.toBeCloseTo(portrait.zoom, 2);

    // Both keep the bbox horizontally centered in the viewport.
    const portraitCenter = portrait.x + (portrait.zoom * 1500) / 2;
    const landscapeCenter = landscape.x + (landscape.zoom * 1500) / 2;
    expect(Math.abs(portraitCenter - 390 / 2)).toBeLessThan(1);
    expect(Math.abs(landscapeCenter - 844 / 2)).toBeLessThan(1);
  });
});

describe('computeFit — envelope guarantees', () => {
  it('respects mobile maxZoom cap of 0.65 for a tiny graph', () => {
    // A tiny graph wants very high zoom; mobile cap is 0.65 so an empty
    // canvas doesn't paint massive on a phone.
    const bbox = { minX: 0, minY: 0, maxX: 100, maxY: 100 };
    const viewport = { w: 390, h: 844 };
    const result = computeFit(bbox, viewport, 'mobile', 'initial');
    expect(result.zoom).toBeLessThanOrEqual(0.65);
  });

  it('respects desktop maxZoom cap of 1.0', () => {
    const bbox = { minX: 0, minY: 0, maxX: 200, maxY: 200 };
    const viewport = { w: 1440, h: 900 };
    const result = computeFit(bbox, viewport, 'desktop', 'initial');
    expect(result.zoom).toBeLessThanOrEqual(1.0);
  });

  it('respects tablet maxZoom cap of 0.85', () => {
    const bbox = { minX: 0, minY: 0, maxX: 200, maxY: 200 };
    const viewport = { w: 768, h: 1024 };
    const result = computeFit(bbox, viewport, 'tablet', 'initial');
    expect(result.zoom).toBeLessThanOrEqual(0.85);
  });
});

describe('computeFit — translation correctness', () => {
  it('places the bbox center at the viewport center', () => {
    // Bbox offset away from origin to catch translation math bugs.
    const bbox = { minX: 500, minY: 200, maxX: 1500, maxY: 1000 };
    const viewport = { w: 1440, h: 900 };
    const result = computeFit(bbox, viewport, 'desktop', 'initial');

    const bboxCx = (500 + 1500) / 2;
    const bboxCy = (200 + 1000) / 2;
    const screenCx = result.x + result.zoom * bboxCx;
    const screenCy = result.y + result.zoom * bboxCy;

    expect(Math.abs(screenCx - 1440 / 2)).toBeLessThan(0.01);
    expect(Math.abs(screenCy - 900 / 2)).toBeLessThan(0.01);
  });

  it('handles negative bbox coordinates', () => {
    const bbox = { minX: -500, minY: -300, maxX: 500, maxY: 300 };
    const viewport = { w: 1440, h: 900 };
    const result = computeFit(bbox, viewport, 'desktop', 'initial');

    // Bbox centered at origin; should center at viewport center.
    expect(Math.abs(result.x - 1440 / 2)).toBeLessThan(0.01);
    expect(Math.abs(result.y - 900 / 2)).toBeLessThan(0.01);
  });
});
