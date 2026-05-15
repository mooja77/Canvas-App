# Database Documentation

## 1. Overview

QualCanvas uses **37 Prisma models** stored in a relational database.

- **Production:** PostgreSQL 16 (hosted on Railway)
- **Local development:** SQLite via `DATABASE_URL="file:./canvas-app.db"`
- **CI:** SQLite (`file:./test.db`)

The Prisma schema is at `apps/backend/prisma/schema.prisma` with `provider = "postgresql"`. Prisma accepts a SQLite connection string at runtime, but schema-level commands (`migrate dev`, `db push`) may require temporarily switching the provider for local SQLite use. The committed provider must always be `"postgresql"`.

## 2. Entity Relationship Diagram

```
                            ┌──────────┐
                            │   User   │
                            └────┬─────┘
          ┌──────────┬──────────┼──────────┬──────────┬──────────┐
          v          v          v          v          v          v
   ┌────────────┐ ┌──────┐ ┌────────┐ ┌──────────┐ ┌────────┐ ┌──────────┐
   │Subscription│ │ Team │ │TeamMem.│ │UserAiConf│ │Integr. │ │ResearchRe│
   └────────────┘ └──┬───┘ └────────┘ └──────────┘ └────────┘ └────┬─────┘
                     |                                              v
                     v                                       ┌───────────┐
               ┌───────────┐                                 │RepoInsight│
               │TeamMember │                                 └───────────┘
               └───────────┘

   ┌─────────────────┐       ┌──────────────┐
   │DashboardAccess  │<──────│ CodingCanvas │──────>│ User (optional) │
   └─────────────────┘       └──────┬───────┘
                                    │
          ┌─────────┬───────┬───────┼───────┬────────┬────────┬─────────┐
          v         v       v       v       v        v        v         v
   ┌──────────┐ ┌───────┐ ┌────┐ ┌──────┐ ┌─────┐ ┌──────┐ ┌───────┐ ┌────────┐
   │Transcript│ │Questn.│ │Memo│ │ Case │ │Share│ │Relat.│ │Compute│ │Consent │
   └────┬─────┘ └───┬───┘ └────┘ └──┬───┘ └─────┘ └──────┘ └───────┘ └────────┘
        │           │               │
        v           v               v
   ┌──────────┐ ┌──────────┐  (Case <-> Transcript)
   │TextCoding│ │TextCoding│
   └──────────┘ └──────────┘

   CodingCanvas also has:
     CanvasNodePosition, CanvasCollaborator, CanvasDocument,
     TrainingDocument, FileUpload, TextEmbedding, ChatMessage,
     Summary, AiSuggestion

   ┌──────────────┐       ┌─────────────────────┐
   │CanvasDocument│──────>│DocumentRegionCoding  │
   └──────────────┘       └─────────────────────┘

   ┌────────────────┐     ┌─────────────────┐
   │TrainingDocument │────>│TrainingAttempt   │
   └────────────────┘     └─────────────────┘

   ┌──────────┐           ┌─────────────────┐
   │FileUpload│──────────>│TranscriptionJob  │
   └──────────┘           └─────────────────┘

   User also has:
     Notification, ReportSchedule, CalendarEvent

   Standalone models (no FK relations):
     AuditLog, WebhookEvent, AiUsage
```

## 3. Models

### User

Core user account model. Supports email/password auth with optional Google OAuth.

| Field              | Type      | Constraints  | Default        |
| ------------------ | --------- | ------------ | -------------- |
| `id`               | String    | `@id`        | `cuid()`       |
| `email`            | String    | `@unique`    | —              |
| `emailVerified`    | Boolean   | —            | `false`        |
| `passwordHash`     | String    | —            | —              |
| `name`             | String    | —            | —              |
| `role`             | String    | —            | `"researcher"` |
| `plan`             | String    | —            | `"free"`       |
| `stripeCustomerId` | String?   | `@unique`    | —              |
| `createdAt`        | DateTime  | —            | `now()`        |
| `updatedAt`        | DateTime  | `@updatedAt` | —              |
| `resetTokenHash`   | String?   | —            | —              |
| `resetTokenExpiry` | DateTime? | —            | —              |

**Relations:**

- `subscription` -> Subscription (one-to-one)
- `codingCanvases` -> CodingCanvas[] (one-to-many)
- `dashboardAccess` -> DashboardAccess (one-to-one, optional)
- `repositories` -> ResearchRepository[] (one-to-many)
- `integrations` -> Integration[] (one-to-many)
- `aiConfig` -> UserAiConfig (one-to-one)
- `ownedTeams` -> Team[] (one-to-many, named "TeamOwner")
- `teamMemberships` -> TeamMember[] (one-to-many)
- `notifications` -> Notification[] (one-to-many)
- `reportSchedules` -> ReportSchedule[] (one-to-many)
- `calendarEvents` -> CalendarEvent[] (one-to-many)

**Indexes:** `email`, `stripeCustomerId`

---

### UserAiConfig

Stores user-provided AI API keys with AES-256-GCM encryption.

| Field             | Type     | Constraints  | Default    |
| ----------------- | -------- | ------------ | ---------- |
| `id`              | String   | `@id`        | `cuid()`   |
| `userId`          | String   | `@unique`    | —          |
| `provider`        | String   | —            | `"openai"` |
| `apiKeyEncrypted` | String   | —            | —          |
| `apiKeyIv`        | String   | —            | —          |
| `apiKeyTag`       | String   | —            | —          |
| `model`           | String?  | —            | —          |
| `embeddingModel`  | String?  | —            | —          |
| `createdAt`       | DateTime | —            | `now()`    |
| `updatedAt`       | DateTime | `@updatedAt` | —          |

