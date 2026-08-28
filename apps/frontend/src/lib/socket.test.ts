import { afterEach, describe, expect, it, vi } from 'vitest';

const { ioMock, socketMock } = vi.hoisted(() => ({
  ioMock: vi.fn(),
  socketMock: {
    connected: false,
    disconnect: vi.fn(),
    on: vi.fn(),
    emit: vi.fn(),
  },
}));

vi.mock('socket.io-client', () => ({
  io: ioMock.mockReturnValue(socketMock),
}));

import { disconnectSocket, getSocket } from './socket';

describe('realtime socket configuration', () => {
  afterEach(() => {
    disconnectSocket();
    vi.clearAllMocks();
  });

  it('falls back to polling when a WebSocket connection cannot be established', () => {
    getSocket('');

    expect(ioMock).toHaveBeenCalledOnce();
    expect(ioMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        transports: ['websocket', 'polling'],
        tryAllTransports: true,
        withCredentials: true,
      }),
    );
  });
});
