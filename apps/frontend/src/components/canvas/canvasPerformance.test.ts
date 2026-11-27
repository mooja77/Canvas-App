import { describe, it, expect } from 'vitest';
import {
  CANVAS_BENCHMARK_PRESETS,
  generateSyntheticCanvas,
  measureCanvasOperations,
  summarizeCanvasScale,
} from './canvasPerformance';
import { DENSE_EDGE_THRESHOLD, VISIBLE_ELEMENT_CULL_THRESHOLD } from './canvasEdgeUtils';

describe('canvasPerformance (qualcanvas-14: Measure big canvases)', () => {
  it('generates deterministic synthetic canvases matching each preset size', () => {
    for (const [name, preset] of Object.entries(CANVAS_BENCHMARK_PRESETS)) {
      const sample = generateSyntheticCanvas(name as keyof typeof CANVAS_BENCHMARK_PRESETS);
      expect(sample.transcripts).toHaveLength(preset.transcripts);
      expect(sample.questions).toHaveLength(preset.codes);
      expect(sample.codings).toHaveLength(preset.codings);
      expect(sample.relations).toHaveLength(preset.relations);
      expect(sample.memos).toHaveLength(preset.memos);
    }
  });

  it('summarizes small vs large canvas scale and reports active large-canvas optimizations', () => {
    const small = summarizeCanvasScale(generateSyntheticCanvas('small'));
    expect(small.nodeCount).toBeLessThanOrEqual(VISIBLE_ELEMENT_CULL_THRESHOLD);
    expect(small.cullingActive).toBe(false);
    expect(small.totalWords).toBeGreaterThan(0);
    expect(small.longestTranscriptWords).toBeGreaterThan(0);

    const large = summarizeCanvasScale(generateSyntheticCanvas('large'));
    expect(large.nodeCount).toBeGreaterThan(VISIBLE_ELEMENT_CULL_THRESHOLD);
    expect(large.edgeCount).toBeGreaterThan(DENSE_EDGE_THRESHOLD);
    expect(large.isLarge).toBe(true);
    expect(large.cullingActive).toBe(true);
    expect(large.denseEdgeModeActive).toBe(true);
  });

  it('measures large canvas operations within strict regression budgets', () => {
    const report = measureCanvasOperations('large');
    expect(report.preset).toBe('large');
    expect(report.scale.nodeCount).toBe(170);
    expect(report.scale.codingCount).toBe(1500);
    expect(report.timingsMs.wordCountMs).toBeGreaterThanOrEqual(0);
    expect(report.timingsMs.wordCountMs).toBeLessThan(1000);
    expect(report.timingsMs.codingEdgeBundleMs).toBeLessThan(500);
    expect(report.timingsMs.decorateIdleMs).toBeLessThan(50);
    expect(report.timingsMs.decorateSearchMs).toBeLessThan(200);
    expect(report.timingsMs.edgeSyncMs).toBeLessThan(100);
    expect(report.idlePreservedReference).toBe(true);
  });
});
