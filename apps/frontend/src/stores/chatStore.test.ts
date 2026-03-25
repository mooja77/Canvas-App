import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useChatStore } from './chatStore';

// Mock the API module
vi.mock('../services/api', () => ({
  canvasApi: {
    getChatHistory: vi.fn(),
    chatQuery: vi.fn(),
    embedCanvasData: vi.fn(),
  },
}));

import { canvasApi } from '../services/api';

const mockGetChatHistory = vi.mocked(canvasApi.getChatHistory);
const mockChatQuery = vi.mocked(canvasApi.chatQuery);
const mockEmbedCanvasData = vi.mocked(canvasApi.embedCanvasData);

function resetStore() {
  useChatStore.setState({
    messages: [],
    loading: false,
    indexing: false,
    indexed: false,
    error: null,
  });
}

describe('chatStore', () => {
  beforeEach(() => {
    resetStore();
    vi.clearAllMocks();
  });

  describe('initial state', () => {
    it('has empty messages and is not loading', () => {
      const state = useChatStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.loading).toBe(false);
      expect(state.indexing).toBe(false);
      expect(state.indexed).toBe(false);
      expect(state.error).toBeNull();
    });
  });

  describe('sendMessage', () => {
    it('adds user message to state optimistically', async () => {
      mockChatQuery.mockResolvedValue({
        data: {
          data: {
            id: 'assistant-1',
            canvasId: 'c1',
            role: 'assistant' as const,
            content: 'Hello!',
            citations: [],
            createdAt: new Date().toISOString(),
          },
        },
      } as never);

      const promise = useChatStore.getState().sendMessage('c1', 'Hi there');

      // Check optimistic user message was added immediately
      const midState = useChatStore.getState();
      expect(midState.messages).toHaveLength(1);
      expect(midState.messages[0].role).toBe('user');
      expect(midState.messages[0].content).toBe('Hi there');
      expect(midState.loading).toBe(true);

      await promise;
    });

    it('sets loading=true during API call', async () => {
      let resolvePromise: (v: unknown) => void;
      const pending = new Promise((resolve) => { resolvePromise = resolve; });
      mockChatQuery.mockReturnValue(pending as never);

      const promise = useChatStore.getState().sendMessage('c1', 'test');
      expect(useChatStore.getState().loading).toBe(true);

      resolvePromise!({
        data: {
          data: {
            id: 'a1', canvasId: 'c1', role: 'assistant', content: 'response',
            citations: [], createdAt: new Date().toISOString(),
          },
        },
      });
      await promise;
      expect(useChatStore.getState().loading).toBe(false);
    });

    it('adds assistant response after API resolves', async () => {
      mockChatQuery.mockResolvedValue({
        data: {
          data: {
            id: 'assistant-1',
            canvasId: 'c1',
            role: 'assistant' as const,
            content: 'I can help!',
            citations: [],
            createdAt: new Date().toISOString(),
          },
        },
      } as never);

      await useChatStore.getState().sendMessage('c1', 'Help me');

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].role).toBe('user');
      expect(state.messages[1].role).toBe('assistant');
      expect(state.messages[1].content).toBe('I can help!');
      expect(state.loading).toBe(false);
    });

    it('sets error on API failure', async () => {
      mockChatQuery.mockRejectedValue(new Error('Network error'));

      await useChatStore.getState().sendMessage('c1', 'Hi');

      const state = useChatStore.getState();
      expect(state.loading).toBe(false);
      expect(state.error).toBe('Network error');
      // User message should still be there from optimistic add
      expect(state.messages).toHaveLength(1);
    });
  });

  describe('loadHistory', () => {
    it('populates messages from API', async () => {
      const historyMessages = [
        { id: 'm1', canvasId: 'c1', role: 'user' as const, content: 'Q1', citations: [], createdAt: '2024-01-01' },
        { id: 'm2', canvasId: 'c1', role: 'assistant' as const, content: 'A1', citations: [], createdAt: '2024-01-02' },
      ];
      mockGetChatHistory.mockResolvedValue({ data: { data: historyMessages } } as never);

      await useChatStore.getState().loadHistory('c1');

      const state = useChatStore.getState();
      expect(state.messages).toHaveLength(2);
      expect(state.messages[0].content).toBe('Q1');
      expect(state.messages[1].content).toBe('A1');
      expect(state.error).toBeNull();
    });

    it('handles empty history', async () => {
      mockGetChatHistory.mockResolvedValue({ data: { data: [] } } as never);

      await useChatStore.getState().loadHistory('c1');

      expect(useChatStore.getState().messages).toEqual([]);
      expect(useChatStore.getState().error).toBeNull();
    });

    it('sets error when loadHistory fails', async () => {
      mockGetChatHistory.mockRejectedValue(new Error('Server down'));

      await useChatStore.getState().loadHistory('c1');

      expect(useChatStore.getState().error).toBe('Server down');
    });
  });

  describe('indexCanvas', () => {
    it('sets indexing=true during indexing and indexed=true on success', async () => {
      let resolvePromise: (v: unknown) => void;
      const pending = new Promise((resolve) => { resolvePromise = resolve; });
      mockEmbedCanvasData.mockReturnValue(pending as never);

      const promise = useChatStore.getState().indexCanvas('c1');
      expect(useChatStore.getState().indexing).toBe(true);
      expect(useChatStore.getState().error).toBeNull();

      resolvePromise!({});
      await promise;

      expect(useChatStore.getState().indexing).toBe(false);
      expect(useChatStore.getState().indexed).toBe(true);
    });

    it('handles indexing error', async () => {
      mockEmbedCanvasData.mockRejectedValue(new Error('Index failed'));

      await useChatStore.getState().indexCanvas('c1');

      expect(useChatStore.getState().indexing).toBe(false);
      expect(useChatStore.getState().error).toBe('Index failed');
    });
  });

  describe('clearMessages', () => {
    it('resets messages, error, and indexed state', async () => {
      // Set up some state
      useChatStore.setState({
        messages: [{ id: 'm1', canvasId: 'c1', role: 'user', content: 'test', citations: [], createdAt: '' }],
        error: 'some error',
        indexed: true,
      });

      useChatStore.getState().clearMessages();

      const state = useChatStore.getState();
      expect(state.messages).toEqual([]);
      expect(state.error).toBeNull();
      expect(state.indexed).toBe(false);
    });
  });
});
