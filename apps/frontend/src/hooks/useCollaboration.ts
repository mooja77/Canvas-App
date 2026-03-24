import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket } from '../lib/socket';
import { useAuthStore } from '../stores/authStore';
import { useCanvasStore } from '../stores/canvasStore';
import type { Socket } from 'socket.io-client';

export interface CollaboratorPresence {
  userId: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
}

interface UseCollaborationOptions {
  canvasId: string | null;
  enabled?: boolean;
}

interface UseCollaborationReturn {
  collaborators: CollaboratorPresence[];
  cursors: Map<string, { x: number; y: number; name: string; color: string }>;
  isConnected: boolean;
  emitNodeMove: (nodeId: string, x: number, y: number) => void;
  emitCanvasChange: (changeType: string, payload?: unknown) => void;
  emitNodeAdded: (canvasId: string, nodeData: { type: string; id: string }) => void;
  emitNodeDeleted: (canvasId: string, nodeId: string, nodeType: string) => void;
  emitNodeMoved: (canvasId: string, nodeId: string, position: { x: number; y: number }) => void;
  emitCodingAdded: (canvasId: string, coding: { id: string; transcriptId: string; questionId: string }) => void;
  emitCodingDeleted: (canvasId: string, codingId: string) => void;
  emitTranscriptUpdated: (canvasId: string, transcriptId: string) => void;
}

const CURSOR_THROTTLE_MS = 50;
const NODE_MOVE_THROTTLE_MS = 100; // max 10 per second

