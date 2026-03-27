import { prisma } from '../lib/prisma.js';
import { getIO } from '../lib/socket.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const prismaNotification = (prisma as any).notification;

export interface NotificationMetadata {
  canvasId?: string;
  canvasName?: string;
  actorName?: string;
  actorId?: string;
  teamId?: string;
  teamName?: string;
  [key: string]: unknown;
}

/**
 * Create a notification for a user and optionally push it via WebSocket.
 */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  metadata: NotificationMetadata = {},
): Promise<void> {
  try {
    const notification = await prismaNotification.create({
      data: {
        userId,
        type,
        title,
        message,
        metadata: JSON.stringify(metadata),
      },
    });

    // Push via WebSocket if the user is connected
    const io = getIO();
    if (io) {
      io.emit('notification:new', {
        userId,
        notification: {
          ...notification,
          metadata,
        },
      });
    }
  } catch (err) {
    console.error('[Notifications] Failed to create notification:', err);
  }
}

/**
 * Notify a canvas owner when someone adds a coding to their canvas.
 */
export async function notifyCodingAdded(
  canvasOwnerId: string,
  actorName: string,
  canvasId: string,
  canvasName: string,
): Promise<void> {
  if (!canvasOwnerId) return;
  await createNotification(
    canvasOwnerId,
    'coding_added',
    'New coding added',
    `${actorName} added a coding to "${canvasName}"`,
    { canvasId, canvasName, actorName },
  );
}

/**
 * Notify a user when a canvas is shared with them.
 */
export async function notifyCanvasShared(
  targetUserId: string,
  actorName: string,
  canvasId: string,
  canvasName: string,
): Promise<void> {
  await createNotification(
    targetUserId,
    'canvas_shared',
    'Canvas shared with you',
    `${actorName} shared "${canvasName}" with you`,
    { canvasId, canvasName, actorName },
  );
}

/**
 * Notify a user when they are invited to a team.
 */
export async function notifyTeamInvite(
  targetUserId: string,
  actorName: string,
  teamId: string,
  teamName: string,
): Promise<void> {
  await createNotification(
    targetUserId,
    'team_invite',
    'Team invitation',
    `${actorName} invited you to team "${teamName}"`,
    { teamId, teamName, actorName },
  );
}

/**
 * Notify a user of a comment or mention.
 */
export async function notifyMention(
  targetUserId: string,
  actorName: string,
  canvasId: string,
  canvasName: string,
): Promise<void> {
  await createNotification(
    targetUserId,
    'mention',
    'You were mentioned',
    `${actorName} mentioned you in "${canvasName}"`,
    { canvasId, canvasName, actorName },
  );
}
