import { describe, it, expect } from 'vitest';
import type { CanvasQuestion, CanvasTextCoding } from '@qualcanvas/shared';
import { buildCodeTree } from './codeTree';

function q(id: string, text: string, parentQuestionId: string | null = null): CanvasQuestion {
  return {
    id,
    canvasId: 'canvas1',
    text,
    color: '#ff0000',
    sortOrder: 0,
    parentQuestionId,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
  };
}

function coding(id: string, questionId: string): CanvasTextCoding {
  return {
    id,
    canvasId: 'canvas1',
    transcriptId: 't1',
    questionId,
    startOffset: 0,
    endOffset: 5,
    codedText: 'x',
    createdAt: '2025-01-01T00:00:00Z',
  };
}

describe('buildCodeTree — rolled-up counts', () => {
  it('flat codes: count equals own codings, ownCount matches', () => {
    const tree = buildCodeTree(
      [q('a', 'A'), q('b', 'B')],
      [coding('1', 'a'), coding('2', 'a'), coding('3', 'b')],
      'count',
    );
    const a = tree.find((t) => t.question.id === 'a')!;
    const b = tree.find((t) => t.question.id === 'b')!;
    expect(a.codingCount).toBe(2);
    expect(a.ownCount).toBe(2);
    expect(b.codingCount).toBe(1);
  });

  it('parent with NO direct codings rolls up its children (the reported bug)', () => {
    const tree = buildCodeTree(
      [q('CF1', 'Family'), q('s1', 'Sub 1', 'CF1'), q('s2', 'Sub 2', 'CF1')],
      [coding('1', 's1'), coding('2', 's1'), coding('3', 's1'), coding('4', 's2')],
      'count',
    );
    expect(tree).toHaveLength(1);
    const fam = tree[0];
    expect(fam.question.id).toBe('CF1');
    expect(fam.ownCount).toBe(0); // no direct codings on the family
    expect(fam.codingCount).toBe(4); // 3 + 1 rolled up from sub-codes
    expect(fam.children.map((c) => c.codingCount).sort()).toEqual([1, 3]);
  });

  it('parent count = own direct codings PLUS descendants', () => {
    const tree = buildCodeTree(
      [q('p', 'Parent'), q('c', 'Child', 'p')],
      [coding('1', 'p'), coding('2', 'c'), coding('3', 'c')],
      'count',
    );
    const p = tree[0];
    expect(p.ownCount).toBe(1);
    expect(p.codingCount).toBe(3); // 1 own + 2 child
  });

  it('rolls up through multiple levels (grandchildren)', () => {
    const tree = buildCodeTree(
      [q('p', 'P'), q('c', 'C', 'p'), q('g', 'G', 'c')],
      [coding('1', 'g'), coding('2', 'g'), coding('3', 'g'), coding('4', 'g')],
      'count',
    );
    const p = tree[0];
    const c = p.children[0];
    const g = c.children[0];
    expect(g.codingCount).toBe(4);
    expect(c.codingCount).toBe(4); // own 0 + grandchild 4
    expect(p.codingCount).toBe(4);
  });

  it('sorts roots by rolled-up count so a heavily-coded family outranks a flat code', () => {
    const tree = buildCodeTree(
      [q('fam', 'Family'), q('s', 'Sub', 'fam'), q('flat', 'Flat')],
      [
        ...Array.from({ length: 5 }, (_, i) => coding(`s${i}`, 's')),
        ...Array.from({ length: 3 }, (_, i) => coding(`f${i}`, 'flat')),
      ],
      'count',
    );
    expect(tree.map((t) => t.question.id)).toEqual(['fam', 'flat']); // 5 > 3
  });

  it('sorts by name when sortMode is "name"', () => {
    const tree = buildCodeTree([q('b', 'Beta'), q('a', 'Alpha')], [], 'name');
    expect(tree.map((t) => t.question.text)).toEqual(['Alpha', 'Beta']);
  });
});
