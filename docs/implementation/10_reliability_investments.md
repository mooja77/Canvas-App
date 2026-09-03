# Reliability Investments — 10 Items

## Goal

Fix the 10 highest-leverage reliability gaps. Continuous workstream, fit between sprints. Total: ~23 engineering hours.

## Order of operations

| #   | Fix                                                  | Effort | File / Location                                                                         |
| --- | ---------------------------------------------------- | ------ | --------------------------------------------------------------------------------------- |
| 1   | CI: `prisma migrate diff --exit-code`                | 3h     | `.github/workflows/ci.yml`                                                              |
| 2   | Prisma `?connection_limit=10&pool_timeout=10`        | 30m    | Railway `DATABASE_URL` env var                                                          |
| 3   | Retry wrapper for OpenAI/Anthropic SDK               | 4h     | `apps/backend/src/lib/llm-openai.ts`, `llm-anthropic.ts`                                |
| 4   | Postgres backup automation + restore drill           | 4h     | `.github/workflows/backup-prod.yml` (new)                                               |
| 5   | `refreshCanvas()` on WebSocket reconnect             | 1 line | `apps/frontend/src/hooks/useCollaboration.ts:59`                                        |
| 6   | Length caps on `codedText`, transcript content       | 30m    | `apps/backend/src/middleware/validation.ts`                                             |
| 7   | Stripe `maxNetworkRetries: 3` + reconciliation cron  | 2h     | `apps/backend/src/lib/stripe.ts`, `apps/backend/src/jobs/stripeReconciliation.ts` (new) |
| 8   | Auto-Code → durable job queue with idempotency       | 6h     | `apps/backend/src/lib/jobs.ts`, `apps/backend/src/routes/aiRoutes.ts`                   |
| 9   | Sentry alerts on `[Stripe Webhook] FAILED` + LLM 5xx | 1h     | Sentry dashboard config                                                                 |
| 10  | Service Worker update toast (`onNeedRefresh`)        | 1h     | `apps/frontend/src/main.tsx`, `vite.config.ts`                                          |

## 1. CI guard against schema/migration drift

**Why:** The WebhookEvent-class incident (model in schema.prisma without migration) has happened **3 times**. Each costs days of debugging + a prod outage.

**Fix:** `.github/workflows/ci.yml` — add step:

```yaml
- name: Check schema/migration consistency
  run: |
    cd apps/backend
    npx prisma migrate diff --from-migrations prisma/migrations --to-schema-datamodel prisma/schema.prisma --exit-code
    # Exit code 2 means drift detected → fail the CI
```

Plus a smoke-boot test that runs against a clean Postgres:

```yaml
- name: Smoke boot against clean DB
  run: |
    npx prisma migrate deploy
    node dist/index.js &
    sleep 5
    curl -f http://localhost:3007/ready || exit 1
    pkill -f "node dist/index.js"
```

## 2. Prisma connection pool

**Why:** No pool config → unbounded → pool exhaustion under load → 30s request timeouts.

**Fix:** Update Railway `DATABASE_URL`:

```
postgresql://...?connection_limit=10&pool_timeout=10
```

Expose Prisma metrics at `/metrics`:

```typescript
const metrics = await prisma.$metrics.json();
res.json({ ...currentMetrics, prisma: metrics });
```

## 3. LLM retry wrapper

**Why:** Every 429/503 from OpenAI/Anthropic surfaces as a 500 to the user. Auto-Code on large transcripts is especially vulnerable.

**Fix:** Wrap `complete()` and `completeStreaming()`:

```typescript
// apps/backend/src/lib/llm-shared.ts
export async function withRetry<T>(fn: () => Promise<T>, maxAttempts = 3, baseDelayMs = 1000): Promise<T> {
  let lastError;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const status = err.status || err.response?.status;
      if (status !== 429 && (!status || status < 500)) throw err; // don't retry 4xx (except 429)
      const retryAfter = err.headers?.['retry-after']
        ? Number(err.headers['retry-after']) * 1000
        : baseDelayMs * 2 ** attempt + Math.random() * 300;
      await new Promise((r) => setTimeout(r, retryAfter));
    }
  }
  throw lastError;
}
```

Use in both providers:

```typescript
return withRetry(() => this.client.chat.completions.create({...}));
```

## 4. Postgres backups

**Why:** `grep` for `pg_dump` returns nothing. Railway snapshots are unverified. Single biggest catastrophic risk.

**Fix:** Weekly GHA workflow:

```yaml
# .github/workflows/backup-prod.yml
name: Backup prod Postgres
on:
  schedule:
    - cron: '0 3 * * 0' # Sunday 3am UTC
  workflow_dispatch:

jobs:
  backup:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/setup-postgres@v1
        with:
          version: 16
      - name: Dump DB
        env:
          DATABASE_URL: ${{ secrets.DATABASE_PUBLIC_URL }}
        run: |
          pg_dump "$DATABASE_URL" \
            --no-owner --no-privileges --format=custom \
            --file=backup-$(date +%Y%m%d).dump
      - name: Upload to R2
        uses: cloudflare/wrangler-action@v3
        with:
          command: r2 object put qualcanvas-backups/backup-${{ github.run_id }}.dump --file=backup-*.dump
```

**Restore drill:** Monthly. Spin up staging DB, restore from backup, verify a known canvas exists.

## 5. WebSocket reconnect

**`C:\JM Programs\QualCanvas\apps\frontend\src\hooks\useCollaboration.ts:59`**

