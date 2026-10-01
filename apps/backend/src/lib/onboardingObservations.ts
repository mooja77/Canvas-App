import { prisma } from './prisma.js';
import { trackJmsEvent } from './jms-events.js';
import { isTestAccountEmail } from '../utils/testAccounts.js';
import { safeJsonParse } from '../utils/routeHelpers.js';
import { AppError } from '../middleware/errorHandler.js';

export const SETUP_STEPS = [
  'first-transcript',
  'first-coded-excerpt',
  'create-theme',
  'run-analysis',
  'export-csv',
] as const;
export type SetupStep = (typeof SETUP_STEPS)[number];

export function setupStepsFromState(state: Record<string, unknown>): SetupStep[] {
  const stored = Array.isArray(state.serverSteps) ? state.serverSteps : [];
  return SETUP_STEPS.filter((step) => stored.includes(step));
}

/** Shared by ALL onboarding-state writers. The row lock prevents stale preference
 * patches or parallel successful operations from overwriting server milestones.
 * No network calls or research computations run inside this short transaction. */
export async function updateLockedOnboardingState(
  userId: string,
  mutate: (state: Record<string, unknown>) => Record<string, unknown>,
) {
  return prisma.$transaction(async (tx) => {
    await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${userId} FOR UPDATE`;
    const user = await tx.user.findUnique({ where: { id: userId }, select: { email: true, onboardingState: true } });
    if (!user) throw new AppError('User not found', 404);
    const parsed = user.onboardingState ? safeJsonParse(user.onboardingState, {}) : {};
    const state = mutate(parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {});
    const serialized = JSON.stringify(state);
    if (serialized.length > 16_384) throw new AppError('Onboarding state too large', 413);
    await tx.user.update({ where: { id: userId }, data: { onboardingState: serialized } });
    return { state, email: user.email };
  });
}

/** Called only after a successful authorized operation, never from a client marker. */
export async function observeSetupStep(userId: string | null, canvasId: string, step: SetupStep): Promise<void> {
  if (!userId) return;
  try {
    const user = await updateLockedOnboardingState(userId, (state) => ({
      ...state,
      serverSteps: Array.from(new Set([...setupStepsFromState(state), step])),
    }));
    // Store actor, action and canvas only: never interview content or client-provided properties.
    await prisma.auditLog.create({
      data: {
        action: `onboarding.${step}`,
        actorType: 'user',
        actorId: userId,
        resource: 'canvas',
        resourceId: canvasId,
      },
    });
    if (!isTestAccountEmail(user.email)) {
      void trackJmsEvent({
        name: 'setup_step_completed',
        email: user.email,
        properties: { user_id: userId, canvas_id: canvasId, step },
      });
    }
  } catch (error) {
    // Telemetry failure must not discard successfully saved research.
    console.error('Setup observation failed:', error instanceof Error ? error.message : 'unknown');
  }
}

export async function observedSetupSteps(userId: string): Promise<SetupStep[]> {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { onboardingState: true } });
  return setupStepsFromState(user?.onboardingState ? safeJsonParse(user.onboardingState, {}) : {});
}

export async function observeCodingProgress(userId: string | null, canvasId: string): Promise<void> {
  if (!userId) return;
  try {
    const codes = await prisma.canvasTextCoding.findMany({
      where: {
        canvasId,
        coderUserId: userId,
        source: { not: 'sample' },
        transcript: { deletedAt: null, OR: [{ sourceType: null }, { sourceType: { not: 'sample' } }] },
      },
      distinct: ['questionId'],
      select: { questionId: true },
      take: 2,
    });
    if (codes.length) await observeSetupStep(userId, canvasId, 'first-coded-excerpt');
    if (codes.length >= 2) await observeSetupStep(userId, canvasId, 'create-theme');
  } catch (error) {
    console.error('Coding setup observation failed:', error instanceof Error ? error.message : 'unknown');
  }
}

export async function observeAnalysisRun(userId: string | null, canvasId: string): Promise<void> {
  if (!userId) return;
  try {
    if (
      await prisma.canvasTranscript.count({
        where: { canvasId, deletedAt: null, OR: [{ sourceType: null }, { sourceType: { not: 'sample' } }] },
      })
    )
      await observeSetupStep(userId, canvasId, 'run-analysis');
  } catch (error) {
    console.error('Analysis setup observation failed:', error instanceof Error ? error.message : 'unknown');
  }
}
