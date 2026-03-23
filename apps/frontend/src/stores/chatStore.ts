import { create } from 'zustand';
import type { ChatMessage } from '@qualcanvas/shared';
import { canvasApi } from '../services/api';

interface ChatState {
  messages: ChatMessage[];
  loading: boolean;
  indexing: boolean;
  indexed: boolean;
  error: string | null;

  loadHistory: (canvasId: string) => Promise<void>;
  sendMessage: (canvasId: string, message: string) => Promise<void>;
  indexCanvas: (canvasId: string) => Promise<void>;
  clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, _get) => ({
  messages: [],
  loading: false,
  indexing: false,
  indexed: false,
  error: null,

  loadHistory: async (canvasId: string) => {
    try {
      const res = await canvasApi.getChatHistory(canvasId);
      set({ messages: res.data.data, error: null });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to load chat history';
      set({ error: msg });
    }
  },

  sendMessage: async (canvasId: string, message: string) => {
    // Optimistically add user message
    const userMsg: ChatMessage = {
      id: `temp-${Date.now()}`,
      canvasId,
      role: 'user',
      content: message,
      citations: [],
      createdAt: new Date().toISOString(),
    };
    set((s) => ({ messages: [...s.messages, userMsg], loading: true, error: null }));

    try {
      const res = await canvasApi.chatQuery(canvasId, message);
      const assistantMsg: ChatMessage = res.data.data;
      set((s) => ({
        messages: [...s.messages, assistantMsg],
        loading: false,
      }));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send message';
      set({ loading: false, error: msg });
    }
  },

  indexCanvas: async (canvasId: string) => {
    set({ indexing: true, error: null });
    try {
      await canvasApi.embedCanvasData(canvasId);
      set({ indexing: false, indexed: true });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to index canvas data';
      set({ indexing: false, error: msg });
    }
  },

  clearMessages: () => set({ messages: [], error: null, indexed: false }),
}));
