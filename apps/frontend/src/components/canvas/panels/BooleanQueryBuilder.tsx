import { useState, useCallback } from 'react';
import type { CanvasQuestion } from '@canvas-app/shared';

interface BooleanCondition {
  questionId: string;
  operator: 'AND' | 'OR' | 'NOT' | 'NEAR';
  nearDistance?: number; // character distance for NEAR(n)
}

interface BooleanQueryBuilderProps {
  questions: CanvasQuestion[];
  initialConditions?: BooleanCondition[];
  onChange: (conditions: BooleanCondition[]) => void;
}

export default function BooleanQueryBuilder({
  questions,
  initialConditions = [],
  onChange,
}: BooleanQueryBuilderProps) {
  const [conditions, setConditions] = useState<BooleanCondition[]>(
    initialConditions.length > 0 ? initialConditions : [{ questionId: '', operator: 'AND' }]
  );

  const updateConditions = useCallback((newConditions: BooleanCondition[]) => {
    setConditions(newConditions);
    onChange(newConditions);
  }, [onChange]);

  const addCondition = useCallback(() => {
    updateConditions([...conditions, { questionId: '', operator: 'AND' }]);
  }, [conditions, updateConditions]);

  const removeCondition = useCallback((index: number) => {
    if (conditions.length <= 1) return;
    const newConds = conditions.filter((_, i) => i !== index);
    updateConditions(newConds);
  }, [conditions, updateConditions]);

  const updateCondition = useCallback((index: number, updates: Partial<BooleanCondition>) => {
    const newConds = conditions.map((c, i) =>
      i === index ? { ...c, ...updates } : c
    );
    updateConditions(newConds);
  }, [conditions, updateConditions]);

  const getQuestionLabel = (questionId: string) => {
    const q = questions.find(q => q.id === questionId);
    return q?.text || 'Select a code...';
  };

  return (
    <div className="space-y-2">
      <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-1">
        Boolean Query Conditions
      </label>

      {conditions.map((cond, idx) => (
        <div key={idx} className="flex items-center gap-2">
          {/* Operator (not shown for first condition) */}
          {idx > 0 && (
            <select
              value={cond.operator}
              onChange={(e) => updateCondition(idx, { operator: e.target.value as BooleanCondition['operator'] })}
              className="w-20 text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 font-medium"
            >
              <option value="AND">AND</option>
              <option value="OR">OR</option>
              <option value="NOT">NOT</option>
              <option value="NEAR">NEAR</option>
            </select>
          )}
          {idx === 0 && <div className="w-20" />}

          {/* Code selector */}
          <select
            value={cond.questionId}
            onChange={(e) => updateCondition(idx, { questionId: e.target.value })}
            className="flex-1 text-xs border border-gray-300 dark:border-gray-600 rounded px-2 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
          >
            <option value="">Select a code...</option>
            {questions.map(q => (
              <option key={q.id} value={q.id}>
                {q.text}
              </option>
            ))}
          </select>

          {/* NEAR distance input */}
          {cond.operator === 'NEAR' && (
            <div className="flex items-center gap-1">
              <span className="text-xs text-gray-500">(</span>
              <input
                type="number"
                min={1}
                max={10000}
                value={cond.nearDistance || 100}
                onChange={(e) => updateCondition(idx, { nearDistance: parseInt(e.target.value) || 100 })}
                className="w-16 text-xs border border-gray-300 dark:border-gray-600 rounded px-1.5 py-1 bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200"
                title="Character distance for NEAR proximity"
              />
              <span className="text-xs text-gray-500">chars)</span>
            </div>
          )}

          {/* Remove button */}
          <button
            onClick={() => removeCondition(idx)}
            disabled={conditions.length <= 1}
            className="text-gray-400 hover:text-red-500 disabled:opacity-30 disabled:cursor-not-allowed text-sm"
            title="Remove condition"
          >
            &times;
          </button>
        </div>
      ))}

      <button
        onClick={addCondition}
        className="text-xs text-blue-600 dark:text-blue-400 hover:text-blue-800 dark:hover:text-blue-300 font-medium"
      >
        + Add condition
      </button>

      {/* Query summary */}
      <div className="mt-2 p-2 bg-gray-50 dark:bg-gray-700/50 rounded text-xs text-gray-600 dark:text-gray-400">
        <span className="font-medium">Query: </span>
        {conditions
          .filter(c => c.questionId)
          .map((c, i) => {
            const label = getQuestionLabel(c.questionId);
            if (i === 0) return label;
            if (c.operator === 'NEAR') return ` NEAR(${c.nearDistance || 100}) ${label}`;
            return ` ${c.operator} ${label}`;
          })
          .join('')
          || 'No conditions set'}
      </div>
    </div>
  );
}
