export type ActivationStageKey = 'signup' | 'canvas' | 'transcript' | 'coding';

export interface ActivationCohortMember {
  id: string;
  createdAt: Date;
}

export interface ActivationMilestoneRecord {
  /** The canvas owner: the user the milestone falls back to. */
  userId: string | null;
  /**
   * The user who actually performed the milestone, when the record knows it
   * (CanvasTextCoding.coderUserId). A collaborator's coding counts for the
   * collaborator, not for the owner of the canvas it happens to be on.
   */
  coderUserId?: string | null;
  createdAt: Date;
}

/** Whose milestone this is: the actor when attributed, else the canvas owner. */
function milestoneUserId(record: ActivationMilestoneRecord): string | null {
  return record.coderUserId ?? record.userId;
}

export interface ActivationStage {
  key: ActivationStageKey;
  label: string;
  users: number;
  cohortRate: number | null;
  previousStepRate: number | null;
  medianHoursToReach: number | null;
}

export interface ActivationFunnel {
  cohortSize: number;
  activatedUsers: number;
  activationRate: number | null;
  stages: ActivationStage[];
}

const STAGES: ReadonlyArray<{ key: ActivationStageKey; label: string }> = [
  { key: 'signup', label: 'Signed up' },
  { key: 'canvas', label: 'Created a project' },
  { key: 'transcript', label: 'Added a transcript' },
  { key: 'coding', label: 'Created a first coding' },
];

function rate(numerator: number, denominator: number): number | null {
  if (denominator === 0) return null;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  const value =
    sorted.length % 2 === 0 ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2 : (sorted[middle] ?? 0);
  return Math.round(value * 10) / 10;
}

function summarizeMilestone(
  cohort: Map<string, Date>,
  records: ActivationMilestoneRecord[],
): { users: number; medianHoursToReach: number | null } {
  const earliestByUser = new Map<string, Date>();

  for (const record of records) {
    const userId = milestoneUserId(record);
    if (!userId || !cohort.has(userId)) continue;
    const current = earliestByUser.get(userId);
    if (!current || record.createdAt < current) earliestByUser.set(userId, record.createdAt);
  }

  const hoursToReach: number[] = [];
  for (const [userId, reachedAt] of earliestByUser) {
    const signedUpAt = cohort.get(userId);
    if (!signedUpAt) continue;
    hoursToReach.push(Math.max(0, (reachedAt.getTime() - signedUpAt.getTime()) / 3_600_000));
  }

  return { users: earliestByUser.size, medianHoursToReach: median(hoursToReach) };
}

export function buildActivationFunnel(
  cohortMembers: ActivationCohortMember[],
  milestones: Record<'canvas' | 'transcript' | 'coding', ActivationMilestoneRecord[]>,
): ActivationFunnel {
  const cohort = new Map(cohortMembers.map((member) => [member.id, member.createdAt]));
  const cohortSize = cohort.size;
  const summaries = {
    signup: { users: cohortSize, medianHoursToReach: cohortSize > 0 ? 0 : null },
    canvas: summarizeMilestone(cohort, milestones.canvas),
    transcript: summarizeMilestone(cohort, milestones.transcript),
    coding: summarizeMilestone(cohort, milestones.coding),
  };

  let previousUsers = cohortSize;
  const stages = STAGES.map(({ key, label }) => {
    const summary = summaries[key];
    const stage: ActivationStage = {
      key,
      label,
      users: summary.users,
      cohortRate: rate(summary.users, cohortSize),
      previousStepRate: key === 'signup' ? rate(cohortSize, cohortSize) : rate(summary.users, previousUsers),
      medianHoursToReach: summary.medianHoursToReach,
    };
    previousUsers = summary.users;
    return stage;
  });

  const activatedUsers = summaries.coding.users;
  return {
    cohortSize,
    activatedUsers,
    activationRate: rate(activatedUsers, cohortSize),
    stages,
  };
}