```diff
 function handleConnect() {
   socket.emit('canvas:join', { canvasId });
+  useCanvasStore.getState().refreshCanvas();  // re-sync after reconnect
 }
```

Without this, edits made by other users during the disconnect window stay invisible until next mutation.

## 6. Length caps

**`C:\JM Programs\QualCanvas\apps\backend\src\middleware\validation.ts`**

```diff
 export const createTranscriptSchema = z.object({
-  content: z.string().min(1),
+  content: z.string().min(1).max(2_000_000),  // ~400K words max
   title: z.string().min(1).max(200),
 });

 export const createCodingSchema = z.object({
-  codedText: z.string().min(1),
+  codedText: z.string().min(1).max(50_000),
   transcriptId: z.string(),
   questionId: z.string(),
   startOffset: z.number().int().min(0),
   endOffset: z.number().int().min(0),
 });

 export const createCanvasQuestionSchema = z.object({
   text: z.string().min(1).max(1000),  // already capped
   color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
 });
```

## 7. Stripe SDK retries + reconciliation

**`C:\JM Programs\QualCanvas\apps\backend\src\lib\stripe.ts`** (or wherever Stripe is initialized):

```diff
 export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
   apiVersion: '2024-06-20',
+  maxNetworkRetries: 3,
+  timeout: 10000,
 });
```

**`C:\JM Programs\QualCanvas\apps\backend\src\jobs\stripeReconciliation.ts`** (new):

```typescript
// Weekly cron: reconcile Subscription rows with Stripe truth
export async function reconcileStripeSubscriptions() {
  const allActiveSubs = await stripe.subscriptions.list({ status: 'all', limit: 100 });
  for (const stripeSub of allActiveSubs.data) {
    const dbSub = await prisma.subscription.findUnique({
      where: { stripeSubscriptionId: stripeSub.id },
    });
    if (!dbSub) {
      // Stripe has it, we don't — drift!
      logError(new Error('Stripe subscription not in DB'), { stripeSubId: stripeSub.id });
      // Optionally: create the missing row
    } else if (dbSub.status !== stripeSub.status) {
      // Status drift
      await prisma.subscription.update({
        where: { id: dbSub.id },
        data: { status: stripeSub.status },
      });
    }
  }
}
```

Schedule via existing job scheduler.

## 8. Auto-Code → durable job

**Why:** If user closes the browser tab during a 5-minute Auto-Code run, the work is lost and they're billed for the AI usage.

**Fix:** Move to job queue:

```typescript
// apps/backend/src/jobs/autoCodeJob.ts
export const autoCodeJob = {
  type: 'auto-code-transcript',
  async run(payload: { userId, canvasId, transcriptId, idempotencyKey }) {
    // Check idempotency: has this exact job already run?
    const existing = await prisma.aiJob.findUnique({
      where: { idempotencyKey: payload.idempotencyKey },
    });
    if (existing?.status === 'completed') return existing.result;

    // Run with retry
    const result = await withRetry(() => callLLM(...));

    await prisma.aiJob.update({
      where: { idempotencyKey: payload.idempotencyKey },
      data: { status: 'completed', result },
    });
    return result;
  },
};

// Frontend polls or subscribes to job status via WebSocket
```

Add `AiJob` table to schema:

```prisma
model AiJob {
  id              String   @id @default(cuid())
  idempotencyKey  String   @unique
  userId          String
  canvasId        String
  type            String
  status          String   @default("pending")  // pending | running | completed | failed
  result          String?  // JSON
  error           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
}
```

## 9. Sentry alerts

Configure in Sentry dashboard:

- **Issue alert:** `[Stripe Webhook] FAILED` log → page on-call (when on-call exists)
- **Issue alert:** LLM 5xx error rate > 5% over 15 min → email
- **Issue alert:** Any 500 from `/api/v1/auth/*` → email immediately
- **Performance alert:** p95 API latency > 3s for 5 consecutive minutes → email

## 10. Service Worker update toast

**`C:\JM Programs\QualCanvas\apps\frontend\src\main.tsx`:**

```typescript
import { registerSW } from 'virtual:pwa-register';

const updateSW = registerSW({
  onNeedRefresh() {
    toast.success(
      <div>
        <div className="font-medium">New version available</div>
        <button onClick={() => updateSW(true)} className="text-purple-600 underline">
          Reload to update
        </button>
      </div>,
      { duration: Infinity }
    );
  },
});
```

## Tests

- E2E: kill backend mid-AI-call → frontend recovers gracefully
- E2E: deploy a new bundle → toast appears in old tabs
- Backend: trigger `prisma migrate diff` drift in a test repo → CI fails
- Backend: simulate Stripe 503 → retry succeeds on 2nd attempt

## Acceptance criteria

- [ ] All 10 fixes shipped
- [ ] CI fails on schema/migration drift (tested with intentional drift)
- [ ] Backup workflow runs weekly, files arrive in R2
- [ ] Monthly restore drill documented in `docs/runbooks/RESTORE_DRILL.md`
- [ ] Sentry alerts firing on synthetic test events

## Effort

**~23 hours total** (across 6-12 weeks, parallel to sprints A-H).

## Telemetry

- `ai_retry_attempt` { provider, model, attempt, status }
- `ai_retry_exhausted` { provider, model, final_error }
- `service_worker_update_available` { old_version, new_version }
- `stripe_reconciliation_drift_detected` { sub_id, drift_type }
