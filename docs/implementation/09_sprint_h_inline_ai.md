# Sprint H — Inline AI Tag Suggestions on Text Highlight

## Goal

Ship Dovetail's killer feature: when a researcher highlights text in a transcript, a popover appears with 3 AI-suggested codes (with confidence scores + reasoning), each instantly applicable. Streaming response, two-phase tray integration, citation-linked.

## Scope

- `InlineCodeSuggester` component (floating popover on text selection)
- Backend streaming endpoint `POST /api/v1/canvas/:id/ai/suggest-codes-inline` (SSE)
- Cache by transcript hash + selection hash (1hr TTL)
- Two-phase: pending suggestions go to existing `AiSuggestion` table OR optional instant-apply
- "+ New code from suggestion" inline create
- "Why these?" explainability popover with citations
- Telemetry events

## Out of scope

- Magic Cluster (separate sprint)
- Cmd+J context-bound AI chat (separate sprint)
- Few-shot prompt examples (Sprint 11 prompt upgrades — can ship in parallel)

## File-level changes

### 1. Frontend component

**`C:\JM Programs\QualCanvas\apps\frontend\src\components\transcript\InlineCodeSuggester.tsx`** (new):

```tsx
import { useEffect, useState, useRef } from 'react';
import { FloatingPopover } from '@/components/FloatingPopover';
import { CodeChip } from '@/components/canvas/CodeChip';
import { ConfidenceBar } from '@/components/canvas/ConfidenceBar';
import { useAiSuggestions } from '@/hooks/useAiSuggestions';

interface Selection {
  text: string;
  startOffset: number;
  endOffset: number;
  rect: DOMRect; // for popover anchor
}

interface CodeSuggestion {
  id: string; // existing code id, or 'new-<uuid>' if new
  label: string;
  color: string;
  confidence: number;
  reasoning: string;
  isNew: boolean;
}

export function InlineCodeSuggester({
  transcriptId,
  canvasId,
  selection,
  onClose,
}: {
  transcriptId: string;
  canvasId: string;
  selection: Selection | null;
  onClose: () => void;
}) {
  const [suggestions, setSuggestions] = useState<CodeSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [newCodeName, setNewCodeName] = useState('');
  const { applyCoding, createCodeFromSuggestion } = useAiSuggestions();

  useEffect(() => {
    if (!selection?.text || selection.text.trim().length < 5) return;

    setLoading(true);
    setStreaming(true);
    setSuggestions([]);

    const eventSource = new EventSource(
      `/api/v1/canvas/${canvasId}/ai/suggest-codes-inline?` +
        `transcriptId=${transcriptId}&` +
        `startOffset=${selection.startOffset}&` +
        `endOffset=${selection.endOffset}&` +
        `text=${encodeURIComponent(selection.text)}`,
      { withCredentials: true },
    );

    eventSource.addEventListener('suggestion', (e: MessageEvent) => {
      const s = JSON.parse(e.data);
      setSuggestions((prev) => [...prev, s]);
    });

    eventSource.addEventListener('done', () => {
      setStreaming(false);
      setLoading(false);
      eventSource.close();
    });

    eventSource.addEventListener('error', () => {
      setLoading(false);
      setStreaming(false);
      eventSource.close();
    });

    return () => eventSource.close();
  }, [selection, transcriptId, canvasId]);

  const handleApply = async (suggestion: CodeSuggestion) => {
    let codeId = suggestion.id;
    if (suggestion.isNew) {
      const newCode = await createCodeFromSuggestion({
        canvasId,
        text: suggestion.label,
        color: suggestion.color,
      });
      codeId = newCode.id;
    }
    await applyCoding({
      canvasId,
      transcriptId,
      questionId: codeId,
      startOffset: selection!.startOffset,
      endOffset: selection!.endOffset,
      codedText: selection!.text,
    });
    // Telemetry
    trackEvent('inline_ai_accepted', { confidence: suggestion.confidence, was_new: suggestion.isNew });
    onClose();
  };

  if (!selection) return null;

  return (
    <FloatingPopover anchor={selection.rect} onClose={onClose}>
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 p-3 w-96 max-w-md">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-white">
            ✨ AI suggestions
            {streaming && <span className="ml-2 text-xs text-gray-500 animate-pulse">thinking…</span>}
          </h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            ×
          </button>
        </div>

        <div className="space-y-2">
          {suggestions.map((s, i) => (
            <button
              key={i}
              onClick={() => handleApply(s)}
              className="w-full flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors text-left"
            >
              <CodeChip color={s.color} />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{s.label}</span>
                  {s.isNew && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded">new</span>}
                </div>
                <ConfidenceBar value={s.confidence} className="mt-1" />
              </div>
              <span className="text-xs text-gray-400">Apply</span>
            </button>
          ))}
        </div>

        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <input
            type="text"
            value={newCodeName}
            onChange={(e) => setNewCodeName(e.target.value)}
            placeholder="Or create new code..."
            className="w-full px-3 py-1.5 text-sm border rounded-md"
            onKeyDown={async (e) => {
              if (e.key === 'Enter' && newCodeName.trim()) {
                await handleApply({
                  id: `new-${Date.now()}`,
                  label: newCodeName.trim(),
                  color: '#3B82F6',
                  confidence: 1.0,
                  reasoning: 'User-created',
                  isNew: true,
                });
              }
            }}
          />
        </div>

        {suggestions.length > 0 && (
          <button onClick={() => setShowWhy(!showWhy)} className="mt-2 text-xs text-gray-500 hover:text-gray-700">
            Why these suggestions? →
          </button>
        )}
      </div>
    </FloatingPopover>
  );
}
```

