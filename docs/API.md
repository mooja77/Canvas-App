# Canvas App — API Reference

Base URL: `/api`

## Authentication

All protected endpoints require the `x-dashboard-code` header containing a JWT token obtained from the login endpoint.

**Rate Limits:** 500 req/15min general, 30 req/15min for computation endpoints.
**Body Limits:** 1MB default, 10MB for transcript and import routes.
**Timeout:** 30 seconds per request.

---

## Auth

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/auth` | No | Login with dashboard code, returns JWT |
| POST | `/auth/register` | No | Create account (gated by `REGISTRATION_ENABLED` in production) |

**POST /auth** — `{ dashboardCode: string }`
**POST /auth/register** — `{ name: string (1-100), role?: 'researcher'|'policymaker'|'funder' }`

## Canvas

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/canvas` | Yes | List canvases (paginated: `?limit=50&offset=0`) |
| POST | `/canvas` | Yes | Create canvas |
| GET | `/canvas/:id` | Yes | Get full canvas with all relations |
| PUT | `/canvas/:id` | Yes | Update name/description |
| DELETE | `/canvas/:id` | Yes | Delete canvas and all data |

## Transcripts

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/canvas/:id/transcripts` | Yes | Add transcript (10MB limit) |
| PUT | `/canvas/:id/transcripts/:tid` | Yes | Update transcript |
| DELETE | `/canvas/:id/transcripts/:tid` | Yes | Delete transcript |
| POST | `/canvas/:id/import-narratives` | Yes | Bulk import (1-100 items, 10MB) |
| POST | `/canvas/:id/import-from-canvas` | Yes | Copy from another canvas |

## Questions

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/canvas/:id/questions` | Yes | Create question |
| PUT | `/canvas/:id/questions/:qid` | Yes | Update (supports hierarchy via parentQuestionId) |
| DELETE | `/canvas/:id/questions/:qid` | Yes | Delete question |
| POST | `/canvas/:id/questions/merge` | Yes | Merge source into target |

## Codings

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/canvas/:id/codings` | Yes | Create text coding (audited) |
| PUT | `/canvas/:id/codings/:cid` | Yes | Update annotation (audited) |
| DELETE | `/canvas/:id/codings/:cid` | Yes | Delete coding (audited) |
| PUT | `/canvas/:id/codings/:cid/reassign` | Yes | Reassign to different question |
| POST | `/canvas/:id/auto-code` | Yes | Bulk pattern matching (keyword/regex) |

## Memos, Cases, Relations

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST/PUT/DELETE | `/canvas/:id/memos[/:mid]` | Yes | CRUD for research memos |
| POST/PUT/DELETE | `/canvas/:id/cases[/:cid]` | Yes | CRUD for analytical cases |
| POST/PUT/DELETE | `/canvas/:id/relations[/:rid]` | Yes | CRUD for concept connections |

## Computed Nodes (Analysis)

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/canvas/:id/computed` | Yes | Create node (types: search, cooccurrence, matrix, stats, comparison, wordcloud, cluster, codingquery, sentiment, treemap) |
| PUT | `/canvas/:id/computed/:nid` | Yes | Update config/label |
| DELETE | `/canvas/:id/computed/:nid` | Yes | Delete node |
| POST | `/canvas/:id/computed/:nid/run` | Yes | Execute analysis (rate limited) |

## Layout

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| PUT | `/canvas/:id/layout` | Yes | Save node positions |

## Sharing

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/canvas/:id/share` | Yes | Generate share code |
| GET | `/canvas/:id/shares` | Yes | List share codes |
| GET | `/canvas/shared/:code` | No | View shared canvas (public) |
| POST | `/canvas/clone/:code` | Yes | Clone shared canvas |

## Ethics & Compliance

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/canvas/:id/ethics` | Yes | Get ethics settings + consent records |
| PUT | `/canvas/:id/ethics` | Yes | Update ethics status/approval |
| POST | `/canvas/:id/consent` | Yes | Record participant consent |
| GET | `/canvas/:id/consent` | Yes | List consent records |
| PUT | `/canvas/:id/consent/:cid/withdraw` | Yes | Withdraw consent |
| POST | `/canvas/:id/transcripts/:tid/anonymize` | Yes | Anonymize transcript content |
| GET | `/audit-log` | Yes | Export audit trail (`?from=&to=&action=&limit=&offset=`) |

## System

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| GET | `/health` | No | Health check with DB ping |
