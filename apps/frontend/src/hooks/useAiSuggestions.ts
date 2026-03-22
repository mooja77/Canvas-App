import { useState, useCallback } from 'react';
import { canvasApi } from '../services/api';
import { useCanvasStore, useActiveCanvasId } from '../stores/canvasStore';
import type { AiSuggestion } from '@canvas-app/shared';
import toast from 'react-hot-toast';

export function useAiSuggestions() {
  const [suggestions, setSuggestions] = useState<AiSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const activeCanvasId = useActiveCanvasId();

  const suggestCodes = useCallback(
    async (transcriptId: string, codedText: string, startOffset: number, endOffset: number) => {
      if (!activeCanvasId) return;
      setLoading(true);
      try {
        const res = await canvasApi.aiSuggestCodes(activeCanvasId, {
          transcriptId,
          codedText,
          startOffset,
          endOffset,
        });
        const newSuggestions: AiSuggestion[] = res.data.data;
        setSuggestions((prev) => [...newSuggestions, ...prev]);
        return newSuggestions;
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'AI suggestion failed';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [activeCanvasId],
  );

  const autoCodeTranscript = useCallback(
    async (transcriptId: string, instructions?: string) => {
      if (!activeCanvasId) return;
      setLoading(true);
      try {
        const res = await canvasApi.aiAutoCodeTranscript(activeCanvasId, {
          transcriptId,
          instructions,
        });
        const { suggestions: newSuggestions } = res.data.data;
        setSuggestions((prev) => [...(newSuggestions || []), ...prev]);
        toast.success(`AI found ${newSuggestions?.length || 0} coding suggestions`);
        return newSuggestions;
      } catch (err: unknown) {
        const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Auto-code failed';
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    [activeCanvasId],
  );

  const fetchSuggestions = useCallback(
    async (transcriptId?: string) => {
      if (!activeCanvasId) return;
      try {
        const res = await canvasApi.getAiSuggestions(activeCanvasId, {
          status: 'pending',
          transcriptId,
        });
        setSuggestions(res.data.data);
      } catch {
        // silent
      }
    },
    [activeCanvasId],
  );

  const acceptSuggestion = useCallback(
    async (suggestionId: string) => {
      if (!activeCanvasId) return;
      try {
        await canvasApi.updateAiSuggestion(activeCanvasId, suggestionId, { status: 'accepted' });
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
        // Refresh canvas to pick up new codings
        useCanvasStore.getState().refreshCanvas();
        toast.success('Suggestion accepted');
      } catch {
        toast.error('Failed to accept suggestion');
      }
    },
    [activeCanvasId],
  );

  const rejectSuggestion = useCallback(
    async (suggestionId: string) => {
      if (!activeCanvasId) return;
      try {
        await canvasApi.updateAiSuggestion(activeCanvasId, suggestionId, { status: 'rejected' });
        setSuggestions((prev) => prev.filter((s) => s.id !== suggestionId));
      } catch {
        toast.error('Failed to reject suggestion');
      }
    },
    [activeCanvasId],
  );

  const bulkAction = useCallback(
    async (suggestionIds: string[], action: 'accepted' | 'rejected') => {
      if (!activeCanvasId) return;
      try {
        await canvasApi.bulkActionAiSuggestions(activeCanvasId, { suggestionIds, action });
        setSuggestions((prev) => prev.filter((s) => !suggestionIds.includes(s.id)));
        if (action === 'accepted') {
          useCanvasStore.getState().refreshCanvas();
          toast.success(`${suggestionIds.length} suggestions accepted`);
        }
      } catch {
        toast.error(`Failed to ${action === 'accepted' ? 'accept' : 'reject'} suggestions`);
      }
    },
    [activeCanvasId],
  );

  return {
    suggestions,
    loading,
    suggestCodes,
    autoCodeTranscript,
    fetchSuggestions,
    acceptSuggestion,
    rejectSuggestion,
    bulkAction,
    clearSuggestions: () => setSuggestions([]),
  };
}
