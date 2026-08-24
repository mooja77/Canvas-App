export type PlanTier = 'free' | 'student' | 'pro' | 'team';

export interface PlanLimits {
  maxCanvases: number;
  maxTranscriptsPerCanvas: number;
  maxWordsPerTranscript: number;
  maxCodes: number;
  autoCodeEnabled: boolean;
  allowedAnalysisTypes: string[];
  allowedExportFormats: string[];
  maxShares: number;
  ethicsEnabled: boolean;
  casesEnabled: boolean;
  intercoderEnabled: boolean;
  aiEnabled: boolean;
  aiRequestsPerDay: number;
  fileUploadEnabled: boolean;
  maxStorageMb: number;
  transcriptionMinutesPerMonth: number;
  maxCollaborators: number;
  repositoryEnabled: boolean;
  integrationsEnabled: boolean;
}

/**
 * Fair-use ceiling on hosted text-AI requests per day.
 *
 * Deliberately IDENTICAL on every paid tier: it is an abuse/cost guard, not a
 * tier differentiator. Nothing a user can buy lifts it, so `checkAiAccess`
 * refuses with `upgrade: false` and says so — pitching an upgrade for a cap
 * that Team shares would be a lie. It also means any public copy describing AI
 * text analysis as "Unlimited" is false; the honest phrasing is
 * "1,000 requests/day (fair use)".
 */
export const AI_REQUESTS_PER_DAY_FAIR_USE = 1000;