**Relations:** `user` -> User (on delete: **Cascade**)

**Encryption pattern:** The API key is encrypted with AES-256-GCM. Three fields store the ciphertext (`apiKeyEncrypted`), initialization vector (`apiKeyIv`), and authentication tag (`apiKeyTag`). Decryption requires the `ENCRYPTION_KEY` environment variable.

---

### Subscription

Stripe subscription tracking for SaaS billing.

| Field                  | Type     | Constraints  | Default  |
| ---------------------- | -------- | ------------ | -------- |
| `id`                   | String   | `@id`        | `cuid()` |
| `userId`               | String   | `@unique`    | —        |
| `stripeSubscriptionId` | String   | `@unique`    | —        |
| `stripePriceId`        | String   | —            | —        |
| `status`               | String   | —            | —        |
| `currentPeriodStart`   | DateTime | —            | —        |
| `currentPeriodEnd`     | DateTime | —            | —        |
| `cancelAtPeriodEnd`    | Boolean  | —            | `false`  |
| `createdAt`            | DateTime | —            | `now()`  |
| `updatedAt`            | DateTime | `@updatedAt` | —        |

**Status values:** `active`, `past_due`, `canceled`, `trialing`

**Relations:** `user` -> User (on delete: **Cascade**)

---

### DashboardAccess

Legacy access-code authentication. Users with access codes are grandfathered to Pro.

| Field            | Type     | Constraints | Default  |
| ---------------- | -------- | ----------- | -------- |
| `id`             | String   | `@id`       | `cuid()` |
| `accessCode`     | String   | `@unique`   | —        |
| `accessCodeHash` | String?  | —           | —        |
| `name`           | String   | —           | —        |
| `role`           | String   | —           | —        |
| `expiresAt`      | DateTime | —           | —        |
| `createdAt`      | DateTime | —           | `now()`  |
| `userId`         | String?  | `@unique`   | —        |

**Role values:** `policymaker`, `funder`, `researcher`

**Relations:**

- `user` -> User? (on delete: **SetNull**)
- `codingCanvases` -> CodingCanvas[] (one-to-many)

---

### CodingCanvas

Central entity representing a qualitative coding workspace. Supports soft delete.

| Field               | Type      | Constraints  | Default     |
| ------------------- | --------- | ------------ | ----------- |
| `id`                | String    | `@id`        | `cuid()`    |
| `dashboardAccessId` | String    | —            | —           |
| `userId`            | String?   | —            | —           |
| `name`              | String    | —            | —           |
| `description`       | String?   | —            | —           |
| `ethicsApprovalId`  | String?   | —            | —           |
| `ethicsStatus`      | String    | —            | `"pending"` |
| `dataRetentionDate` | DateTime? | —            | —           |
| `deletedAt`         | DateTime? | —            | —           |
| `createdAt`         | DateTime  | —            | `now()`     |
| `updatedAt`         | DateTime  | `@updatedAt` | —           |

**Relations:**

- `dashboardAccess` -> DashboardAccess (on delete: **Cascade**)
- `user` -> User? (on delete: **Cascade**)
- `transcripts` -> CanvasTranscript[]
- `questions` -> CanvasQuestion[]
- `memos` -> CanvasMemo[]
- `codings` -> CanvasTextCoding[]
- `nodePositions` -> CanvasNodePosition[]
- `cases` -> CanvasCase[]
- `relations` -> CanvasRelation[]
- `computedNodes` -> CanvasComputedNode[]
- `shares` -> CanvasShare[]
- `consentRecords` -> ConsentRecord[]
- `aiSuggestions` -> AiSuggestion[]
- `fileUploads` -> FileUpload[]
- `textEmbeddings` -> TextEmbedding[]
- `chatMessages` -> ChatMessage[]
- `summaries` -> Summary[]
- `collaborators` -> CanvasCollaborator[]
- `documents` -> CanvasDocument[]
- `trainingDocuments` -> TrainingDocument[]

**Unique:** `@@unique([dashboardAccessId, name])`

**Indexes:** `dashboardAccessId`, `userId`, `deletedAt`

---

### CanvasShare

Sharing links for canvases with optional expiration and clone tracking.

| Field        | Type      | Constraints | Default  |
| ------------ | --------- | ----------- | -------- |
| `id`         | String    | `@id`       | `cuid()` |
| `canvasId`   | String    | —           | —        |
| `shareCode`  | String    | `@unique`   | —        |
| `createdBy`  | String    | —           | —        |
| `expiresAt`  | DateTime? | —           | —        |
| `cloneCount` | Int       | —           | `0`      |
| `createdAt`  | DateTime  | —           | `now()`  |

**Relations:** `canvas` -> CodingCanvas (on delete: **Cascade**)

**Indexes:** `canvasId`, `shareCode`

---

### CanvasTranscript

Interview transcripts or text data within a canvas. Supports soft delete, geolocation, and timestamps.