### 2. Hook integration

**`C:\JM Programs\QualCanvas\apps\frontend\src\components\canvas\nodes\TranscriptNode.tsx`** (add selection handler):

```tsx
const [selection, setSelection] = useState<Selection | null>(null);
const [showSuggester, setShowSuggester] = useState(false);

const handleMouseUp = () => {
  const sel = window.getSelection();
  if (sel && sel.toString().trim().length > 5) {
    const range = sel.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    // Calculate offsets within transcript text
    setSelection({
      text: sel.toString(),
      startOffset: /* compute */,
      endOffset: /* compute */,
      rect,
    });
    setShowSuggester(true);
  }
};

return (
  <>
    <div onMouseUp={handleMouseUp}>{transcript.content}</div>
    {showSuggester && (
      <InlineCodeSuggester
        transcriptId={data.transcriptId}
        canvasId={data.canvasId}
        selection={selection}
        onClose={() => { setShowSuggester(false); setSelection(null); }}
      />
    )}
  </>
);
```

### 3. Backend streaming endpoint

**`C:\JM Programs\QualCanvas\apps\backend\src\routes\aiRoutes.ts`** (add):

```typescript
import { buildSuggestCodesPrompt } from '../utils/aiPrompts';
import { getCachedSuggestion, setCachedSuggestion } from '../utils/aiCache';

router.get('/canvas/:id/ai/suggest-codes-inline', requireAuth, checkAiAccess(), async (req, res) => {
  const { transcriptId, startOffset, endOffset, text } = req.query;
  const canvasId = req.params.id;

  // SSE setup
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Check cache (transcript hash + selection hash)
  const cacheKey = `${canvasId}:${transcriptId}:${sha256(text as string)}`;
  const cached = await getCachedSuggestion(cacheKey);
  if (cached) {
    for (const s of cached.suggestions) {
      res.write(`event: suggestion\ndata: ${JSON.stringify(s)}\n\n`);
    }
    res.write('event: done\ndata: {}\n\n');
    res.end();
    return;
  }

  // Fetch context
  const transcript = await prisma.canvasTranscript.findUnique({
    where: { id: transcriptId as string },
  });
  const existingCodes = await prisma.canvasQuestion.findMany({
    where: { canvasId },
    select: { id: true, text: true, color: true },
  });

  const contextWindow = 500;
  const contextBefore = transcript.content.slice(Math.max(0, Number(startOffset) - contextWindow), Number(startOffset));
  const contextAfter = transcript.content.slice(
    Number(endOffset),
    Math.min(transcript.content.length, Number(endOffset) + contextWindow),
  );

  const messages = buildSuggestCodesPrompt({
    codedText: text as string,
    transcriptTitle: transcript.title,
    transcriptContext: `${contextBefore} **[HIGHLIGHTED]** ${contextAfter}`,
    existingCodes,
  });

  // Stream from LLM
  const llmConfig = await resolveAiConfig(req.userId);
  const provider = getLlmProvider(llmConfig);

  const stream = await provider.completeStreaming({ messages, temperature: 0.3, maxTokens: 1024 });
  let buffer = '';
  const collected: any[] = [];

  for await (const chunk of stream) {
    buffer += chunk;
    // Parse JSON suggestions as they stream (each is a complete JSON object)
    const matches = buffer.matchAll(/\{[^{}]*"questionId"[^{}]*\}/g);
    for (const m of matches) {
      try {
        const s = JSON.parse(m[0]);
        const enriched = {
          id: s.questionId || `new-${Date.now()}`,
          label: s.suggestedText,
          color: s.questionId ? existingCodes.find((c) => c.id === s.questionId)?.color : '#3B82F6',
          confidence: s.confidence,
          reasoning: s.reasoning,
          isNew: !s.questionId,
        };
        collected.push(enriched);
        res.write(`event: suggestion\ndata: ${JSON.stringify(enriched)}\n\n`);
      } catch {
        /* incomplete JSON, wait */
      }
    }
  }

  // Save to cache + AiUsage
  await setCachedSuggestion(cacheKey, { suggestions: collected }, 3600);
  await prisma.aiUsage.create({
    data: { userId: req.userId, canvasId, feature: 'suggest_codes_inline' /* ... */ },
  });

  res.write('event: done\ndata: {}\n\n');
  res.end();
});
```

