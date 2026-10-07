import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import type { ComponentProps, ReactNode } from 'react';
import StatsNode from './StatsNode';

const fixture = vi.hoisted(() => ({
  node: {
    id: 'local-stats',
    label: 'Statistics',
    config: { groupBy: 'question' },
    result: {
      total: 2,
      items: [
        { label: 'A complete code name longer than the chart label', count: 2 },
        { label: 'Unused code', count: 0 },
      ],
    },
  },
  update: vi.fn(),
}));
vi.mock('../../../stores/canvasStore', () => ({
  useCanvasComputedNodes: () => [fixture.node],
  useCanvasStore: (select: (state: { updateComputedNode: typeof fixture.update }) => unknown) =>
    select({ updateComputedNode: fixture.update }),
}));
vi.mock('./ComputedNodeShell', () => ({
  default: ({ children }: { children: ReactNode }) => <section>{children}</section>,
}));
// The real chart can omit axis ticks; the table must stand on its own.
vi.mock('recharts', async (original) => ({
  ...(await original<typeof import('recharts')>()),
  ResponsiveContainer: () => null,
}));
function mount() {
  const props: ComponentProps<typeof StatsNode> = {
    id: 'computed-local',
    type: 'stats',
    data: { computedNodeId: 'local-stats' },
    draggable: true,
    selected: false,
    dragging: false,
    selectable: true,
    deletable: true,
    zIndex: 0,
    isConnectable: true,
    positionAbsoluteX: 0,
    positionAbsoluteY: 0,
  };
  render(<StatsNode {...props} />);
}
beforeEach(() => {
  fixture.node.config.groupBy = 'question';
  fixture.node.result = {
    total: 2,
    items: [
      { label: 'A complete code name longer than the chart label', count: 2 },
      { label: 'Unused code', count: 0 },
    ],
  };
});
describe('readable coding counts independent of chart ticks', () => {
  it('offers a named keyboard-focusable scroll region for all counts', () => {
    mount();
    expect(screen.getByRole('region', { name: 'All coding counts' })).toHaveAttribute('tabindex', '0');
  });
  it('shows full labels, exact positive and zero counts with semantic headers', () => {
    mount();
    const table = screen.getByRole('table', { name: 'Coding frequency counts' });
    expect(within(table).getByRole('columnheader', { name: 'Code' })).toBeVisible();
    expect(within(table).getByRole('columnheader', { name: 'Saved excerpts' })).toBeVisible();
    const counted = within(table).getByRole('row', { name: 'A complete code name longer than the chart label 2' });
    expect(within(counted).getByRole('rowheader')).toHaveTextContent(
      'A complete code name longer than the chart label',
    );
    expect(within(counted).getByRole('cell')).toHaveTextContent('2');
    expect(within(table).getByRole('row', { name: 'Unused code 0' })).toBeVisible();
    expect(screen.getByText('Counts are saved coded excerpts, not people.')).toBeVisible();
  });
  it('retains the same full counts after changing to the pie chart', () => {
    mount();
    fireEvent.click(screen.getByRole('button', { name: 'Pie' }));
    expect(screen.getByRole('row', { name: 'A complete code name longer than the chart label 2' })).toBeVisible();
    expect(screen.getByRole('row', { name: 'Unused code 0' })).toBeVisible();
  });
  it('uses the transcript header when the saved computation is grouped by transcript', () => {
    fixture.node.config.groupBy = 'transcript';
    mount();
    expect(screen.getByRole('columnheader', { name: 'Transcript' })).toBeVisible();
    expect(screen.queryByRole('columnheader', { name: 'Code' })).toBeNull();
  });
});
