import { useEffect, useRef, useState, useCallback } from 'react';
import { getSocket, disconnectSocket, isSocketConnected } from '../lib/socket';
import { useAuthStore } from '../stores/authStore';
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
}

const CURSOR_THROTTLE_MS = 50;

export function useCollaboration({ canvasId, enabled = true }: UseCollaborationOptions): UseCollaborationReturn {
  const [collaborators, setCollaborators] = useState<CollaboratorPresence[]>([]);
  const [cursors, setCursors] = useState<Map<string, { x: number; y: number; name: string; color: string }>>(new Map());
  const [isConnected, setIsConnected] = useState(false);
  const socketRef = useRef<Socket | null>(null);
  const lastCursorEmit = useRef(0);

  const jwt = useAuthStore(s => s.jwt);
  const authType = useAuthStore(s => s.authType);

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
        // Find the collaborator to get their color
        const collab = collaborators.find(c => c.userId === data.userId);
        next.set(data.userId, {
          x: data.x,
          y: data.y,
          name: data.userName,
          color: collab?.color || '#3B82F6',
        });
        return next;
      });
    };

    socket.on('connect', handleConnect);
    socket.on('disconnect', handleDisconnect);
    socket.on('presence:updated', handlePresenceUpdated);
    socket.on('presence:current', handlePresenceCurrent);
    socket.on('cursor:moved', handleCursorMoved);

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

  return {
    collaborators,
    cursors,
    isConnected,
    emitNodeMove,
    emitCanvasChange,
  };
}