| Field           | Type      | Constraints  | Default  |
| --------------- | --------- | ------------ | -------- |
| `id`            | String    | `@id`        | `cuid()` |
| `canvasId`      | String    | —            | —        |
| `title`         | String    | —            | —        |
| `content`       | String    | —            | —        |
| `sortOrder`     | Int       | —            | `0`      |
| `caseId`        | String?   | —            | —        |
| `sourceType`    | String?   | —            | —        |
| `sourceId`      | String?   | —            | —        |
| `deletedAt`     | DateTime? | —            | —        |
| `isAnonymized`  | Boolean   | —            | `false`  |
| `participantId` | String?   | —            | —        |
| `fileUploadId`  | String?   | —            | —        |
| `timestamps`    | String?   | —            | —        |
| `eventDate`     | DateTime? | —            | —        |
| `latitude`      | Float?    | —            | —        |
| `longitude`     | Float?    | —            | —        |
| `locationName`  | String?   | —            | —        |
| `createdAt`     | DateTime  | —            | `now()`  |
| `updatedAt`     | DateTime  | `@updatedAt` | —        |

**JSON fields:** `timestamps` stores `[{start, end, text}]` for audio/video sync.

**Relations:**

- `canvas` -> CodingCanvas (on delete: **Cascade**)
- `case` -> CanvasCase? (on delete: **SetNull**)
- `codings` -> CanvasTextCoding[]
- `aiSuggestions` -> AiSuggestion[]

**Indexes:** `canvasId`, `caseId`, `deletedAt`

---

### CanvasQuestion

Qualitative codes/themes organized in a hierarchy.

| Field              | Type     | Constraints  | Default     |
| ------------------ | -------- | ------------ | ----------- |
| `id`               | String   | `@id`        | `cuid()`    |
| `canvasId`         | String   | —            | —           |
| `text`             | String   | —            | —           |
| `color`            | String   | —            | `"#3B82F6"` |
| `sortOrder`        | Int      | —            | `0`         |
| `parentQuestionId` | String?  | —            | —           |
| `createdAt`        | DateTime | —            | `now()`     |
| `updatedAt`        | DateTime | `@updatedAt` | —           |

**Relations:**

- `canvas` -> CodingCanvas (on delete: **Cascade**)
- `parentQuestion` -> CanvasQuestion? (self-relation "QuestionHierarchy", on delete: **SetNull**)
- `childQuestions` -> CanvasQuestion[] (self-relation "QuestionHierarchy")
- `codings` -> CanvasTextCoding[]

**Indexes:** `canvasId`, `parentQuestionId`

---

### CanvasMemo

Research memos/notes attached to a canvas.

| Field       | Type     | Constraints  | Default     |
| ----------- | -------- | ------------ | ----------- |
| `id`        | String   | `@id`        | `cuid()`    |
| `canvasId`  | String   | —            | —           |
| `title`     | String?  | —            | —           |
| `content`   | String   | —            | —           |
| `color`     | String   | —            | `"#FEF08A"` |
| `createdAt` | DateTime | —            | `now()`     |
| `updatedAt` | DateTime | `@updatedAt` | —           |

**Relations:** `canvas` -> CodingCanvas (on delete: **Cascade**)

---

### CanvasTextCoding

A coded text segment linking a transcript passage to a question/code.

| Field          | Type     | Constraints | Default  |
| -------------- | -------- | ----------- | -------- |
| `id`           | String   | `@id`       | `cuid()` |
| `canvasId`     | String   | —           | —        |
| `transcriptId` | String   | —           | —        |
| `questionId`   | String   | —           | —        |
| `startOffset`  | Int      | —           | —        |
| `endOffset`    | Int      | —           | —        |
| `codedText`    | String   | —           | —        |
| `note`         | String?  | —           | —        |
| `annotation`   | String?  | —           | —        |
| `createdAt`    | DateTime | —           | `now()`  |

**Relations:**

- `canvas` -> CodingCanvas (on delete: **Cascade**)
- `transcript` -> CanvasTranscript (on delete: **Cascade**)
- `question` -> CanvasQuestion (on delete: **Cascade**)

**Indexes:** `canvasId`, `transcriptId`, `questionId`, `[canvasId, transcriptId]` (compound)

---

### CanvasNodePosition

Visual position and size of nodes on the canvas workspace.

| Field       | Type    | Constraints | Default  |
| ----------- | ------- | ----------- | -------- |
| `id`        | String  | `@id`       | `cuid()` |
| `canvasId`  | String  | —           | —        |
| `nodeId`    | String  | —           | —        |
| `nodeType`  | String  | —           | —        |
| `x`         | Float   | —           | —        |
| `y`         | Float   | —           | —        |
| `width`     | Float?  | —           | —        |
| `height`    | Float?  | —           | —        |
| `collapsed` | Boolean | —           | `false`  |

**Unique:** `@@unique([canvasId, nodeId])`

**Relations:** `canvas` -> CodingCanvas (on delete: **Cascade**)

**Indexes:** `canvasId`

---

### CanvasCase

Cases group transcripts for cross-case analysis.

| Field        | Type     | Constraints  | Default  |
| ------------ | -------- | ------------ | -------- |
| `id`         | String   | `@id`        | `cuid()` |
| `canvasId`   | String   | —            | —        |
| `name`       | String   | —            | —        |
| `attributes` | String   | —            | `"{}"`   |
| `createdAt`  | DateTime | —            | `now()`  |
| `updatedAt`  | DateTime | `@updatedAt` | —        |

**JSON fields:** `attributes` stores arbitrary case metadata as a JSON string.

**Unique:** `@@unique([canvasId, name])`

**Relations:**

- `canvas` -> CodingCanvas (on delete: **Cascade**)
- `transcripts` -> CanvasTranscript[]

**Indexes:** `canvasId`

---

### CanvasRelation

Edges between nodes on the canvas (code-to-code, question-to-memo, etc.).