### 4. Cache helper

**`C:\JM Programs\QualCanvas\apps\backend\src\utils\aiCache.ts`** (new):

Simple in-memory LRU cache for 1hr TTL. Optional Redis upgrade later.

```typescript
import LRU from 'lru-cache';

const cache = new LRU<string, any>({ max: 1000, ttl: 1000 * 60 * 60 });

export async function getCachedSuggestion(key: string) {
  return cache.get(key);
}

export async function setCachedSuggestion(key: string, value: any, ttlSeconds: number) {
  cache.set(key, value, { ttl: ttlSeconds * 1000 });
}
```

### 5. Two-phase tray (optional inline-apply OR queue to tray)

Add user preference: "Apply AI suggestions immediately" vs "Queue for batch review". Default: immediate (for inline flow). Falls back to existing `AiSuggestPanel` tray when batch flow used.

## Tests

- Unit: cache key consistency (same transcript + same selection → same cache hit)
- E2E: highlight text in transcript → popover appears within 2s → click suggestion → coding created
- E2E: "+ New code" inline → new code created + applied
- E2E: cache hit on second selection of same text → no API call (verify with network mock)
- Backend: streaming endpoint sends each suggestion as `event: suggestion` SSE
- Backend: AiUsage row created per call

## Acceptance criteria

- [ ] InlineCodeSuggester component implemented
- [ ] Streaming endpoint live, SSE working
- [ ] Cache hit rate >50% on repeated selections (verified via cache metrics)
- [ ] "+ New code" inline create works
- [ ] "Why these?" explainability popover shows reasoning per suggestion
- [ ] Telemetry events firing: `inline_ai_triggered`, `inline_ai_accepted`, `inline_ai_rejected`, `inline_ai_new_code`
- [ ] Works on Pro tier (trial credits or BYOK key)
- [ ] Free tier with trial credits: shows "X requests remaining today"
- [ ] Mobile: popover positions correctly on touch selection

## Rollback

- Feature flag `INLINE_AI_SUGGESTER_ENABLED`
- Disable removes the mouseUp handler; users use existing AI auto-code modal

## Telemetry

- `inline_ai_triggered` { selection_length, transcript_id }
- `inline_ai_accepted` { confidence, was_new, time_to_accept_ms }
- `inline_ai_rejected` { reason: 'closed' | 'new_code' | 'timeout' }
- `inline_ai_new_code` { code_text, color }
- `inline_ai_cache_hit` { boolean }

Target: median time-from-selection-to-applied-code <8 seconds.

## Effort

**4 days.** Component (1 day) + backend streaming (1 day) + cache (0.5 day) + integration into TranscriptNode (0.5 day) + tests (1 day).

## Owner

TBD

## Commit message

```
feat(ai): inline AI tag suggestions on text highlight (Dovetail-style)

- Floating popover on text selection in TranscriptNode
- Streams 3 AI suggestions with confidence + reasoning via SSE
- One-click apply or "+ New code" inline create
- 1hr cache on (transcriptId, selection_hash) → 50%+ hit rate expected
- Two-phase: immediate apply OR queue to existing AiSuggestPanel tray
- "Why these?" explainability with per-suggestion reasoning
- Telemetry: inline_ai_triggered/accepted/rejected/new_code/cache_hit

Single biggest "magic moment" researchers will switch tools for.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
