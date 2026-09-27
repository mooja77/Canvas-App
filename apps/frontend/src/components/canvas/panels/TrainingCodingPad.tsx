import { useId, useMemo, useRef, useState } from 'react';
import type { CanvasQuestion } from '@qualcanvas/shared';

export interface PadCoding {
  questionId: string;
  startOffset: number;
  endOffset: number;
  codedText: string;
}

/**
 * Code a transcript inside the training centre, without touching the canvas.
 *
 * The transcript sits in a read-only textarea, so a passage can be selected
 * with the mouse, touch, or the keyboard (Shift+arrow keys) and screen readers
 * read it as ordinary text. The selection offsets are exactly the transcript
 * offsets the server scores against.
 */
export default function TrainingCodingPad({
  content,
  questions,
  codings,
  onChange,
  label,
  disabled = false,
}: {
  content: string;
  questions: CanvasQuestion[];
  codings: PadCoding[];
  onChange: (next: PadCoding[]) => void;
  label: string;
  disabled?: boolean;
}) {
  const id = useId();
  const areaRef = useRef<HTMLTextAreaElement>(null);
  const [sel, setSel] = useState<{ start: number; end: number }>({ start: 0, end: 0 });
  const [codeId, setCodeId] = useState(questions[0]?.id ?? '');
  const codeText = (qid: string) => questions.find((q) => q.id === qid)?.text ?? 'Deleted code';
  const colour = (qid: string) => questions.find((q) => q.id === qid)?.color ?? '#9ca3af';

  // A textarea normalises CR LF to LF, which would shift every offset after a
  // Windows line break. Map displayed positions back to transcript offsets.
  const { shown, toOriginal } = useMemo(() => {
    if (!content.includes('\r')) return { shown: content, toOriginal: null as number[] | null };
    const map: number[] = [];
    let out = '';
    for (let i = 0; i < content.length; i += 1) {
      if (content[i] === '\r' && content[i + 1] === '\n') continue;
      map.push(i);
      out += content[i] === '\r' ? '\n' : content[i];
    }
    map.push(content.length);
    return { shown: out, toOriginal: map };
  }, [content]);

  const readSelection = () => {
    const el = areaRef.current;
    if (!el) return;
    const a = el.selectionStart ?? 0;
    const b = el.selectionEnd ?? 0;
    setSel(toOriginal ? { start: toOriginal[a] ?? a, end: toOriginal[b] ?? b } : { start: a, end: b });
  };

  // Trim surrounding whitespace so a sloppy drag still scores as the phrase.
  let start = sel.start;
  let end = sel.end;
  while (start < end && /\s/.test(content[start])) start += 1;
  while (end > start && /\s/.test(content[end - 1])) end -= 1;
  const hasSelection = end > start;
  const duplicate = codings.some((c) => c.questionId === codeId && c.startOffset === start && c.endOffset === end);

  const add = () => {
    if (!hasSelection || !codeId || duplicate) return;
    const next = [
      ...codings,
      { questionId: codeId, startOffset: start, endOffset: end, codedText: content.slice(start, end) },
    ];
    next.sort((a, b) => a.startOffset - b.startOffset || a.endOffset - b.endOffset);
    onChange(next);
    setSel({ start: end, end });
    areaRef.current?.focus();
  };

  return (
    <div className="space-y-2">
      <label htmlFor={`${id}-text`} className="label text-sm">
        {label}
      </label>
      <p id={`${id}-help`} className="text-xs text-gray-500 dark:text-gray-400">
        Select a passage with the mouse, or with Shift + arrow keys, then choose a code and press “Add coding”.
      </p>
      <textarea
        id={`${id}-text`}
        ref={areaRef}
        readOnly
        value={shown}
        rows={10}
        aria-describedby={`${id}-help`}
        onSelect={readSelection}
        onKeyUp={readSelection}
        onMouseUp={readSelection}
        className="input font-serif text-sm leading-relaxed"
        data-testid="training-transcript"
      />
      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[10rem] flex-1">
          <span className="text-xs text-gray-600 dark:text-gray-300">Code</span>
          <select
            className="input mt-0.5 text-sm"
            value={codeId}
            onChange={(e) => setCodeId(e.target.value)}
            disabled={disabled}
            aria-label="Code for the selected passage"
          >
            {questions.map((q) => (
              <option key={q.id} value={q.id}>
                {q.text}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn-secondary px-3 py-2 text-sm"
          onClick={add}
          disabled={disabled || !hasSelection || !codeId || duplicate}
        >
          Add coding
        </button>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400" aria-live="polite">
        {hasSelection
          ? `Selected: “${content.slice(start, Math.min(end, start + 120))}${end - start > 120 ? '…' : ''}”`
          : 'Nothing selected yet.'}
      </p>
      <div>
        <h5 className="text-xs font-semibold uppercase tracking-wide text-gray-500">Codings ({codings.length})</h5>
        {codings.length === 0 ? (
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">None yet.</p>
        ) : (
          <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto" data-testid="pad-codings">
            {codings.map((c, i) => (
              <li
                key={`${c.questionId}-${c.startOffset}-${c.endOffset}`}
                className="flex items-start justify-between gap-2 rounded border border-gray-200 p-1.5 text-xs dark:border-gray-700"
              >
                <span className="min-w-0">
                  <span className="font-medium" style={{ color: colour(c.questionId) }}>
                    {codeText(c.questionId)}
                  </span>{' '}
                  <span className="text-gray-600 dark:text-gray-300">
                    “{c.codedText.slice(0, 140)}
                    {c.codedText.length > 140 ? '…' : ''}”
                  </span>
                </span>
                {!disabled && (
                  <button
                    type="button"
                    className="shrink-0 text-red-600 hover:underline"
                    aria-label={`Remove coding ${i + 1}`}
                    onClick={() => onChange(codings.filter((_, j) => j !== i))}
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