| Field       | Type     | Constraints | Default  |
| ----------- | -------- | ----------- | -------- |
| `id`        | String   | `@id`       | `cuid()` |
| `canvasId`  | String   | —           | —        |
| `fromType`  | String   | —           | —        |
| `fromId`    | String   | —           | —        |
| `toType`    | String   | —           | —        |
| `toId`      | String   | —           | —        |
| `label`     | String   | —           | —        |
| `createdAt` | DateTime | —           | `now()`  |

**Relations:** `canvas` -> CodingCanvas (on delete: **Cascade**)

**Indexes:** `canvasId`

---

### CanvasComputedNode

Analysis/visualization nodes (stats, word cloud, co-occurrence, etc.) with persisted config and results.

| Field       | Type     | Constraints  | Default  |
| ----------- | -------- | ------------ | -------- |
| `id`        | String   | `@id`        | `cuid()` |
| `canvasId`  | String   | —            | —        |
| `nodeType`  | String   | —            | —        |
| `label`     | String   | —            | —        |
| `config`    | String   | —            | `"{}"`   |
| `result`    | String   | —            | `"{}"`   |
| `createdAt` | DateTime | —            | `now()`  |
| `updatedAt` | DateTime | `@updatedAt` | —        |

**JSON fields:** `config` stores analysis parameters; `result` stores computed output. Both are JSON strings.

**Relations:** `canvas` -> CodingCanvas (on delete: **Cascade**)

**Indexes:** `canvasId`

---

### ConsentRecord

Ethics consent tracking for research participants.

| Field            | Type      | Constraints | Default      |
| ---------------- | --------- | ----------- | ------------ |
| `id`             | String    | `@id`       | `cuid()`     |
| `canvasId`       | String    | —           | —            |
| `participantId`  | String    | —           | —            |
| `consentType`    | String    | —           | `"informed"` |
| `consentStatus`  | String    | —           | `"active"`   |
| `consentDate`    | DateTime  | —           | `now()`      |
| `withdrawalDate` | DateTime? | —           | —            |
| `ethicsProtocol` | String?   | —           | —            |
| `notes`          | String?   | —           | —            |
| `createdAt`      | DateTime  | —           | `now()`      |

**Unique:** `@@unique([canvasId, participantId])`

**Relations:** `canvas` -> CodingCanvas (on delete: **Cascade**)

**Indexes:** `canvasId`, `participantId`

---

### AuditLog

Immutable audit trail for security and compliance. No foreign keys (standalone).

| Field        | Type     | Constraints | Default  |
| ------------ | -------- | ----------- | -------- |
| `id`         | String   | `@id`       | `cuid()` |
| `timestamp`  | DateTime | —           | `now()`  |
| `action`     | String   | —           | —        |
| `resource`   | String   | —           | —        |
| `resourceId` | String?  | —           | —        |
| `actorType`  | String   | —           | —        |
| `actorId`    | String?  | —           | —        |
| `ip`         | String?  | —           | —        |
| `method`     | String?  | —           | —        |
| `path`       | String?  | —           | —        |
| `statusCode` | Int?     | —           | —        |
| `meta`       | String?  | —           | —        |

**JSON fields:** `meta` stores additional context as a JSON string.

**Indexes:** `action`, `timestamp`, `actorId`

**Note:** No cascade relations. Audit logs are never deleted when related entities are removed.

---

### WebhookEvent

Idempotency table for Stripe webhook deduplication.

| Field       | Type     | Constraints | Default |
| ----------- | -------- | ----------- | ------- |
| `id`        | String   | `@id`       | —       |
| `type`      | String   | —           | —       |
| `createdAt` | DateTime | —           | `now()` |

**Note:** The `id` is the Stripe event ID (not auto-generated), ensuring each webhook is processed exactly once.

**Migration discipline (post-incident, 2026-05-15):** The `WebhookEvent` model was added to `schema.prisma` in March 2026 but the migration was not generated until commit `11ea498` (2026-05-07). For ~2.5 months every Stripe webhook crashed the backend with `P2021: table does not exist`, the latest Railway deployment (`15b92f32`, May 3) sat in CRASHED status for 3+ days, and `qualcanvas.com` was unreachable. Migration `0018_add_webhook_event` resolved it. **Before shipping a Prisma model change, generate its migration in the same PR.** The CI check `npx prisma migrate status` should catch a divergent schema; if you find yourself disabling it, you are about to repeat this incident.

---

### CanvasCollaborator

Tracks users who have collaborative access to a canvas.

| Field       | Type     | Constraints | Default    |
| ----------- | -------- | ----------- | ---------- |
| `id`        | String   | `@id`       | `cuid()`   |
| `canvasId`  | String   | —           | —          |
| `userId`    | String   | —           | —          |
| `role`      | String   | —           | `"editor"` |
| `invitedBy` | String?  | —           | —          |
| `createdAt` | DateTime | —           | `now()`    |

**Role values:** `owner`, `editor`, `viewer`

**Unique:** `@@unique([canvasId, userId])`

**Relations:** `canvas` -> CodingCanvas (on delete: **Cascade**)

**Indexes:** `canvasId`, `userId`

---

### CanvasDocument

Image or PDF documents attached to a canvas for visual/region coding.

| Field          | Type     | Constraints | Default  |
| -------------- | -------- | ----------- | -------- |
| `id`           | String   | `@id`       | `cuid()` |
| `canvasId`     | String   | —           | —        |
| `fileUploadId` | String   | —           | —        |
| `title`        | String   | —           | —        |
| `docType`      | String   | —           | —        |
| `pageCount`    | Int      | —           | `1`      |
| `metadata`     | String   | —           | `"{}"`   |
| `createdAt`    | DateTime | —           | `now()`  |

