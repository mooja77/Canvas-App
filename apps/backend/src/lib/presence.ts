// ─── In-memory presence tracking for collaborative canvases ───

const COLLABORATOR_COLORS = [
  '#EF4444', '#F97316', '#EAB308', '#22C55E', '#06B6D4',
  '#3B82F6', '#8B5CF6', '#EC4899', '#14B8A6', '#F59E0B',
];

export interface PresenceEntry {
  userId: string;
  name: string;
  color: string;
  cursor?: { x: number; y: number };
  joinedAt: number;
}

// Map<canvasId, Map<userId, PresenceEntry>>
const presenceMap = new Map<string, Map<string, PresenceEntry>>();

/** Assign a deterministic color based on user position in the room. */
function pickColor(existingCount: number): string {
  return COLLABORATOR_COLORS[existingCount % COLLABORATOR_COLORS.length];
}

/** Add a user to a canvas room. */
export function join(canvasId: string, userId: string, name: string): PresenceEntry {
  if (!presenceMap.has(canvasId)) {
    presenceMap.set(canvasId, new Map());
  }
  const room = presenceMap.get(canvasId)!;

  // If already present, return existing entry
  const existing = room.get(userId);
  if (existing) return existing;

  const entry: PresenceEntry = {
    userId,
    name,
    color: pickColor(room.size),
    joinedAt: Date.now(),
  };
  room.set(userId, entry);
  return entry;
}

/** Remove a user from a canvas room. */
export function leave(canvasId: string, userId: string): void {
  const room = presenceMap.get(canvasId);
  if (!room) return;
  room.delete(userId);
  if (room.size === 0) {
    presenceMap.delete(canvasId);
  }
}

/** Get all present users in a canvas room. */
export function getPresence(canvasId: string): PresenceEntry[] {
  const room = presenceMap.get(canvasId);
  if (!room) return [];
  return Array.from(room.values());
}

/** Update a user's cursor position. */
export function updateCursor(canvasId: string, userId: string, cursor: { x: number; y: number }): void {
  const room = presenceMap.get(canvasId);
  if (!room) return;
  const entry = room.get(userId);
  if (entry) {
    entry.cursor = cursor;
  }
}

/** Remove a user from all rooms (on disconnect). */
export function leaveAll(userId: string): string[] {
  const leftRooms: string[] = [];
  for (const [canvasId, room] of presenceMap.entries()) {
    if (room.has(userId)) {
      room.delete(userId);
      leftRooms.push(canvasId);
      if (room.size === 0) {
        presenceMap.delete(canvasId);
      }
    }
  }
  return leftRooms;
}
