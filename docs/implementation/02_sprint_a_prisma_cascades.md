# Sprint A — Prisma Cascade Fixes

## Goal

Eliminate three data-integrity bugs where missing foreign-key cascades create orphan records on user/team deletion.

## Scope

- `Team.ownerId` → `User`: add `onDelete: Cascade`
- `ReportSchedule.teamId` → `Team`: add full FK relation + `onDelete: Cascade`
- `TrainingAttempt.userId` → `User`: add full FK relation + `onDelete: Cascade`

## Out of scope

- Soft-delete migration (separate Sprint, see findings)
- updatedAt backfill on 19 models (separate sprint)
- Other schema hygiene fixes

## File-level changes

**`C:\JM Programs\QualCanvas\apps\backend\prisma\schema.prisma`**

### Change 1 — Team.ownerId (line ~694)

```diff
 model Team {
   id        String   @id @default(cuid())
   name      String
   slug      String   @unique
   ownerId   String
   createdAt DateTime @default(now())
   updatedAt DateTime @updatedAt
-  owner     User @relation("TeamOwner", fields: [ownerId], references: [id])
+  owner     User @relation("TeamOwner", fields: [ownerId], references: [id], onDelete: Cascade)
   members   TeamMember[]
+  reportSchedules ReportSchedule[]
 }
```

### Change 2 — ReportSchedule.teamId (line ~616)

```diff
 model ReportSchedule {
   id            String    @id @default(cuid())
   userId        String
   canvasId      String?
   teamId        String?
   frequency     String    @default("weekly")
   dayOfWeek     Int       @default(1)
   lastSent      DateTime?
   enabled       Boolean   @default(true)
   createdAt     DateTime  @default(now())
   user          User @relation(fields: [userId], references: [id], onDelete: Cascade)
   canvas        CodingCanvas? @relation(fields: [canvasId], references: [id], onDelete: Cascade)
+  team          Team? @relation(fields: [teamId], references: [id], onDelete: Cascade)
 }
```

### Change 3 — TrainingAttempt.userId (line ~410)

```diff
 model TrainingAttempt {
   id                 String   @id @default(cuid())
   trainingDocumentId String
   userId             String
   codings            String   @default("[]")
   kappaScore         Float
   createdAt          DateTime @default(now())
   document           TrainingDocument @relation(fields: [trainingDocumentId], references: [id], onDelete: Cascade)
+  user               User @relation(fields: [userId], references: [id], onDelete: Cascade)
 }
```

### Change 4 — User model (add inverse relations)

```diff
 model User {
   ...
+  trainingAttempts TrainingAttempt[]
   ...
 }
```

## Database changes

Generate migration:

```bash
cd "C:\JM Programs\QualCanvas\apps\backend"
npx prisma migrate dev --name fix_critical_cascades
```

Migration runs auto-applied to prod on next backend deploy via `prisma migrate deploy && node dist/index.js` in the start script.

## Tests

**Verify cascades work locally:**

```typescript
// apps/backend/src/__tests__/integration/cascades.test.ts
import { prisma } from '../../lib/prisma';

describe('Cascade fixes', () => {
  it('Team is deleted when owner is deleted', async () => {
    const user = await prisma.user.create({ data: { email: 'test@example.com', password: '...' } });
    const team = await prisma.team.create({ data: { name: 'Test', slug: 'test', ownerId: user.id } });
    await prisma.user.delete({ where: { id: user.id } });
    const found = await prisma.team.findUnique({ where: { id: team.id } });
    expect(found).toBeNull();
  });

  it('ReportSchedule is deleted when team is deleted', async () => {
    // ... similar pattern
  });

  it('TrainingAttempt is deleted when user is deleted', async () => {
    // ... similar pattern
  });
});
```

## Acceptance criteria

- [ ] Migration generates without errors
- [ ] All 937 unit tests + 683 E2E tests pass
- [ ] New `cascades.test.ts` integration test passes (3 cases)
- [ ] Prod migration deploys cleanly on next Railway push
- [ ] `npx prisma migrate status` against prod shows the new migration applied

## Rollback

If anything breaks on prod:

1. Revert the migration manually via `prisma migrate resolve --rolled-back <migration-name>`
2. Run rollback SQL (cascades are non-destructive — old behavior was "no cascade", new behavior is "cascade". Reverting just removes the cascade clause.)

```sql
-- Rollback SQL if needed
ALTER TABLE "Team" DROP CONSTRAINT "Team_ownerId_fkey";
ALTER TABLE "Team" ADD CONSTRAINT "Team_ownerId_fkey"
  FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE NO ACTION;
-- Similar for ReportSchedule and TrainingAttempt
```

## Telemetry

No new events. Migration is invisible to users.

## Effort

**20 minutes total.** Schema edit (5 min) + migration generate (1 min) + tests (10 min) + commit (4 min).

## Owner

TBD

## Commit message

```
fix(db): add missing CASCADE on Team.ownerId, ReportSchedule.teamId, TrainingAttempt.userId

- Team.ownerId previously had no onDelete behavior → orphan teams on user deletion
- ReportSchedule.teamId had no FK at all → orphan schedules on team deletion
- TrainingAttempt.userId had no FK → can't query user's attempts, no cascade

Adds Cascade behavior + missing FK constraints + inverse relation on User.

Migration: 0019_fix_critical_cascades

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