**docType values:** `image`, `pdf`

**JSON fields:** `metadata` stores document-specific attributes.

**Relations:**

- `canvas` -> CodingCanvas (on delete: **Cascade**)
- `regionCodings` -> DocumentRegionCoding[]

**Indexes:** `canvasId`

---

### DocumentRegionCoding

Region-based coding on a document page (bounding box coordinates as percentages).

| Field        | Type     | Constraints | Default  |
| ------------ | -------- | ----------- | -------- |
| `id`         | String   | `@id`       | `cuid()` |
| `documentId` | String   | —           | —        |
| `questionId` | String   | —           | —        |
| `pageNumber` | Int      | —           | `1`      |
| `x`          | Float    | —           | —        |
| `y`          | Float    | —           | —        |
| `width`      | Float    | —           | —        |
| `height`     | Float    | —           | —        |
| `note`       | String?  | —           | —        |
| `createdAt`  | DateTime | —           | `now()`  |

**Note:** `x`, `y`, `width`, `height` are percentages (0-100) for resolution independence.

**Relations:** `document` -> CanvasDocument (on delete: **Cascade**)

**Indexes:** `documentId`

---

### TrainingDocument

Coder training exercises with gold-standard codings for intercoder reliability.

| Field           | Type     | Constraints | Default  |
| --------------- | -------- | ----------- | -------- |
| `id`            | String   | `@id`       | `cuid()` |
| `canvasId`      | String   | —           | —        |
| `transcriptId`  | String   | —           | —        |
| `name`          | String   | —           | —        |
| `instructions`  | String?  | —           | —        |
| `goldCodings`   | String   | —           | —        |
| `passThreshold` | Float    | —           | `0.7`    |
| `createdAt`     | DateTime | —           | `now()`  |

**JSON fields:** `goldCodings` stores `[{questionId, startOffset, endOffset, codedText}]`.

**Relations:**

- `canvas` -> CodingCanvas (on delete: **Cascade**)
- `attempts` -> TrainingAttempt[]

**Indexes:** `canvasId`

---

### TrainingAttempt

A coder's attempt at a training exercise, with Kappa score.

| Field                | Type     | Constraints | Default  |
| -------------------- | -------- | ----------- | -------- |
| `id`                 | String   | `@id`       | `cuid()` |
| `trainingDocumentId` | String   | —           | —        |
| `userId`             | String   | —           | —        |
| `codings`            | String   | —           | —        |
| `kappaScore`         | Float?   | —           | —        |
| `passed`             | Boolean  | —           | `false`  |
| `createdAt`          | DateTime | —           | `now()`  |

**JSON fields:** `codings` stores the user's submitted codings as JSON.

**Relations:** `trainingDocument` -> TrainingDocument (on delete: **Cascade**)

**Indexes:** `trainingDocumentId`

---

### FileUpload

Uploaded files (audio, images, PDFs) with processing status tracking.

| Field          | Type     | Constraints  | Default      |
| -------------- | -------- | ------------ | ------------ |
| `id`           | String   | `@id`        | `cuid()`     |
| `canvasId`     | String?  | —            | —            |
| `userId`       | String?  | —            | —            |
| `storageKey`   | String   | `@unique`    | —            |
| `originalName` | String   | —            | —            |
| `mimeType`     | String   | —            | —            |
| `sizeBytes`    | Int      | —            | —            |
| `status`       | String   | —            | `"uploaded"` |
| `metadata`     | String   | —            | `"{}"`       |
| `createdAt`    | DateTime | —            | `now()`      |
| `updatedAt`    | DateTime | `@updatedAt` | —            |

**Status values:** `uploaded`, `processing`, `ready`, `error`

**JSON fields:** `metadata` stores file-specific attributes.

**Relations:**

- `canvas` -> CodingCanvas? (on delete: **SetNull**)
- `transcriptionJobs` -> TranscriptionJob[]

**Indexes:** `canvasId`, `storageKey`

---

### TranscriptionJob

Audio/video transcription job tracking with progress.

| Field            | Type     | Constraints  | Default    |
| ---------------- | -------- | ------------ | ---------- |
| `id`             | String   | `@id`        | `cuid()`   |
| `fileUploadId`   | String   | —            | —          |
| `canvasId`       | String   | —            | —          |
| `status`         | String   | —            | `"queued"` |
| `progress`       | Float    | —            | `0`        |
| `resultText`     | String?  | —            | —          |
| `resultSegments` | String?  | —            | —          |
| `errorMessage`   | String?  | —            | —          |
| `createdAt`      | DateTime | —            | `now()`    |
| `updatedAt`      | DateTime | `@updatedAt` | —          |

**Status values:** `queued`, `processing`, `completed`, `failed`

**JSON fields:** `resultSegments` stores `[{start, end, text}]` for timestamped transcription segments.

**Relations:** `fileUpload` -> FileUpload (on delete: **Cascade**)

**Indexes:** `canvasId`, `status`

---

### TextEmbedding

Vector embeddings for semantic search in the research assistant.

| Field        | Type   | Constraints | Default  |
| ------------ | ------ | ----------- | -------- |
| `id`         | String | `@id`       | `cuid()` |
| `canvasId`   | String | —           | —        |
| `sourceType` | String | —           | —        |
| `sourceId`   | String | —           | —        |
| `chunkIndex` | Int    | —           | `0`      |
| `chunkText`  | String | —           | —        |
| `embedding`  | String | —           | —        |