export const PLAN_LIMITS: Record<PlanTier, PlanLimits> = {
  free: {
    // Expanded 2026-05-13 — Sprint C of V3 plan.
    // Wins dissertation market: a typical interview study has 3-5 transcripts.
    // Old: 1 canvas, 2 transcripts, 5K words, 5 codes, 2 analyses.
    // New: 2 canvases, 5 transcripts, 10K words, 10 codes, 4 analyses.
    maxCanvases: 2,
    maxTranscriptsPerCanvas: 5,
    maxWordsPerTranscript: 10000,
    maxCodes: 10,
    autoCodeEnabled: false,
    allowedAnalysisTypes: ['stats', 'wordcloud', 'sentiment', 'search'],
    allowedExportFormats: ['csv'],
    maxShares: 0,
    ethicsEnabled: false,
    casesEnabled: false,
    intercoderEnabled: false,
    aiEnabled: false,
    aiRequestsPerDay: 0,
    fileUploadEnabled: false,
    maxStorageMb: 0,
    transcriptionMinutesPerMonth: 0,
    maxCollaborators: 0,
    repositoryEnabled: false,
    integrationsEnabled: false,
  },
  // Verified-student tier ($5/mo). Near-Pro power for the academic land-grab —
  // the segment AI-native competitors (Dovetail/Marvin/CoLoop) don't serve.
  // Capped canvases + no collaborators keep it individual; AI is full (text-AI
  // costs pennies) with a modest transcription allowance + BYO-key for more.
  student: {
    maxCanvases: 5,
    maxTranscriptsPerCanvas: Infinity,
    maxWordsPerTranscript: 50000,
    maxCodes: Infinity,
    autoCodeEnabled: true,
    allowedAnalysisTypes: [
      'search',
      'cooccurrence',
      'matrix',
      'stats',
      'comparison',
      'wordcloud',
      'cluster',
      'codingquery',
      'sentiment',
      'treemap',
      'documentportrait',
      'timeline',
      'geomap',
    ],
    allowedExportFormats: ['csv', 'png', 'html', 'md', 'docx', 'xlsx', 'qdpx'],
    maxShares: 2,
    ethicsEnabled: true,
    casesEnabled: true,
    intercoderEnabled: false,
    aiEnabled: true,
    aiRequestsPerDay: AI_REQUESTS_PER_DAY_FAIR_USE,
    fileUploadEnabled: true,
    maxStorageMb: 500,
    transcriptionMinutesPerMonth: 300, // 5 hrs; BYO-key for more
    maxCollaborators: 0,
    repositoryEnabled: true,
    integrationsEnabled: false,
  },
  pro: {
    maxCanvases: Infinity,
    maxTranscriptsPerCanvas: Infinity,
    maxWordsPerTranscript: 50000,
    maxCodes: Infinity,
    autoCodeEnabled: true,
    allowedAnalysisTypes: [
      'search',
      'cooccurrence',
      'matrix',
      'stats',
      'comparison',
      'wordcloud',
      'cluster',
      'codingquery',
      'sentiment',
      'treemap',
      'documentportrait',
      'timeline',
      'geomap',
    ],
    allowedExportFormats: ['csv', 'png', 'html', 'md', 'docx', 'xlsx', 'qdpx'],
    maxShares: 5,
    ethicsEnabled: true,
    casesEnabled: true,
    intercoderEnabled: false,
    aiEnabled: true,
    aiRequestsPerDay: AI_REQUESTS_PER_DAY_FAIR_USE,
    fileUploadEnabled: true,
    maxStorageMb: 500,
    transcriptionMinutesPerMonth: 600, // 10 hrs; BYO-key for unlimited
    maxCollaborators: 3,
    repositoryEnabled: true,
    integrationsEnabled: false,
  },
  team: {
    maxCanvases: Infinity,
    maxTranscriptsPerCanvas: Infinity,
    maxWordsPerTranscript: 50000,
    maxCodes: Infinity,
    autoCodeEnabled: true,
    allowedAnalysisTypes: [
      'search',
      'cooccurrence',
      'matrix',
      'stats',
      'comparison',
      'wordcloud',
      'cluster',
      'codingquery',
      'sentiment',
      'treemap',
      'documentportrait',
      'timeline',
      'geomap',
    ],
    allowedExportFormats: ['csv', 'png', 'html', 'md', 'docx', 'xlsx', 'qdpx'],
    maxShares: Infinity,
    ethicsEnabled: true,
    casesEnabled: true,
    intercoderEnabled: true,
    aiEnabled: true,
    aiRequestsPerDay: AI_REQUESTS_PER_DAY_FAIR_USE,
    fileUploadEnabled: true,
    maxStorageMb: 5000,
    transcriptionMinutesPerMonth: 3000, // ~50 hrs, matching the /pricing table (was 300 — below Pro); BYO-key for unlimited
    maxCollaborators: Infinity,
    repositoryEnabled: true,
    // No provider integration exists. There was never an OAuth flow — the old
    // /integrations/connect route just stored a token the caller pasted in, and
    // nothing ever read it back out. Selling this on Team was a false claim, so
    // the flag is off everywhere until a real authorization-code/PKCE flow ships
    // against a provider someone has actually asked for.
    integrationsEnabled: false,
  },
};

export function getPlanLimits(plan: string): PlanLimits {
  if (plan in PLAN_LIMITS) {
    return PLAN_LIMITS[plan as PlanTier];
  }
  return PLAN_LIMITS.free;
}

// ─────────────────────────────────────────────────────────────────────────────
// Refusal copy, DERIVED from PLAN_LIMITS above.
//
// Every plan gate used to hardcode "available on Pro and Team plans". That copy
// was written before the Student tier existed and never revisited, so a
// verified student was told to pay $15 for autoCode / analyses / ethics / cases
// / AI / uploads / the repository — all of which Student ($5) already includes
// in full. Hardcoded copy cannot stay true across a pricing change, so the
// message is now computed from the table: if a capability moves between tiers,
// every refusal that mentions it moves with it.
// ─────────────────────────────────────────────────────────────────────────────

/** Cheapest → most capable. The order refusal messages list upgrades in. */
const TIER_ORDER: PlanTier[] = ['free', 'student', 'pro', 'team'];

export const PLAN_LABELS: Record<PlanTier, string> = {
  free: 'Free',
  student: 'Student',
  pro: 'Pro',
  team: 'Team',
};

/** Display name for a plan string, tolerating unknown/legacy values. */
export function planLabel(plan: string): string {
  return PLAN_LABELS[plan as PlanTier] ?? plan;
}

