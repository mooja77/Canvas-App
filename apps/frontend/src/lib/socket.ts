import { io, Socket } from 'socket.io-client';

let socket: Socket | null = null;

const SOCKET_URL =
  import.meta.env.VITE_WS_URL ||
  (import.meta.env.VITE_API_URL ? new URL(import.meta.env.VITE_API_URL).origin : window.location.origin);

/**
 * Get or create the singleton Socket.io client. The `_token` param is kept
 * for call-site compatibility but ignored — auth now rides on the httpOnly
 * jwt cookie via withCredentials.
 */

export function getSocket(_token: string): Socket {
  // `active` is true while the initial handshake is in flight and while the
  // manager is in reconnection back-off; it drops to false once the socket is
  // rejected (connect_error from the auth middleware), told to go away by the
  // server, gives up reconnecting, or is disconnected by us. Only replacing a
  // socket in that dead state stops a second caller during the handshake (a
  // canvas switch, Strict Mode's effect replay) from tearing the pending
  // connection down and opening another one (bug hunt 2026-09-02).
  if (socket && (socket.connected || socket.active)) return socket;

  // Discard a socket that will never connect on its own
  if (socket) {
    socket.disconnect();
  }

  socket = io(SOCKET_URL, {
    // Cookie-only auth: withCredentials sends the httpOnly jwt cookie on the
    // handshake. The server-side socket middleware reads it from headers.
    withCredentials: true,
    transports: ['websocket', 'polling'],
    // Some institutional networks, VPNs, browser policies, and embedded
    // browser environments block the WebSocket upgrade while still allowing
    // long-polling. Engine.IO otherwise stops after the first transport fails,
    // so explicitly try the remaining transport instead of silently losing
    // realtime collaboration.
    tryAllTransports: true,
    reconnection: true,
    reconnectionAttempts: 10,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.warn('[Socket] Connected:', socket?.id);
  });

  socket.on('connect_error', (err) => {
    console.warn('[Socket] Connection error:', err.message);
  });

  socket.on('disconnect', (reason) => {
    console.warn('[Socket] Disconnected:', reason);
  });

  return socket;
}

/** Disconnect the singleton socket. */
export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

/** Check if socket is currently connected. */
export function isSocketConnected(): boolean {
  return socket?.connected ?? false;
}

/** Emit an event on the singleton socket (no-op if not connected). */
export function emitSocketEvent(event: string, data: unknown): void {
  if (socket?.connected) {
    socket.emit(event, data);
  }
}
