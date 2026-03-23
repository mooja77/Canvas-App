interface QueuedOperation {
  id: string;
  method: string;
  url: string;
  body?: unknown;
  timestamp: number;
}

const QUEUE_KEY = 'canvas-app-offline-queue';

export function queueOperation(op: Omit<QueuedOperation, 'id' | 'timestamp'>) {
  const queue = getQueue();
  queue.push({ ...op, id: crypto.randomUUID(), timestamp: Date.now() });
  localStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
}

export function getQueue(): QueuedOperation[] {
  try {
    return JSON.parse(localStorage.getItem(QUEUE_KEY) || '[]');
  } catch { return []; }
}

export function clearQueue() {
  localStorage.removeItem(QUEUE_KEY);
}

export async function replayQueue(apiBase: string) {
  const queue = getQueue();
  if (queue.length === 0) return;

  for (const op of queue) {
    try {
      await fetch(`${apiBase}${op.url}`, {
        method: op.method,
        headers: { 'Content-Type': 'application/json' },
        body: op.body ? JSON.stringify(op.body) : undefined,
      });
    } catch {
      // If replay fails, stop — remaining ops stay queued
      return;
    }
  }
  clearQueue();
}