/**
 * Tiers whose limits satisfy `has`, in upgrade order.
 *
 * Free is excluded: these lists are only ever rendered inside a refusal, and
 * "available on the Free plan" is never a useful thing to tell someone who was
 * just refused. (A capability Free has cannot produce a refusal anyway.)
 */
export function plansWith(has: (limits: PlanLimits) => boolean): PlanTier[] {
  return TIER_ORDER.filter((tier) => tier !== 'free' && has(PLAN_LIMITS[tier]));
}

function joinList(names: string[]): string {
  if (names.length === 0) return '';
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(', ')}, and ${names[names.length - 1]}`;
}

/** "Team" / "Pro and Team" / "Student, Pro, and Team" */
export function planListPhrase(tiers: PlanTier[]): string {
  return joinList(tiers.map((tier) => PLAN_LABELS[tier]));
}

/**
 * "<subject> is available on the Student, Pro, and Team plans."
 *
 * `plural` picks "are" over "is" for subjects like "Cases" or "AI features".
 */
export function featureAvailabilityMessage(
  subject: string,
  has: (limits: PlanLimits) => boolean,
  opts: { plural?: boolean } = {},
): string {
  const tiers = plansWith(has);
  const verb = opts.plural ? 'are' : 'is';
  if (tiers.length === 0) {
    // Reachable today: integrationsEnabled is false on every tier because the
    // feature was retired as an unsupported claim. Saying "available on Team"
    // there would re-introduce the false claim.
    return `${subject} ${verb} not available on any plan.`;
  }
  return `${subject} ${verb} available on the ${planListPhrase(tiers)} plan${tiers.length > 1 ? 's' : ''}.`;
}

export function formatAllowance(value: number): string {
  return value === Infinity ? 'unlimited' : value.toLocaleString();
}

/**
 * "Student allows 2, Pro allows 5, Team allows unlimited" — the tiers whose
 * allowance for this quantity beats `current`, grouped where they match.
 * Empty string when no plan offers more, which is itself the useful signal:
 * the caller must then NOT pitch an upgrade.
 */
export function higherAllowancePhrase(current: number, pick: (limits: PlanLimits) => number): string {
  const better = TIER_ORDER.filter((tier) => tier !== 'free' && pick(PLAN_LIMITS[tier]) > current);
  const groups: { value: number; tiers: PlanTier[] }[] = [];
  for (const tier of better) {
    const value = pick(PLAN_LIMITS[tier]);
    const last = groups[groups.length - 1];
    if (last && last.value === value) last.tiers.push(tier);
    else groups.push({ value, tiers: [tier] });
  }
  return groups
    .map((g) => `${planListPhrase(g.tiers)} ${g.tiers.length > 1 ? 'allow' : 'allows'} ${formatAllowance(g.value)}`)
    .join(', ');
}

/**
 * Message for a countable cap that the caller has just hit.
 *
 * Two shapes, because they need different remedies:
 *   - allowance 0  → the plan does not include the thing at all; the only
 *     remedy is a plan that does.
 *   - allowance >0 → the user owns N of them; deleting one is a real remedy,
 *     and an upgrade is the other. Naming both is the point: the old copy
 *     ("Free plan allows 0 share codes") stated the allowance and left the
 *     user to guess what to do about it.
 */
export function allowanceMessage(
  plan: string,
  subject: string,
  max: number,
  pick: (limits: PlanLimits) => number,
  opts: { deleteHint?: string } = {},
): string {
  const upgrade = higherAllowancePhrase(max, pick);
  const label = planLabel(plan);
  if (max === 0) {
    return upgrade
      ? `${subject} are not included in the ${label} plan — ${upgrade}.`
      : `${subject} are not included in the ${label} plan.`;
  }
  const remedies: string[] = [];
  if (opts.deleteHint) remedies.push(opts.deleteHint);
  if (upgrade) remedies.push(`upgrade (${upgrade})`);
  const tail = remedies.length ? ` To add another, ${remedies.join(', or ')}.` : '';
  return `You are using all ${formatAllowance(max)} ${subject.toLowerCase()} included in the ${label} plan.${tail}`;
}