export function useCollaboration({ canvasId, enabled = true }: UseCollaborationOptions): UseCollaborationReturn {
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);
  const [cursors, setCursors] = useState<Map<string, { x: number; y: number; name: string; color: string }>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const lastCursorEmit = useRef(0);
  const lastNodeMoveEmit = useRef(0);

  const jwt = useAuthStore(s => s.jwt);
  const authType = useAuthStore(s => s.authType);
  const localUserId = useAuthStore(s => s.userId);

  useEffect(() => {
    // Only connect for email-authenticated users with a valid canvas
    if (!enabled || !canvasId || !jwt || authType !== 'email') {
      return;
    }

    const socket = getSocket(jwt);
    socketRef.current = socket;

    const handleConnect = () => {
      setIsConnected(true);
      socket.emit('canvas:join', { canvasId });
    };

    const handleDisconnect = () => {
      setIsConnected(false);
    };

    const handlePresenceUpdated = (data: { canvasId: string; users: CollaboratorPresence[] }) => {
      if (data.canvasId === canvasId) {
        setCollaborators(data.users);
      }
    };

    const handlePresenceCurrent = (data: { canvasId: string; users: CollaboratorPresence[]; self: CollaboratorPresence }) => {
      if (data.canvasId === canvasId) {
        setCollaborators(data.users);
      }
    };

    const handleCursorMoved = (data: { userId: string; userName: string; x: number; y: number }) => {
      setCursors(prev => {
        const next = new Map(prev);
        // Color from collaborator list is not available in this closure to avoid
        // re-subscribing on every collaborator change; use a default color instead
        next.set(data.userId, {
          x: data.x,
          y: data.y,
          name: data.userName,
          color: '#3B82F6',
        });
        return next;
      });
    };

    // ─── Document sync listeners ───

    const handleNodeAdded = (eventData: { userId: string; data: unknown }) => {
      // Skip events from the local user — local state is already up to date
      if (eventData.userId === localUserId) return;
      useCanvasStore.getState().refreshCanvas();
    };

    const handleNodeDeleted = (data: { userId: string; data: { nodeId: string; nodeType: string } }) => {
      if (data.userId === localUserId) return;
      const store = useCanvasStore.getState();
      const ac = store.activeCanvas;
      if (!ac) return;
      const { nodeId, nodeType } = data.data;
      useCanvasStore.setState({
        activeCanvas: {
          ...ac,
          transcripts: nodeType === 'transcript' ? ac.transcripts.filter(t => t.id !== nodeId) : ac.transcripts,
          questions: nodeType === 'question' ? ac.questions.filter(q => q.id !== nodeId) : ac.questions,
          memos: nodeType === 'memo' ? ac.memos.filter(m => m.id !== nodeId) : ac.memos,
          cases: nodeType === 'case' ? ac.cases.filter(c => c.id !== nodeId) : ac.cases,
          computedNodes: nodeType === 'computed' ? ac.computedNodes.filter(n => n.id !== nodeId) : ac.computedNodes,
          // Also remove codings that reference deleted transcript/question
          codings: nodeType === 'transcript'
            ? ac.codings.filter(c => c.transcriptId !== nodeId)
            : nodeType === 'question'
              ? ac.codings.filter(c => c.questionId !== nodeId)
              : ac.codings,
        },
      });
    };

    const handleNodeMoved = (data: { userId: string; data: { nodeId: string; position: { x: number; y: number } } }) => {
      if (data.userId === localUserId) return;
      const store = useCanvasStore.getState();
      const ac = store.activeCanvas;
      if (!ac) return;
      const { nodeId, position } = data.data;
      useCanvasStore.setState({
        activeCanvas: {
          ...ac,
          nodePositions: ac.nodePositions.map(np =>
            np.nodeId === nodeId ? { ...np, x: position.x, y: position.y } : np
          ),
        },
      });
    };

    const handleCodingAdded = (eventData: { userId: string; data: unknown }) => {
      if (eventData.userId === localUserId) return;
      useCanvasStore.getState().refreshCanvas();
    };

    const handleCodingDeleted = (data: { userId: string; data: { codingId: string } }) => {
      if (data.userId === localUserId) return;
      const store = useCanvasStore.getState();
      const ac = store.activeCanvas;
      if (!ac) return;
      useCanvasStore.setState({
        activeCanvas: {
          ...ac,
          codings: ac.codings.filter(c => c.id !== data.data.codingId),
        },
      });
    };

    const handleTranscriptUpdated = (eventData: { userId: string; data: { transcriptId: string } }) => {
      if (eventData.userId === localUserId) return;
      useCanvasStore.getState().refreshCanvas();
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('presence:updated', handlePresenceUpdated);
    socket.on('presence:current', handlePresenceCurrent);
    socket.on('cursor:moved', handleCursorMoved);
    socket.on('canvas:node-added', handleNodeAdded);
    socket.on('canvas:node-deleted', handleNodeDeleted);
    socket.on('canvas:node-moved', handleNodeMoved);
    socket.on('canvas:coding-added', handleCodingAdded);
    socket.on('canvas:coding-deleted', handleCodingDeleted);
    socket.on('canvas:transcript-updated', handleTranscriptUpdated);

    // If already connected, join immediately
    if (socket.connected) {
      handleConnect();
    }

    return () => {
      socket.off('connect', handleConnect);
      socket.off('disconnect', handleDisconnect);
      socket.off('presence:updated', handlePresenceUpdated);
      socket.off('presence:current', handlePresenceCurrent);
      socket.off('cursor:moved', handleCursorMoved);
      socket.off('canvas:node-added', handleNodeAdded);
      socket.off('canvas:node-deleted', handleNodeDeleted);
      socket.off('canvas:node-moved', handleNodeMoved);
      socket.off('canvas:coding-added', handleCodingAdded);
      socket.off('canvas:coding-deleted', handleCodingDeleted);
      socket.off('canvas:transcript-updated', handleTranscriptUpdated);
      socket.emit('canvas:leave', { canvasId });
    };
  }, [canvasId, jwt, authType, enabled]);

  // Throttled cursor emission via mousemove (called from the component)
  useEffect(() => {
    if (!enabled || !canvasId || !socketRef.current) return;

    const handleMouseMove = (e: MouseEvent) => {
      const now = Date.now();
      if (now - lastCursorEmit.current < CURSOR_THROTTLE_MS) return;
      lastCursorEmit.current = now;

      socketRef.current?.emit('cursor:move', {
        canvasId,
        x: e.clientX,
        y: e.clientY,
      });
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, [canvasId, enabled]);

  const emitNodeMove = useCallback((nodeId: string, x: number, y: number) => {
    if (!canvasId || !socketRef.current) return;
    socketRef.current.emit('node:move', { canvasId, nodeId, x, y });
  }, [canvasId]);

  const emitCanvasChange = useCallback((changeType: string, payload?: unknown) => {
    if (!canvasId || !socketRef.current) return;
    socketRef.current.emit('canvas:change', { canvasId, changeType, payload });
  }, [canvasId]);

  // ─── Document sync emit functions ───

  const emitNodeAdded = useCallback((cid: string, nodeData: { type: string; id: string }) => {
    if (!socketRef.current) return;
    socketRef.current.emit('canvas:node-added', { canvasId: cid, data: nodeData });
  }, []);

  const emitNodeDeleted = useCallback((cid: string, nodeId: string, nodeType: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('canvas:node-deleted', { canvasId: cid, data: { nodeId, nodeType } });
  }, []);

  const emitNodeMoved = useCallback((cid: string, nodeId: string, position: { x: number; y: number }) => {
    if (!socketRef.current) return;
    // Throttle to max 10 per second
    const now = Date.now();
    if (now - lastNodeMoveEmit.current < NODE_MOVE_THROTTLE_MS) return;
    lastNodeMoveEmit.current = now;
    socketRef.current.emit('canvas:node-moved', { canvasId: cid, data: { nodeId, position } });
  }, []);

  const emitCodingAdded = useCallback((cid: string, coding: { id: string; transcriptId: string; questionId: string }) => {
    if (!socketRef.current) return;
    socketRef.current.emit('canvas:coding-added', { canvasId: cid, data: coding });
  }, []);

  const emitCodingDeleted = useCallback((cid: string, codingId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('canvas:coding-deleted', { canvasId: cid, data: { codingId } });
  }, []);

  const emitTranscriptUpdated = useCallback((cid: string, transcriptId: string) => {
    if (!socketRef.current) return;
    socketRef.current.emit('canvas:transcript-updated', { canvasId: cid, data: { transcriptId } });
  }, []);

  return {
    collaborators,
    cursors,
    isConnected,
    emitNodeMove,
    emitCanvasChange,
    emitNodeAdded,
    emitNodeDeleted,
    emitNodeMoved,
    emitCodingAdded,
    emitCodingDeleted,
    emitTranscriptUpdated,
  };
}
