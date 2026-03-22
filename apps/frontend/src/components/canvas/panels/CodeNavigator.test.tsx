import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import CodeNavigator from './CodeNavigator';
import type { CanvasQuestion, CanvasTextCoding, CanvasTranscript, CanvasCase } from '@canvas-app/shared';

// ── Mock data factories ──

function makeQuestion(overrides: Partial<CanvasQuestion> = {}): CanvasQuestion {
  return {
    id: 'q1',
    canvasId: 'canvas1',
    text: 'Theme A',
    color: '#ff0000',
    sortOrder: 0,
    parentQuestionId: null,
    createdAt: '2025-01-01T00:00:00Z',
    updatedAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeCoding(overrides: Partial<CanvasTextCoding> = {}): CanvasTextCoding {
  return {
    id: 'c1',
    canvasId: 'canvas1',
    transcriptId: 't1',
    questionId: 'q1',
    startOffset: 0,
    endOffset: 10,
    codedText: 'some text',
    createdAt: '2025-01-01T00:00:00Z',
    ...overrides,
  };
}

// ── Store mocks ──

const mockQuestions: CanvasQuestion[] = [];
const mockCodings: CanvasTextCoding[] = [];
const mockTranscripts: CanvasTranscript[] = [];
const mockCases: CanvasCase[] = [];
let mockSelectedQuestionId: string | null = null;

vi.mock('../../../stores/canvasStore', () => ({
  useCanvasStore: vi.fn((selector: (s: Record<string, unknown>) => unknown) =>
    selector({
      setSelectedQuestionId: vi.fn(),
      updateQuestion: vi.fn(),
      deleteQuestion: vi.fn(),
    })
  ),
  useCanvasQuestions: () => mockQuestions,
  useCanvasCodings: () => mockCodings,
  useCanvasTranscripts: () => mockTranscripts,
  useCanvasCases: () => mockCases,
  useSelectedQuestionId: () => mockSelectedQuestionId,
  useActiveCanvasId: () => 'canvas1',
}));

vi.mock('../../../hooks/useCodeBookmarks', () => ({
  useCodeBookmarks: () => ({
    bookmarkedIds: new Set<string>(),
    toggleBookmark: vi.fn(),
    isBookmarked: () => false,
  }),
}));

vi.mock('react-hot-toast', () => ({
  default: { success: vi.fn(), error: vi.fn() },
}));

describe('CodeNavigator', () => {
  const onFocusNode = vi.fn();

  beforeEach(() => {
    // Reset arrays in-place so the module-level references stay valid
    mockQuestions.length = 0;
    mockCodings.length = 0;
    mockTranscripts.length = 0;
    mockCases.length = 0;
    mockSelectedQuestionId = null;
    onFocusNode.mockClear();
  });

  it('renders code list with 3 codes', () => {
    mockQuestions.push(
      makeQuestion({ id: 'q1', text: 'Theme A' }),
      makeQuestion({ id: 'q2', text: 'Theme B', color: '#00ff00' }),
      makeQuestion({ id: 'q3', text: 'Theme C', color: '#0000ff' }),
    );
    mockCodings.push(
      makeCoding({ id: 'c1', questionId: 'q1' }),
      makeCoding({ id: 'c2', questionId: 'q2' }),
    );

    render(<CodeNavigator onFocusNode={onFocusNode} />);

    expect(screen.getByText('Theme A')).toBeInTheDocument();
    expect(screen.getByText('Theme B')).toBeInTheDocument();
    expect(screen.getByText('Theme C')).toBeInTheDocument();
  });

  it('shows coding counts matching the number of codings per question', () => {
    mockQuestions.push(
      makeQuestion({ id: 'q1', text: 'Alpha' }),
      makeQuestion({ id: 'q2', text: 'Beta', color: '#00ff00' }),
    );
    mockCodings.push(
      makeCoding({ id: 'c1', questionId: 'q1' }),
      makeCoding({ id: 'c2', questionId: 'q1' }),
      makeCoding({ id: 'c3', questionId: 'q1' }),
      makeCoding({ id: 'c4', questionId: 'q2' }),
    );

    render(<CodeNavigator onFocusNode={onFocusNode} />);

    // Counts rendered as text in the tree items
    // q1 has 3 codings, q2 has 1
    const countElements = screen.getAllByText(/^\d+$/);
    const counts = countElements.map(el => el.textContent);
    expect(counts).toContain('3');
    expect(counts).toContain('1');
  });

  it('filter input hides non-matching codes', () => {
    mockQuestions.push(
      makeQuestion({ id: 'q1', text: 'Happiness' }),
      makeQuestion({ id: 'q2', text: 'Sadness', color: '#00ff00' }),
      makeQuestion({ id: 'q3', text: 'Anger', color: '#0000ff' }),
    );

    render(<CodeNavigator onFocusNode={onFocusNode} />);

    const filterInput = screen.getByPlaceholderText('Filter codes...');
    fireEvent.change(filterInput, { target: { value: 'sad' } });

    expect(screen.getByText('Sadness')).toBeInTheDocument();
    expect(screen.queryByText('Happiness')).not.toBeInTheDocument();
    expect(screen.queryByText('Anger')).not.toBeInTheDocument();
  });

  it('empty state — renders without crash when no questions', () => {
    // All arrays are empty from beforeEach
    render(<CodeNavigator onFocusNode={onFocusNode} />);

    expect(screen.getByText('No codes yet')).toBeInTheDocument();
  });

  it('sort by count — codes ordered by coding count descending (default)', () => {
    mockQuestions.push(
      makeQuestion({ id: 'q1', text: 'Low' }),
      makeQuestion({ id: 'q2', text: 'High', color: '#00ff00' }),
      makeQuestion({ id: 'q3', text: 'Mid', color: '#0000ff' }),
    );
    // q1: 1 coding, q2: 5 codings, q3: 3 codings
    mockCodings.push(
      makeCoding({ id: 'c1', questionId: 'q1' }),
      ...Array.from({ length: 5 }, (_, i) => makeCoding({ id: `c2-${i}`, questionId: 'q2' })),
      ...Array.from({ length: 3 }, (_, i) => makeCoding({ id: `c3-${i}`, questionId: 'q3' })),
    );

    render(<CodeNavigator onFocusNode={onFocusNode} />);

    // Get all code name elements — they appear as truncated spans
    const codeNames = screen.getAllByText(/^(High|Mid|Low)$/);
    const nameOrder = codeNames.map(el => el.textContent);

    // Default sort is by count descending: High (5), Mid (3), Low (1)
    expect(nameOrder).toEqual(['High', 'Mid', 'Low']);
  });
});
