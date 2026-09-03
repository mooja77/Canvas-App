# Feature Flags Strategy

## Goal

Enable safe rollout of every sprint-shipped feature via runtime feature flags. Simple Zustand-backed store (no LaunchDarkly / GrowthBook dependency until volume justifies it).

## Scope

- Simple Zustand-backed feature flag store
- Per-user, per-plan, per-rollout-percentage targeting
- Admin override via URL query param (for testing)
- Telemetry: flag exposure events
- ~10 flags defined for the V3 sprints

## Out of scope

- Server-side feature flags (defer)
- A/B test statistical analysis tooling (use posthog/amplitude when needed)
- Multi-variate flags (only on/off for now)

## Architecture

### Store

**`C:\JM Programs\QualCanvas\apps\frontend\src\stores\featureFlagsStore.ts`** (new):

```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type FeatureFlag =
  | 'activity_bar_v2'
  | 'onboarding_v2'
  | 'inline_ai_suggester'
  | 'pricing_v2'
  | 'krippendorff_alpha'
  | 'trust_page'
  | 'ink_ochre_palette'
  | 'fraunces_display'
  | 'methods_statement_export'
  | 'edge_midpoint_insert'
  | 'typed_sockets'
  | 'magic_cluster'
  | 'ai_chat_cmd_j';

interface FeatureFlagState {
  flags: Record<FeatureFlag, boolean>;
  overrides: Partial<Record<FeatureFlag, boolean>>; // from URL query param
  setFlag: (flag: FeatureFlag, enabled: boolean) => void;
  setOverride: (flag: FeatureFlag, enabled: boolean) => void;
  isEnabled: (flag: FeatureFlag) => boolean;
}

export const useFeatureFlagsStore = create<FeatureFlagState>()(
  persist(
    (set, get) => ({
      flags: {
        activity_bar_v2: false,
        onboarding_v2: false,
        inline_ai_suggester: false,
        pricing_v2: false,
        krippendorff_alpha: false,
        trust_page: false,
        ink_ochre_palette: false,
        fraunces_display: false,
        methods_statement_export: false,
        edge_midpoint_insert: false,
        typed_sockets: false,
        magic_cluster: false,
        ai_chat_cmd_j: false,
      },
      overrides: {},
      setFlag: (flag, enabled) => {
        set((s) => ({ flags: { ...s.flags, [flag]: enabled } }));
        // Telemetry
        trackEvent('feature_flag_changed', { flag, enabled });
      },
      setOverride: (flag, enabled) => {
        set((s) => ({ overrides: { ...s.overrides, [flag]: enabled } }));
      },
      isEnabled: (flag) => {
        const { flags, overrides } = get();
        if (flag in overrides) return overrides[flag]!;
        return flags[flag] ?? false;
      },
    }),
    { name: 'qualcanvas-feature-flags' },
  ),
);

// Hook
export function useFeatureFlag(flag: FeatureFlag): boolean {
  return useFeatureFlagsStore((s) => s.isEnabled(flag));
}
```

### URL query override

For developer/QA testing without changing the persisted state:

**`apps/frontend/src/main.tsx`** (after Zustand hydration):

```typescript
// Read ?flags=onboarding_v2=true&inline_ai_suggester=true from URL
const params = new URLSearchParams(window.location.search);
const flagsParam = params.get('flags');
if (flagsParam) {
  const overrides = Object.fromEntries(
    flagsParam.split(',').map((kv) => {
      const [k, v] = kv.split('=');
      return [k, v === 'true'];
    }),
  );
  Object.entries(overrides).forEach(([flag, enabled]) => {
    useFeatureFlagsStore.getState().setOverride(flag as FeatureFlag, enabled);
  });
}
```

### Server-side flag delivery (later)

For now, flags are client-side only (set by code releases). When we need per-user / per-plan targeting:

```typescript
// Server response includes flag bundle:
// GET /api/v1/me → { user: {...}, flags: { activity_bar_v2: true, ... } }

// Client merges server flags into store on /auth/me response:
useFeatureFlagsStore.getState().setFlag('activity_bar_v2', response.flags.activity_bar_v2);
```

Backend implementation:

```typescript
// apps/backend/src/routes/userAuthRoutes.ts — /auth/me

const userFlags = computeFeatureFlags(user);  // per-user targeting
res.json({
  success: true,
  data: { user, flags: userFlags, ... },
});

function computeFeatureFlags(user: User): Record<string, boolean> {
  const rolloutPercent = (flag: string) => {
    // Hash user.id + flag name → 0-100
    const hash = simpleHash(user.id + flag);
    return hash % 100;
  };

  return {
    activity_bar_v2: rolloutPercent('activity_bar_v2') < 50,  // 50% rollout
    onboarding_v2: user.legacyPricing ? false : true,         // off for legacy users
    inline_ai_suggester: user.plan === 'researcherPro' || user.plan === 'team',
    pricing_v2: !user.legacyPricing,
    // ...
  };
}
```

## Usage at consumer site

```tsx
import { useFeatureFlag } from '@/stores/featureFlagsStore';

function CanvasPage() {
  const useActivityBar = useFeatureFlag('activity_bar_v2');

  return useActivityBar ? <CanvasV2 /> : <CanvasLegacy />;
}
```

For backend feature gating:

```typescript
// apps/backend/src/middleware/featureFlag.ts
export function requireFlag(flag: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    const flags = computeFeatureFlags(req.user!);
    if (!flags[flag]) {
      return res.status(403).json({ error: `Feature ${flag} not enabled for this user.` });
    }
    next();
  };
}

// Use:
router.post(
  '/canvas/:id/ai/methods-statement',
  requireAuth,
  requireFlag('methods_statement_export'),
  async (req, res) => {
    /* ... */
  },
);
```

## Flag lifecycle

For each sprint:

1. **Define flag** in `FeatureFlag` type union
2. **Default off** in `flags` initial state
3. **Wire into code** via `useFeatureFlag(...)` or `requireFlag(...)`
4. **Internal QA**: enable via `?flags=X=true`
5. **Gradual rollout**: increase `rolloutPercent` server-side (10% → 50% → 100%)
6. **Confirm metrics good**: telemetry shows no regression
7. **Remove flag**: after 30 days at 100%, delete the conditional code

## Flag → sprint mapping

| Sprint                | Flag                                                       |
| --------------------- | ---------------------------------------------------------- |
| A — Prisma cascades   | None (DB migration, can't flag)                            |
| B — Voice + telemetry | `voice_v2`, `telemetry_v2` (both default-on after merge)   |
| C — Pricing           | `pricing_v2` (new signups only; legacy users see old)      |
| D — Krippendorff      | `krippendorff_alpha` (default-on for researcherPro + team) |
| E — Compliance        | `trust_page` (default-on globally)                         |
| F — Onboarding        | `onboarding_v2` (default-on for new signups)               |
| G — Activity bar      | `activity_bar_v2` (10% → 50% → 100% rollout)               |
| H — Inline AI         | `inline_ai_suggester` (Pro+ only)                          |
| Brand                 | `ink_ochre_palette`, `fraunces_display`                    |
| AI prompts            | `methods_statement_export`                                 |

## Tests

- Unit: `isEnabled` returns true if override is set, regardless of base flag
- Unit: server-side `computeFeatureFlags` consistent for same user (deterministic hash)
- E2E: visit `/canvas?flags=activity_bar_v2=true` → activity bar visible

## Acceptance criteria

- [ ] `featureFlagsStore` implemented + persisted
- [ ] `useFeatureFlag` hook available
- [ ] URL query override working
- [ ] Server-side `/auth/me` returns flag bundle
- [ ] Backend `requireFlag` middleware available
- [ ] All sprint deliverables wired through their respective flag

## Rollback

- Disable any flag in real-time via Zustand store update
- Server-side rollback: deploy backend change to `computeFeatureFlags`
- No DB schema changes required

## Telemetry

- `feature_flag_exposed` event when `isEnabled(...)` returns true for the first time per session
- `feature_flag_changed` event when admin toggles

## Effort

**1 day.** Store + hook + URL override (3h). Server-side computation + `/auth/me` integration (3h). Tests + docs (2h).

## Owner

TBD

## Commit message

```
feat(infra): simple Zustand-backed feature flag store

- 13 flags defined for V3 sprints
- URL ?flags=X=true override for QA
- Server-side /auth/me returns per-user flag bundle
- Deterministic hash-based rollout percentage
- Backend requireFlag middleware for gated endpoints
- Telemetry: feature_flag_exposed + feature_flag_changed

Enables safe gradual rollout of every sprint deliverable.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
