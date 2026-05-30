import { prisma } from '../lib/prisma.js';

/**
 * Hosted-AI guardrails (see docs/superpowers/specs/2026-05-30-hosted-ai-tier-spec.md).
 *
 * "Hosted AI" = running text-AI on the platform's own OpenAI key so users get
 * AI with no setup. It is OFF unless BOTH a server key exists AND it's
 * explicitly enabled — so by default (no key) nothing here changes behaviour or
 * spends money. When on, two cheap guardrails bound our OpenAI bill:
 *  - a per-user monthly spend cap (the primary protection: one user can't burn
 *    the pool). Accurate per hosted user, since a hosted user has no BYO key and
 *    so generates only hosted AiUsage.
 *  - a global daily spend circuit-breaker (a coarse backstop against a billing
 *    surprise). It sums ALL AiUsage for the day, so it conservatively also
 *    counts BYO users' (non-our-cost) spend — it errs toward pausing, never
 *    toward overspending.
 * Users on their own key bypass both (their cost, not ours).
 */
export function isHostedAiEnabled(): boolean {
  return process.env.HOSTED_AI_ENABLED === 'true' && !!process.env.OPENAI_API_KEY;
}

function positiveIntEnv(value: string | undefined, fallback: number): number {
  const n = value ? Number(value) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Global daily ceiling across all hosted users, in cents. Default $20/day. */
export function hostedDailyCeilingCents(): number {
  return positiveIntEnv(process.env.HOSTED_AI_DAILY_CENTS_CEILING, 2000);
}

/** Per-user monthly hosted-spend cap, in cents. Default $5/user/month. */
export function hostedUserMonthlyCapCents(): number {
  return positiveIntEnv(process.env.HOSTED_AI_USER_MONTHLY_CENTS_CAP, 500);
}

export async function globalSpendTodayCents(): Promise<number> {
  const dayStart = new Date();
  dayStart.setHours(0, 0, 0, 0);
  const agg = await prisma.aiUsage.aggregate({ _sum: { costCents: true }, where: { createdAt: { gte: dayStart } } });
  return agg._sum.costCents ?? 0;
}

export async function userSpendThisMonthCents(userId: string): Promise<number> {
  const monthStart = new Date();
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const agg = await prisma.aiUsage.aggregate({
    _sum: { costCents: true },
    where: { userId, createdAt: { gte: monthStart } },
  });
  return agg._sum.costCents ?? 0;
}