**sourceType values:** `transcript_chunk`, `coding`, `memo`

**JSON fields:** `embedding` stores a float array as a JSON string.

**Unique:** `@@unique([sourceType, sourceId, chunkIndex])`

**Relations:** `canvas` -> CodingCanvas (on delete: **Cascade**)

**Indexes:** `canvasId`

---

### ChatMessage

Research assistant chat history with citation tracking.

| Field       | Type     | Constraints | Default  |
| ----------- | -------- | ----------- | -------- |
| `id`        | String   | `@id`       | `cuid()` |
| `canvasId`  | String   | —           | —        |
| `userId`    | String?  | —           | —        |
| `role`      | String   | —           | —        |
| `content`   | String   | —           | —        |
| `citations` | String   | —           | `"[]"`   |
| `createdAt` | DateTime | —           | `now()`  |

**Role values:** `user`, `assistant`

**JSON fields:** `citations` stores `[{sourceType, sourceId, text}]`.

**Relations:** `canvas` -> CodingCanvas (on delete: **Cascade**)

**Indexes:** `[canvasId, createdAt]` (compound)

---

### Summary

AI-generated summaries of transcripts, codings, or the entire canvas.

| Field         | Type     | Constraints  | Default        |
| ------------- | -------- | ------------ | -------------- |
| `id`          | String   | `@id`        | `cuid()`       |
| `canvasId`    | String   | —            | —              |
| `sourceType`  | String   | —            | —              |
| `sourceId`    | String?  | —            | —              |
| `summaryText` | String   | —            | —              |
| `summaryType` | String   | —            | `"paraphrase"` |
| `createdAt`   | DateTime | —            | `now()`        |
| `updatedAt`   | DateTime | `@updatedAt` | —              |

**sourceType values:** `transcript`, `coding`, `question`, `canvas`

**summaryType values:** `paraphrase`, `abstract`, `thematic`

**Relations:** `canvas` -> CodingCanvas (on delete: **Cascade**)

**Indexes:** `canvasId`, `[sourceType, sourceId]` (compound)

---

### AiSuggestion

AI-generated coding suggestions awaiting user review.

| Field           | Type     | Constraints | Default     |
| --------------- | -------- | ----------- | ----------- |
| `id`            | String   | `@id`       | `cuid()`    |
| `canvasId`      | String   | —           | —           |
| `transcriptId`  | String   | —           | —           |
| `questionId`    | String?  | —           | —           |
| `suggestedText` | String   | —           | —           |
| `startOffset`   | Int      | —           | —           |
| `endOffset`     | Int      | —           | —           |
| `codedText`     | String   | —           | —           |
| `confidence`    | Float    | —           | `0`         |
| `status`        | String   | —           | `"pending"` |
| `createdAt`     | DateTime | —           | `now()`     |

**Status values:** `pending`, `accepted`, `rejected`

**Relations:**

- `canvas` -> CodingCanvas (on delete: **Cascade**)
- `transcript` -> CanvasTranscript (on delete: **Cascade**)

**Indexes:** `canvasId`, `transcriptId`, `status`

---

### AiUsage

Token usage and cost tracking for AI features. Standalone (no FK relations).

| Field          | Type     | Constraints | Default  |
| -------------- | -------- | ----------- | -------- |
| `id`           | String   | `@id`       | `cuid()` |
| `userId`       | String?  | —           | —        |
| `canvasId`     | String?  | —           | —        |
| `feature`      | String   | —           | —        |
| `provider`     | String   | —           | —        |
| `model`        | String   | —           | —        |
| `inputTokens`  | Int      | —           | `0`      |
| `outputTokens` | Int      | —           | `0`      |
| `costCents`    | Float    | —           | `0`      |
| `createdAt`    | DateTime | —           | `now()`  |

**Feature values:** `suggest_codes`, `auto_code`, `summarize`, `chat`, `transcribe`

**Provider values:** `openai`, `anthropic`

**Indexes:** `userId`, `createdAt`

---

### ResearchRepository

Collections of research insights across canvases.

| Field         | Type     | Constraints | Default  |
| ------------- | -------- | ----------- | -------- |
| `id`          | String   | `@id`       | `cuid()` |
| `userId`      | String   | —           | —        |
| `name`        | String   | —           | —        |
| `description` | String?  | —           | —        |
| `createdAt`   | DateTime | —           | `now()`  |

**Unique:** `@@unique([userId, name])`

**Relations:**

- `user` -> User (on delete: **Cascade**)
- `insights` -> RepositoryInsight[]

---

### RepositoryInsight

Individual insights saved to a research repository.

| Field          | Type     | Constraints | Default  |
| -------------- | -------- | ----------- | -------- |
| `id`           | String   | `@id`       | `cuid()` |
| `repositoryId` | String   | —           | —        |
| `canvasId`     | String?  | —           | —        |
| `title`        | String   | —           | —        |
| `content`      | String   | —           | —        |
| `tags`         | String   | —           | `"[]"`   |
| `sourceType`   | String?  | —           | —        |
| `sourceId`     | String?  | —           | —        |
| `createdAt`    | DateTime | —           | `now()`  |

**JSON fields:** `tags` stores a JSON array of tag strings.

**Relations:** `repository` -> ResearchRepository (on delete: **Cascade**)

**Indexes:** `repositoryId`

---

### Integration

