# Database Guide

## Canonical configuration

QualCanvas uses PostgreSQL in development, CI, Docker, and production. The
canonical schema is [`apps/backend/prisma/schema.prisma`](../apps/backend/prisma/schema.prisma)
and currently contains 46 models. Production runs PostgreSQL 16 on Railway.

SQLite URLs such as `file:./canvas-app.db` are not supported by the committed
`provider = "postgresql"` schema. Prisma rejects them during validation and
migration. Do not switch providers locally: doing so stops local constraints and
migrations from matching production.

Example local URL:

```dotenv
DATABASE_URL=postgresql://canvas:canvas_dev_password@localhost:5432/canvas_app?schema=public
```

The root `docker-compose.yml` provides a PostgreSQL 16 service when a local
installation is not available.

## Model map

`CodingCanvas` is the aggregate root for research work. Its main children are:

- sources and coding: `CanvasTranscript`, `CanvasQuestion`,
  `CanvasTextCoding`, `CanvasMemo`, `CanvasCase`;
- spatial analysis: `CanvasNodePosition`, `CanvasRelation`,
  `CanvasComputedNode`;
- durable research notes: `CanvasJournalEntry` and `CanvasArtifact`;
- governance: `ConsentRecord`, `AuditLog`, `CanvasCollaborator`,
  `CanvasShare`;
- document/training workflows: `CanvasDocument`, `DocumentRegionCoding`,
  `TrainingDocument`, `TrainingAttempt`;
- AI and media: `AiSuggestion`, `AiUsage`, `TextEmbedding`, `ChatMessage`,
  `Summary`, `FileUpload`, `TranscriptionJob`.

Account and commercial data are rooted at `User`, `DashboardAccess`,
`Subscription`, `Team`, `TeamMember`, `UserAiConfig`, `Integration`, and
`ResearchRepository`.

Always read the Prisma schema for the current field-level contract; this guide
deliberately avoids duplicating every field and becoming stale.

## Canvas artefacts

`CanvasArtifact` stores one validated JSON document per canvas and artefact
type. The supported types are:

- `sticky-notes`;
- `theme-groups`;
- `code-weights`.

The authenticated API validates each shape, enforces canvas ownership or
collaborator access, and blocks writes from view-only collaborators. The
frontend keeps a local cache for offline continuity and automatically migrates
values written by localStorage-only releases.

The unique key is `(canvasId, type)`. Deleting a canvas cascades to its
artefacts. Account exports include them.

## Structured data

Several fields contain serialized JSON because they are treated as atomic
documents by the application, not for SQLite compatibility. Parsing must use a
safe fallback at API boundaries. Important examples include case attributes,
computed-node configuration/results, transcript timestamps, embeddings,
training codings, citations, integration metadata, and canvas artefacts.

## Migration workflow

Create a named migration against a disposable PostgreSQL database:

```bash
npx prisma migrate dev --schema=apps/backend/prisma/schema.prisma --name concise_change_name
npx prisma generate --schema=apps/backend/prisma/schema.prisma
```

Validate before committing:

```bash
npx prisma validate --schema=apps/backend/prisma/schema.prisma
npx prisma migrate deploy --schema=apps/backend/prisma/schema.prisma
```

Production starts with `prisma migrate deploy`; migrations must therefore be
additive or explicitly safe for existing Railway data. Never edit an already
deployed migration.

CI replays the complete migration history on a clean PostgreSQL 16 service and
uses `prisma migrate diff --exit-code` to detect schema drift.

## Integrity and privacy rules

- All canvas-scoped reads and writes must call `getOwnedCanvas`.
- Owner-only destructive/share-management actions must pass
  `requireOwner: true`.
- Child relations use cascade deletion where the data has no meaning without
  the canvas; deliberately independent audit history is retained.
- User AI keys are encrypted with AES-256-GCM and are never returned by the API.
- Use parameterized Prisma operations; do not interpolate untrusted values into
  raw SQL.
- Any new document-shaped artefact needs a strict Zod schema and size limits.

## Backup and recovery

Railway database backups are the production recovery source. Before a risky
migration, take/confirm a current backup and rehearse restore in a separate
database. Local Docker data lives in the `pgdata` named volume; deleting that
volume deletes local research data.

## Useful checks

```bash
npx prisma validate --schema=apps/backend/prisma/schema.prisma
npx prisma format --schema=apps/backend/prisma/schema.prisma
npm run typecheck
npm test -w apps/backend
```

Last reviewed: 2026-08-27.
