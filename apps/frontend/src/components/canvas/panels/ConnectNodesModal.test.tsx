import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ConnectNodesModal from './ConnectNodesModal';

const mockAddRelation = vi.fn();
const mockDeleteRelation = vi.fn();

const mockState = vi.hoisted(() => ({
  activeCanvas: null as null | {
    id: string;
    questions: { id: string; text: string; color: string }[];
    cases: { id: string; name: string }[];
    relations: {
      id: string;
      fromType: 'case' | 'question';
      fromId: string;
      toType: 'case' | 'question';
      toId: string;
      label: string;
    }[];
    myRole?: string;
  },
}));

vi.mock('../../../stores/canvasStore', () => ({
  useActiveCanvas: () => mockState.activeCanvas,
  useCanvasStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      addRelation: mockAddRelation,
      deleteRelation: mockDeleteRelation,
    }),
  ),
}));

vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('ConnectNodesModal (qualcanvas-15)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddRelation.mockResolvedValue({
      id: 'rel-new',
      fromType: 'question',
      fromId: 'q1',
      toType: 'question',
      toId: 'q2',
      label: 'causes',
    });
    mockDeleteRelation.mockResolvedValue(undefined);
    mockState.activeCanvas = {
      id: 'canvas-1',
      questions: [
        { id: 'q1', text: 'Workload pressure', color: '#EF4444' },
        { id: 'q2', text: 'Burnout', color: '#3B82F6' },
      ],
      cases: [{ id: 'c1', name: 'Clinic A' }],
      relations: [
        {
          id: 'rel-1',
          fromType: 'question',
          fromId: 'q1',
          toType: 'case',
          toId: 'c1',
          label: 'is associated with',
        },
      ],
    };
  });

  it('shows a helpful empty state when fewer than two connectable nodes exist', () => {
    mockState.activeCanvas = {
      id: 'canvas-1',
      questions: [{ id: 'q1', text: 'Only code', color: '#3B82F6' }],
      cases: [],
      relations: [],
    };
    render(<ConnectNodesModal onClose={vi.fn()} />);
    expect(screen.getByText(/Add at least two codes or cases/i)).toBeInTheDocument();
  });

  it('connects two nodes using dropdowns and a preset label without dragging', async () => {
    const onClose = vi.fn();
    render(<ConnectNodesModal onClose={onClose} />);

    const fromSelect = screen.getByLabelText('From node');
    const toSelect = screen.getByLabelText('To node');
    fireEvent.change(fromSelect, { target: { value: 'question:q1' } });
    fireEvent.change(toSelect, { target: { value: 'question:q2' } });
    fireEvent.click(screen.getByRole('button', { name: 'causes' }));
    fireEvent.click(screen.getByRole('button', { name: 'Connect nodes' }));

    await waitFor(() => {
      expect(mockAddRelation).toHaveBeenCalledWith('question', 'q1', 'question', 'q2', 'causes');
    });
  });

  it('supports a custom relationship label and pre-populates initialFromNodeId', async () => {
    render(<ConnectNodesModal onClose={vi.fn()} initialFromNodeId="case-c1" />);

    const fromSelect = screen.getByLabelText('From node') as HTMLSelectElement;
    expect(fromSelect.value).toBe('case:c1');

    const toSelect = screen.getByLabelText('To node');
    fireEvent.change(toSelect, { target: { value: 'question:q2' } });

    const labelInput = screen.getByLabelText('Relationship label');
    fireEvent.change(labelInput, { target: { value: 'shapes experience of' } });
    fireEvent.click(screen.getByRole('button', { name: 'Connect nodes' }));

    await waitFor(() => {
      expect(mockAddRelation).toHaveBeenCalledWith('case', 'c1', 'question', 'q2', 'shapes experience of');
    });
  });

  it('prevents connecting a node to itself', () => {
    render(<ConnectNodesModal onClose={vi.fn()} />);
    const fromSelect = screen.getByLabelText('From node');
    const toSelect = screen.getByLabelText('To node');
    fireEvent.change(fromSelect, { target: { value: 'question:q1' } });
    fireEvent.change(toSelect, { target: { value: 'question:q1' } });

    const submitBtn = screen.getByRole('button', { name: 'Connect nodes' });
    expect(submitBtn).toBeDisabled();
  });

  it('lists existing connections and removes one via keyboard-accessible button', async () => {
    render(<ConnectNodesModal onClose={vi.fn()} />);

    expect(screen.getByText('Existing connections (1)')).toBeInTheDocument();
    expect(screen.getAllByText('is associated with').length).toBeGreaterThanOrEqual(2);

    const removeBtn = screen.getByRole('button', { name: /Remove connection/i });
    fireEvent.click(removeBtn);

    await waitFor(() => {
      expect(mockDeleteRelation).toHaveBeenCalledWith('rel-1');
    });
  });

  it('closes when Escape is pressed', () => {
    const onClose = vi.fn();
    render(<ConnectNodesModal onClose={onClose} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalled();
  });
});