Third-party service connections (Zoom, Slack, Qualtrics) with OAuth tokens.

| Field          | Type      | Constraints | Default  |
| -------------- | --------- | ----------- | -------- |
| `id`           | String    | `@id`       | `cuid()` |
| `userId`       | String    | —           | —        |
| `provider`     | String    | —           | —        |
| `accessToken`  | String    | —           | —        |
| `refreshToken` | String?   | —           | —        |
| `metadata`     | String    | —           | `"{}"`   |
| `expiresAt`    | DateTime? | —           | —        |
| `createdAt`    | DateTime  | —           | `now()`  |

**Provider values:** `zoom`, `slack`, `qualtrics`

**JSON fields:** `metadata` stores provider-specific configuration.

**Unique:** `@@unique([userId, provider])`

**Relations:** `user` -> User (on delete: **Cascade**)

---

### Team

Team entity for Team-tier collaborative workspaces.

| Field       | Type     | Constraints  | Default  |
| ----------- | -------- | ------------ | -------- |
| `id`        | String   | `@id`        | `cuid()` |
| `name`      | String   | —            | —        |
| `ownerId`   | String   | —            | —        |
| `createdAt` | DateTime | —            | `now()`  |
| `updatedAt` | DateTime | `@updatedAt` | —        |

**Relations:**

- `owner` -> User (named "TeamOwner", no cascade specified)
- `members` -> TeamMember[]

**Indexes:** `ownerId`

---

### TeamMember

Team membership with role-based access.

| Field      | Type     | Constraints | Default    |
| ---------- | -------- | ----------- | ---------- |
| `id`       | String   | `@id`       | `cuid()`   |
| `teamId`   | String   | —           | —          |
| `userId`   | String   | —           | —          |
| `role`     | String   | —           | `"member"` |
| `joinedAt` | DateTime | —           | `now()`    |

**Role values:** `owner`, `admin`, `member`

**Unique:** `@@unique([teamId, userId])`

**Relations:**

- `team` -> Team (on delete: **Cascade**)
- `user` -> User (on delete: **Cascade**)

**Indexes:** `teamId`, `userId`

### Notification

In-app notifications pushed via WebSocket and persisted for later viewing.

| Field       | Type     | Constraints | Default  |
| ----------- | -------- | ----------- | -------- |
| `id`        | String   | `@id`       | `cuid()` |
| `userId`    | String   | —           | —        |
| `type`      | String   | —           | —        |
| `title`     | String   | —           | —        |
| `message`   | String   | —           | —        |
| `read`      | Boolean  | —           | `false`  |
| `metadata`  | String   | —           | `"{}"`   |
| `createdAt` | DateTime | —           | `now()`  |

**Type values:** `coding_added`, `canvas_shared`, `team_invite`, `comment`, `mention`

**JSON fields:** `metadata` stores `{ canvasId, canvasName, actorName, actorId, teamId, teamName }`.

**Relations:** `user` -> User (on delete: **Cascade**)

**Indexes:** `[userId, read]`, `[userId, createdAt]`

---

### ReportSchedule

Scheduled email report configurations (daily, weekly, monthly).

| Field       | Type      | Constraints | Default    |
| ----------- | --------- | ----------- | ---------- |
| `id`        | String    | `@id`       | `cuid()`   |
| `userId`    | String    | —           | —          |
| `canvasId`  | String?   | —           | —          |
| `teamId`    | String?   | —           | —          |
| `frequency` | String    | —           | `"weekly"` |
| `dayOfWeek` | Int?      | —           | `1`        |
| `lastSent`  | DateTime? | —           | —          |
| `enabled`   | Boolean   | —           | `true`     |
| `createdAt` | DateTime  | —           | `now()`    |

**Frequency values:** `daily`, `weekly`, `monthly`

**dayOfWeek:** 0=Sunday through 6=Saturday (used for weekly reports).

**Relations:** `user` -> User (on delete: **Cascade**)

**Indexes:** `userId`, `[enabled, lastSent]`

---

### CalendarEvent

Research calendar events for tracking milestones, deadlines, and sessions.

| Field         | Type      | Constraints  | Default       |
| ------------- | --------- | ------------ | ------------- |
| `id`          | String    | `@id`        | `cuid()`      |
| `userId`      | String    | —            | —             |
| `canvasId`    | String?   | —            | —             |
| `teamId`      | String?   | —            | —             |
| `title`       | String    | —            | —             |
| `description` | String?   | —            | —             |
| `startDate`   | DateTime  | —            | —             |
| `endDate`     | DateTime? | —            | —             |
| `allDay`      | Boolean   | —            | `false`       |
| `type`        | String    | —            | `"milestone"` |
| `color`       | String?   | —            | —             |
| `reminder`    | Int?      | —            | —             |
| `createdAt`   | DateTime  | —            | `now()`       |
| `updatedAt`   | DateTime  | `@updatedAt` | —             |

**Type values:** `milestone`, `deadline`, `session`, `review`

**reminder:** Minutes before the event to trigger a reminder (used in iCal alarm output).

**Relations:** `user` -> User (on delete: **Cascade**)

**Indexes:** `[userId, startDate]`, `canvasId`

---

## 4. Key Patterns

### Soft Delete

Models with a `deletedAt` (DateTime?) field support soft delete:

- **CodingCanvas** — `deletedAt` indexed for efficient filtering
- **CanvasTranscript** — `deletedAt` indexed for efficient filtering

Soft-deleted records are excluded from normal queries and can be restored by setting `deletedAt` back to `null`.

### Audit Logging

The `AuditLog` model provides an immutable audit trail:

- Records every significant action (`action` field) on any resource
- Captures HTTP context: `method`, `path`, `statusCode`, `ip`
- Actor tracking via `actorType` and `actorId`
- No foreign keys to other tables (survives entity deletion)
- `meta` field stores arbitrary JSON context
- Indexed by `action`, `timestamp`, and `actorId` for efficient querying

### Encryption (UserAiConfig)

User-provided AI API keys are encrypted at rest using AES-256-GCM:

- `apiKeyEncrypted` — the ciphertext
- `apiKeyIv` — the initialization vector (unique per encryption)
- `apiKeyTag` — the GCM authentication tag (integrity verification)
- Requires the `ENCRYPTION_KEY` environment variable (32-byte hex) for encrypt/decrypt
- Each user has at most one AI config (`userId` is `@unique`)

### JSON Fields

Several models store structured data as JSON strings (since SQLite compatibility requires string storage):

| Model              | Field            | Content                                             |
| ------------------ | ---------------- | --------------------------------------------------- |
| CanvasTranscript   | `timestamps`     | `[{start, end, text}]` — media sync data            |
| CanvasCase         | `attributes`     | Arbitrary case metadata                             |
| CanvasComputedNode | `config`         | Analysis parameters                                 |
| CanvasComputedNode | `result`         | Computed analysis output                            |
| CanvasDocument     | `metadata`       | Document attributes                                 |
| FileUpload         | `metadata`       | File attributes                                     |
| TranscriptionJob   | `resultSegments` | `[{start, end, text}]` — transcription segments     |
| TrainingDocument   | `goldCodings`    | `[{questionId, startOffset, endOffset, codedText}]` |
| TrainingAttempt    | `codings`        | User-submitted codings                              |
| TextEmbedding      | `embedding`      | Float array (vector)                                |
| ChatMessage        | `citations`      | `[{sourceType, sourceId, text}]`                    |
| RepositoryInsight  | `tags`           | String array                                        |
| Integration        | `metadata`       | Provider-specific config                            |
| AuditLog           | `meta`           | Additional context                                  |
| Notification       | `metadata`       | `{ canvasId, canvasName, actorName, actorId, ... }` |

### Webhook Idempotency

The `WebhookEvent` model uses the Stripe event ID as its primary key (`@id` without `@default`). Before processing a webhook, the handler checks if the event ID already exists, ensuring each event is processed exactly once.

### Cascade Rules Summary

| On Delete Rule | Used By                                                                    |
| -------------- | -------------------------------------------------------------------------- |
| **Cascade**    | Most child entities (transcripts, codings, questions, memos, shares, etc.) |
| **SetNull**    | DashboardAccess.user, CanvasTranscript.case, FileUpload.canvas             |

When a CodingCanvas is deleted, all its children (transcripts, questions, memos, codings, positions, cases, relations, computed nodes, shares, consent records, suggestions, embeddings, chat messages, summaries, collaborators, documents, training documents) are cascade-deleted. FileUploads are set to null (orphaned but preserved).

## 5. Migration Strategy

### Development

```bash
# Push schema changes directly (for rapid iteration)
npx prisma db push --schema=apps/backend/prisma/schema.prisma

# Or create a migration (generates SQL in prisma/migrations/)
npx prisma migrate dev --schema=apps/backend/prisma/schema.prisma --name description_of_change
```

### Production

```bash
# Apply pending migrations (non-destructive, idempotent)
npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma
```

### CI

The GitHub Actions pipeline uses SQLite for testing:

```bash
npx prisma generate --schema=apps/backend/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma
```

### Docker

The Docker entrypoint automatically runs migrations before starting the server:

```dockerfile
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
```

### Key Notes

- Migration files are in `apps/backend/prisma/migrations/`
- `prisma migrate deploy` is safe to run multiple times (idempotent)
- The schema provider must stay as `"postgresql"` in committed code
- For local SQLite: use `prisma db push` or temporarily switch the provider (don't commit)
- Always generate the Prisma client after schema changes: `npx prisma generate`

## 6. Admin Portal Queries

The admin portal (`adminRoutes.ts`) does not introduce new database models. Instead, it aggregates data from existing tables:

| Admin Endpoint         | Tables Queried                                                          |
| ---------------------- | ----------------------------------------------------------------------- |
| `GET /admin/dashboard` | User, CodingCanvas, AuditLog, Subscription, CanvasComputedNode, AiUsage |
| `GET /admin/users`     | User, AuditLog (last login lookup), CodingCanvas (count)                |
| `GET /admin/users/:id` | User, Subscription, CodingCanvas, AuditLog, AiUsage                     |
| `GET /admin/billing`   | Subscription, User                                                      |
| `GET /admin/health`    | Raw SQL (`SELECT 1`) for connectivity check                             |
| `GET /admin/activity`  | AuditLog, User (email lookup)                                           |
| `GET /admin/features`  | CanvasComputedNode, AiUsage                                             |

---

## 10. Client-Side Data (No Schema Changes)

### Cross-Canvas References

Cross-canvas reference links (Phase 4 UX feature) are stored entirely in the browser via `localStorage`, not in the database. The implementation lives in `apps/frontend/src/lib/crossCanvasRefs.ts`.

**Storage key:** `qualcanvas-cross-refs`

This design means cross-canvas refs are per-browser and do not sync between users or devices. A future iteration could persist them to the database if needed, but the current 37-model schema remains unchanged.
