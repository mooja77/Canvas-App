# QualCanvas API Reference

Base URL: `/api` (also available at `/api/v1`)

## General Information

**Authentication:** All protected endpoints require the `x-dashboard-code` header containing a JWT token obtained from a login endpoint.

**Dual Auth:** The API supports two authentication modes:
- **Email auth** (modern) — JWT contains `userId`, `role`, `plan`
- **Legacy access-code auth** — JWT contains `dashboardAccessId`, `role`

**Rate Limits:**
- General: 500 requests / 15 minutes
- Auth endpoints: stricter (via `authLimiter`)
- Computation endpoints (`/canvas/:id/computed/:nodeId/run`): 30 requests / 15 minutes

**Body Limits:**
- Default: 1 MB
- Transcript & import routes: 10 MB
- File upload (direct): 500 MB
- QDPX import: 20 MB

**Timeout:** 30 seconds per request.

**Response envelope:** All responses use `{ success: boolean, data?: ..., error?: string }`.

**Plan header:** Authenticated responses include the `X-User-Plan` response header for client-side plan sync.

---

## 1. Auth — Legacy Access Code

### POST /api/auth
**Auth:** None
**Rate Limited:** Yes (authLimiter)
**Description:** Authenticate with a dashboard access code, returns JWT.
**Body:**
```json
{ "dashboardCode": "string" }
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "jwt": "string",
    "name": "string",
    "role": "researcher | policymaker | funder",
    "dashboardAccessId": "string"
  }
}
```
**Errors:** 400 (missing code), 401 (invalid/expired code)

---

### POST /api/auth/register
**Auth:** None
**Rate Limited:** Yes (authLimiter)
**Description:** Create a new dashboard access account. Gated by `REGISTRATION_ENABLED=true` in production.
**Body:**
```json
{
  "name": "string (1-100 chars, required)",
  "role": "researcher | policymaker | funder (optional, defaults to researcher)"
}
```
**Response (201):**
```json
{
  "success": true,
  "data": {
    "accessCode": "CANVAS-XXXXXXXX",
    "jwt": "string",
    "name": "string",
    "role": "string",
    "dashboardAccessId": "string"
  }
}
```
**Errors:** 400 (invalid name), 403 (registration disabled)

---

## 2. Auth — Email / Password

### POST /api/auth/signup
**Auth:** None
**Rate Limited:** Yes (authLimiter)
**Description:** Create an email account. Sends verification email.
**Body:**
```json
{
  "email": "string (required)",
  "password": "string (min 8, required)",
  "name": "string (1-100 chars, required)"
}
```
**Response (201):**
```json
{
  "success": true,
  "data": {
    "jwt": "string",
    "user": {
      "id": "string",
      "email": "string",
      "name": "string",
      "role": "string",
      "plan": "free",
      "emailVerified": false
    }
  }
}
```
**Errors:** 400 (validation), 409 (email exists)

---

### POST /api/auth/email-login
**Auth:** None
**Rate Limited:** Yes (authLimiter)
**Description:** Login with email and password. Auto-syncs plan from subscription status.
**Body:**
```json
{
  "email": "string",
  "password": "string"
}
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "jwt": "string",
    "user": {
      "id": "string",
      "email": "string",
      "name": "string",
      "role": "string",
      "plan": "free | pro | team",
      "emailVerified": "boolean"
    }
  }
}
```
**Errors:** 400 (missing fields), 401 (invalid credentials)

---

### POST /api/auth/google
**Auth:** None
**Rate Limited:** Yes (authLimiter)
**Description:** Google OAuth login or signup. Creates account on first use.
**Body:**
```json
{ "credential": "string (Google ID token)" }
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "jwt": "string",
    "user": { "id", "email", "name", "role", "plan", "emailVerified" }
  }
}
```
**Errors:** 400 (missing credential), 401 (invalid token), 500 (OAuth not configured)

---

### POST /api/auth/forgot-password
**Auth:** None
**Rate Limited:** Yes (authLimiter)
**Description:** Initiate password reset. Sends email with reset link.
**Body:**
```json
{ "email": "string" }
```
**Response (200):**
```json
{ "success": true, "message": "If an account exists, a reset link has been sent" }
```
**Errors:** 400 (missing email)

---

### POST /api/auth/reset-password
**Auth:** None
**Rate Limited:** Yes (authLimiter)
**Description:** Complete password reset with token from email.
**Body:**
```json
{
  "email": "string",
  "token": "string",
  "newPassword": "string (min 8)"
}
```
**Response (200):**
```json
{ "success": true, "message": "Password has been reset successfully" }
```
**Errors:** 400 (missing fields, invalid/expired token)

---

### POST /api/auth/verify-email
**Auth:** None
**Rate Limited:** Yes (authLimiter)
**Description:** Verify email address with token from verification email.
**Body:**
```json
{ "email": "string", "token": "string" }
```
**Response (200):**
```json
{ "success": true, "message": "Email verified successfully" }
```
**Errors:** 400 (invalid token, already verified)

---

### POST /api/auth/resend-verification
**Auth:** Required (email auth)
**Description:** Resend verification email.
**Body:** None
**Response (200):**
```json
{ "success": true, "message": "Verification email sent" }
```
**Errors:** 403 (legacy auth), 404 (user not found)

---

### GET /api/auth/me
**Auth:** Required
**Description:** Get current user profile, subscription status, and resource usage.
**Response (200) — Email auth:**
```json
{
  "success": true,
  "data": {
    "user": { "id", "email", "name", "role", "plan", "emailVerified", "createdAt" },
    "subscription": { "status", "currentPeriodEnd", "cancelAtPeriodEnd" } | null,
    "usage": { "canvasCount", "totalTranscripts", "totalCodes", "totalShares" },
    "authType": "email"
  }
}
```
**Response (200) — Legacy auth:**
```json
{
  "success": true,
  "data": {
    "user": { "name", "role", "plan": "pro" },
    "subscription": null,
    "usage": null,
    "authType": "legacy"
  }
}
```
**Errors:** 401 (unauthenticated), 404 (not found)

---

### POST /api/auth/link-account
**Auth:** Required (legacy access-code auth)
**Description:** Link an email to a legacy access-code account. Grandfathers to Pro plan.
**Body:**
```json
{
  "email": "string (required)",
  "password": "string (min 8, required)",
  "name": "string (optional)"
}
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "jwt": "string",
    "user": { "id", "email", "name", "role", "plan": "pro" }
  }
}
```
**Errors:** 400 (validation), 401 (not legacy auth), 409 (email exists)

---

### PUT /api/auth/profile
**Auth:** Required (email auth)
**Description:** Update name and/or email. Changing email resets verification.
**Body:**
```json
{
  "name": "string (1-100, optional)",
  "email": "string (optional)"
}
```
**Response (200):**
```json
{
  "success": true,
  "data": { "id", "email", "name", "emailVerified" }
}
```
**Errors:** 400 (validation, no fields), 403 (legacy auth), 409 (email in use)

---

### PUT /api/auth/change-password
**Auth:** Required (email auth)
**Description:** Change password (requires current password).
**Body:**
```json
{
  "currentPassword": "string",
  "newPassword": "string (min 8)"
}
```
**Response (200):**
```json
{ "success": true, "message": "Password changed successfully" }
```
**Errors:** 400 (validation), 401 (wrong current password), 403 (legacy auth)

---

### DELETE /api/auth/account
**Auth:** Required (email auth)
**Description:** Delete account permanently. Cancels Stripe subscription if active.
**Body:**
```json
{ "password": "string" }
```
**Response (200):**
```json
{ "success": true, "message": "Account deleted" }
```
**Errors:** 400 (missing password), 401 (wrong password), 403 (legacy auth)

---

### POST /api/auth/admin/seed-demo
**Auth:** None (requires `ADMIN_SEED_SECRET` in body)
**Description:** Seed or refresh the demo access code. Admin utility.
**Body:**
```json
{ "secret": "string (must match ADMIN_SEED_SECRET env var)" }
```
**Response (200):**
```json
{ "success": true, "message": "Demo access code seeded" }
```
**Errors:** 403 (wrong secret)

---

## 3. Canvas CRUD

### GET /api/canvas
**Auth:** Required
**Description:** List canvases (excludes soft-deleted). Paginated.
**Query:** `?limit=50&offset=0` (max limit: 200)
**Response (200):**
```json
{
  "success": true,
  "data": [{ "id", "name", "description", "createdAt", "updatedAt", "_count": { "transcripts", "questions", "codings" } }],
  "total": 10,
  "limit": 50,
  "offset": 0
}
```

---

### GET /api/canvas/trash
**Auth:** Required
**Description:** List soft-deleted canvases.
**Response (200):**
```json
{
  "success": true,
  "data": [{ "id", "name", "deletedAt", "_count": { "transcripts", "questions", "codings" } }]
}
```

---

### POST /api/canvas
**Auth:** Required
**Plan:** Enforced (checkCanvasLimit)
**Description:** Create a new canvas.
**Body:**
```json
{
  "name": "string (1-200, required)",
  "description": "string (max 1000, optional)"
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "name", "description", "createdAt" } }
```
**Errors:** 400 (validation), 403 (plan limit), 409 (duplicate name)

---

### GET /api/canvas/:canvasId
**Auth:** Required
**Description:** Get full canvas with all relations (transcripts, questions, memos, codings, cases, relations, computed nodes, node positions).
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id", "name", "description",
    "transcripts": [...],
    "questions": [...],
    "memos": [...],
    "codings": [...],
    "cases": [...],
    "relations": [...],
    "computedNodes": [...],
    "nodePositions": [...]
  }
}
```
**Errors:** 403 (not owner), 404 (not found)

---

### PUT /api/canvas/:canvasId
**Auth:** Required
**Description:** Update canvas name and/or description.
**Body:**
```json
{
  "name": "string (1-200, optional)",
  "description": "string (max 1000, optional)"
}
```
**Response (200):**
```json
{ "success": true, "data": { "id", "name", "description", "updatedAt" } }
```
**Errors:** 403 (not owner), 404 (not found), 409 (duplicate name)

---

### DELETE /api/canvas/:canvasId
**Auth:** Required
**Description:** Soft delete canvas (move to trash).
**Response (200):**
```json
{ "success": true }
```
**Errors:** 403 (not owner), 404 (not found)

---

### POST /api/canvas/:canvasId/restore
**Auth:** Required
**Description:** Restore a soft-deleted canvas from trash.
**Response (200):**
```json
{ "success": true, "data": { "id", "name", "deletedAt": null } }
```
**Errors:** 400 (not in trash), 403 (not owner), 404 (not found)

---

### DELETE /api/canvas/:canvasId/permanent
**Auth:** Required
**Description:** Permanently delete a trashed canvas and all its data.
**Response (200):**
```json
{ "success": true }
```
**Errors:** 400 (not in trash), 403 (not owner), 404 (not found)

---

### PUT /api/canvas/:id/layout
**Auth:** Required
**Description:** Save node positions for the canvas workspace.
**Body:**
```json
{
  "positions": [
    {
      "nodeId": "string",
      "nodeType": "string",
      "x": 100.0,
      "y": 200.0,
      "width": 300,
      "height": 200,
      "collapsed": false
    }
  ]
}
```
**Response (200):**
```json
{ "success": true }
```
**Errors:** 400 (validation), 403 (not owner)

---

## 4. Transcripts

### POST /api/canvas/:id/transcripts
**Auth:** Required
**Plan:** Enforced (checkTranscriptLimit, checkWordLimit)
**Body Limit:** 10 MB
**Description:** Add a transcript to a canvas.
**Body:**
```json
{
  "title": "string (1-200, required)",
  "content": "string (required)",
  "sourceType": "string (max 50, optional)",
  "sourceId": "string (max 200, optional)"
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "title", "content", "sortOrder", "createdAt" } }
```
**Errors:** 400 (validation), 403 (plan limit)

---

### PUT /api/canvas/:id/transcripts/:tid
**Auth:** Required
**Plan:** Enforced (checkWordLimit on content changes)
**Body Limit:** 10 MB
**Description:** Update transcript title, content, or case assignment.
**Body:**
```json
{
  "title": "string (1-200, optional)",
  "content": "string (optional)",
  "caseId": "string | null (optional)"
}
```
**Response (200):**
```json
{ "success": true, "data": { "id", "title", "content", "updatedAt" } }
```

---

### DELETE /api/canvas/:id/transcripts/:tid
**Auth:** Required
**Description:** Delete a transcript.
**Response (200):**
```json
{ "success": true }
```

---

### POST /api/canvas/:id/import-narratives
**Auth:** Required
**Plan:** Enforced (transcript + word limits)
**Body Limit:** 10 MB
**Description:** Bulk import up to 100 narratives.
**Body:**
```json
{
  "narratives": [
    {
      "title": "string (1-200)",
      "content": "string",
      "sourceType": "string (optional)",
      "sourceId": "string (optional)"
    }
  ]
}
```
**Response (201):**
```json
{ "success": true, "data": [{ "id", "title", "content" }] }
```
**Errors:** 400 (validation), 403 (plan limit)

---

### POST /api/canvas/:id/import-from-canvas
**Auth:** Required
**Plan:** Enforced (transcript + word limits)
**Body Limit:** 10 MB
**Description:** Copy transcripts from another canvas you own.
**Body:**
```json
{
  "sourceCanvasId": "string",
  "transcriptIds": ["string"] // 1-100 IDs
}
```
**Response (201):**
```json
{ "success": true, "data": [{ "id", "title", "content", "sourceType": "cross-canvas" }] }
```
**Errors:** 400 (validation), 403 (not owner of source / plan limit), 404 (source not found)

---

## 5. Questions (Codes)

### POST /api/canvas/:id/questions
**Auth:** Required
**Plan:** Enforced (checkCodeLimit)
**Description:** Create a question/code.
**Body:**
```json
{
  "text": "string (1-1000, required)",
  "color": "#RRGGBB (optional)"
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "text", "color", "sortOrder" } }
```
**Errors:** 403 (plan limit)

---

### PUT /api/canvas/:id/questions/:qid
**Auth:** Required
**Description:** Update a question's text, color, or parent (hierarchy).
**Body:**
```json
{
  "text": "string (1-1000, optional)",
  "color": "#RRGGBB (optional)",
  "parentQuestionId": "string | null (optional)"
}
```
**Response (200):**
```json
{ "success": true, "data": { "id", "text", "color", "parentQuestionId" } }
```

---

### DELETE /api/canvas/:id/questions/:qid
**Auth:** Required
**Description:** Delete a question and its codings.
**Response (200):**
```json
{ "success": true }
```

---

### POST /api/canvas/:id/questions/merge
**Auth:** Required
**Description:** Merge a source question into a target. Reassigns all codings and child questions, then deletes the source.
**Body:**
```json
{
  "sourceId": "string",
  "targetId": "string"
}
```
**Response (200):**
```json
{ "success": true, "data": { "targetId": "string", "codingCount": 5 } }
```
**Errors:** 400 (source/target not found in canvas)

---

## 6. Codings

### POST /api/canvas/:id/codings
**Auth:** Required
**Audited:** Yes
**Description:** Create a text coding (highlight). Links a text segment to a question.
**Body:**
```json
{
  "transcriptId": "string (required)",
  "questionId": "string (required)",
  "startOffset": 0,
  "endOffset": 50,
  "codedText": "string (required)",
  "note": "string (max 2000, optional)"
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "transcriptId", "questionId", "startOffset", "endOffset", "codedText", "note" } }
```
**Errors:** 400 (transcript/question not in canvas)

---

### PUT /api/canvas/:id/codings/:cid
**Auth:** Required
**Audited:** Yes
**Description:** Update a coding's annotation.
**Body:**
```json
{ "annotation": "string (max 5000) | null" }
```
**Response (200):**
```json
{ "success": true, "data": { "id", "annotation" } }
```

---

### DELETE /api/canvas/:id/codings/:cid
**Auth:** Required
**Audited:** Yes
**Description:** Delete a coding.
**Response (200):**
```json
{ "success": true }
```

---

### PUT /api/canvas/:id/codings/:cid/reassign
**Auth:** Required
**Audited:** Yes
**Description:** Reassign a coding to a different question.
**Body:**
```json
{ "newQuestionId": "string" }
```
**Response (200):**
```json
{ "success": true, "data": { "id", "questionId": "newQuestionId" } }
```
**Errors:** 400 (target question not in canvas)

---

### POST /api/canvas/:id/auto-code
**Auth:** Required
**Plan:** Enforced (checkAutoCode — Pro/Team only)
**Audited:** Yes
**Description:** Bulk pattern matching across transcripts. Creates codings for all matches.
**Body:**
```json
{
  "questionId": "string",
  "pattern": "string (1-500)",
  "mode": "keyword | regex",
  "transcriptIds": ["string"] // optional, filters to specific transcripts
}
```
**Response (201):**
```json
{ "success": true, "data": { "created": 12, "codings": [...] } }
```
**Errors:** 400 (question not in canvas), 403 (plan restriction)

---

## 7. Memos

### POST /api/canvas/:id/memos
**Auth:** Required
**Description:** Create a research memo.
**Body:**
```json
{
  "title": "string (max 200, optional)",
  "content": "string (1-5000, required)",
  "color": "#RRGGBB (optional)"
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "title", "content", "color" } }
```

---

### PUT /api/canvas/:id/memos/:mid
**Auth:** Required
**Description:** Update a memo.
**Body:**
```json
{
  "title": "string (max 200, optional)",
  "content": "string (1-5000, optional)",
  "color": "#RRGGBB (optional)"
}
```
**Response (200):**
```json
{ "success": true, "data": { "id", "title", "content", "color" } }
```

---

### DELETE /api/canvas/:id/memos/:mid
**Auth:** Required
**Description:** Delete a memo.
**Response (200):**
```json
{ "success": true }
```

---

## 8. Cases

### POST /api/canvas/:id/cases
**Auth:** Required
**Plan:** Enforced (checkCaseAccess — Pro/Team only)
**Description:** Create an analytical case.
**Body:**
```json
{
  "name": "string (1-200, required)",
  "attributes": { "key": "value" } // optional, string-string map
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "name", "attributes": {} } }
```
**Errors:** 403 (plan restriction), 409 (duplicate name in canvas)

---

### PUT /api/canvas/:id/cases/:caseId
**Auth:** Required
**Description:** Update a case name or attributes.
**Body:**
```json
{
  "name": "string (1-200, optional)",
  "attributes": { "key": "value" } // optional
}
```
**Response (200):**
```json
{ "success": true, "data": { "id", "name", "attributes" } }
```
**Errors:** 409 (duplicate name)

---

### DELETE /api/canvas/:id/cases/:caseId
**Auth:** Required
**Description:** Delete a case.
**Response (200):**
```json
{ "success": true }
```

---

## 9. Relations

### POST /api/canvas/:id/relations
**Auth:** Required
**Description:** Create a concept connection between questions and/or cases.
**Body:**
```json
{
  "fromType": "case | question",
  "fromId": "string",
  "toType": "case | question",
  "toId": "string",
  "label": "string (1-200)"
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "fromType", "fromId", "toType", "toId", "label" } }
```

---

### PUT /api/canvas/:id/relations/:relId
**Auth:** Required
**Description:** Update a relation's label.
**Body:**
```json
{ "label": "string (1-200)" }
```
**Response (200):**
```json
{ "success": true, "data": { "id", "label" } }
```

---

### DELETE /api/canvas/:id/relations/:relId
**Auth:** Required
**Description:** Delete a relation.
**Response (200):**
```json
{ "success": true }
```

---

## 10. Intercoder Reliability

### POST /api/canvas/:id/intercoder
**Auth:** Required
**Plan:** Team only (intercoder requires Team plan)
**Description:** Compute Cohen's Kappa for intercoder reliability on a transcript.
**Body:**
```json
{
  "userId": "string (required)",
  "transcriptId": "string (required)"
}
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "kappa": 0.75,
    "agreement": 0.85,
    "segments": 12,
    "coderACodingCount": 6,
    "coderBCodingCount": 6
  }
}
```
**Errors:** 400 (missing fields), 404 (transcript not found)

---

## 11. Computed / Analysis Nodes

### POST /api/canvas/:id/computed
**Auth:** Required
**Plan:** Enforced (checkAnalysisType — Free: stats/wordcloud only)
**Description:** Create an analysis node.
**Body:**
```json
{
  "nodeType": "search | cooccurrence | matrix | stats | comparison | wordcloud | cluster | codingquery | sentiment | treemap | timeline | geomap",
  "label": "string (1-200)",
  "config": { ... } // optional, type-specific configuration
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "nodeType", "label", "config": {}, "result": {} } }
```
**Errors:** 403 (analysis type not available on plan)

---

### PUT /api/canvas/:id/computed/:nodeId
**Auth:** Required
**Description:** Update a computed node's label or config.
**Body:**
```json
{
  "label": "string (1-200, optional)",
  "config": { ... } // optional
}
```
**Response (200):**
```json
{ "success": true, "data": { "id", "label", "config", "result" } }
```

---

### DELETE /api/canvas/:id/computed/:nodeId
**Auth:** Required
**Description:** Delete a computed node.
**Response (200):**
```json
{ "success": true }
```

---

### POST /api/canvas/:id/computed/:nodeId/run
**Auth:** Required
**Plan:** Enforced (checkAnalysisTypeOnRun)
**Rate Limited:** Yes (30 req / 15 min)
**Description:** Execute the computation. Fetches all canvas data and runs the analysis algorithm.
**Body:** None
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "nodeType": "string",
    "label": "string",
    "config": { ... },
    "result": { ... } // analysis-type-specific result
  }
}
```
**Node types and their result shapes:**
| Type | Result |
|------|--------|
| `search` | `{ matches: [{ transcriptId, offset, matchText }] }` |
| `cooccurrence` | `{ pairs: [{ q1, q2, count }] }` |
| `matrix` | `{ rows, columns, cells }` |
| `stats` | `{ groups: [{ label, count, percentage }] }` |
| `comparison` | `{ transcripts: [{ id, title, codingsByQuestion }] }` |
| `wordcloud` | `{ words: [{ text, count }] }` |
| `cluster` | `{ clusters: [{ id, codings }] }` |
| `codingquery` | `{ results: [{ coding, transcript }] }` |
| `sentiment` | `{ scores: [{ label, score }] }` |
| `treemap` | `{ nodes: [{ name, value, children }] }` |
| `timeline` | `{ events: [{ date, transcriptId, codingCount }] }` |
| `geomap` | `{ points: [{ transcriptId, title, latitude, longitude, locationName, codingCount }], totalMapped, totalUnmapped }` |

**Errors:** 400 (unknown node type), 403 (plan restriction), 404 (node not found)

---

## 12. AI Features — Suggest & Auto-Code

### POST /api/canvas/:id/ai/suggest-codes
**Auth:** Required
**Plan:** Enforced (checkAiAccess — Pro/Team only)
**Description:** Get AI-suggested codes for a selected text passage. Requires AI config (API key).
**Body:**
```json
{
  "transcriptId": "string",
  "codedText": "string (1-5000)",
  "startOffset": 0,
  "endOffset": 50
}
```
**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "canvasId": "string",
      "transcriptId": "string",
      "questionId": "string | null",
      "suggestedText": "string",
      "startOffset": 0,
      "endOffset": 50,
      "codedText": "string",
      "confidence": 0.85,
      "status": "pending"
    }
  ]
}
```
**Errors:** 400 (AI not configured), 404 (transcript not found)

---

### POST /api/canvas/:id/ai/auto-code-transcript
**Auth:** Required
**Plan:** Enforced (checkAiAccess — Pro/Team only)
**Description:** AI auto-codes an entire transcript. Returns suggestions (not applied automatically).
**Body:**
```json
{
  "transcriptId": "string",
  "instructions": "string (max 1000, optional)"
}
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "total": 15,
    "valid": 14,
    "suggestions": [{ "id", "suggestedText", "startOffset", "endOffset", "codedText", "confidence", "status": "pending" }]
  }
}
```
**Errors:** 400 (AI not configured), 404 (transcript not found)

---

### GET /api/canvas/:id/ai/suggestions
**Auth:** Required
**Description:** List AI suggestions for a canvas.
**Query:** `?status=pending&transcriptId=xxx`
**Response (200):**
```json
{ "success": true, "data": [{ "id", "suggestedText", "confidence", "status", "createdAt" }] }
```

---

### PUT /api/canvas/:id/ai/suggestions/:sid
**Auth:** Required
**Description:** Accept or reject an AI suggestion. Accepting creates the coding (and code if needed).
**Body:**
```json
{ "status": "accepted | rejected" }
```
**Response (200):**
```json
{ "success": true, "data": { "id", "status" } }
```
**Errors:** 404 (suggestion not found)

---

### POST /api/canvas/:id/ai/suggestions/bulk-action
**Auth:** Required
**Description:** Accept or reject multiple AI suggestions at once.
**Body:**
```json
{
  "suggestionIds": ["string"] // 1-200
  "action": "accepted | rejected"
}
```
**Response (200):**
```json
{ "success": true, "data": { "updated": 10 } }
```

---

## 13. AI Features — Chat (RAG)

### POST /api/canvas/:id/ai/embed
**Auth:** Required
**Plan:** Enforced (checkAiAccess)
**Description:** Generate embeddings for all canvas content (transcripts, codings, memos). Required before using chat.
**Body:** None
**Response (200):**
```json
{ "success": true, "data": { "embedded": 250 } }
```
**Errors:** 400 (AI not configured)

---

### POST /api/canvas/:id/ai/chat
**Auth:** Required
**Plan:** Enforced (checkAiAccess)
**Description:** Ask a question about the canvas using RAG (Retrieval-Augmented Generation).
**Body:**
```json
{ "message": "string (1-2000)" }
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "role": "assistant",
    "content": "string",
    "citations": [{ "sourceType", "sourceId", "chunkText" }],
    "createdAt": "ISO string"
  }
}
```
**Errors:** 400 (AI not configured)

---

### GET /api/canvas/:id/ai/chat/history
**Auth:** Required
**Description:** Get chat message history for a canvas.
**Query:** `?limit=50` (max 200)
**Response (200):**
```json
{
  "success": true,
  "data": [
    { "id", "canvasId", "userId", "role": "user | assistant", "content", "citations": [], "createdAt" }
  ]
}
```

---

## 14. AI Features — Summarize

### POST /api/canvas/:id/ai/summarize
**Auth:** Required
**Plan:** Enforced (checkAiAccess)
**Description:** Generate a summary of a transcript, coding, question's codings, or entire canvas.
**Body:**
```json
{
  "sourceType": "transcript | coding | question | canvas",
  "sourceId": "string (required for transcript/coding/question, omit for canvas)",
  "summaryType": "paraphrase | abstract | thematic (default: paraphrase)"
}
```
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "canvasId": "string",
    "sourceType": "string",
    "sourceId": "string | null",
    "summaryText": "string",
    "summaryType": "string",
    "createdAt": "ISO string",
    "updatedAt": "ISO string"
  }
}
```
**Errors:** 400 (AI not configured, invalid source, no content), 404 (source not found)

---

### GET /api/canvas/:id/summaries
**Auth:** Required
**Description:** List summaries for a canvas.
**Query:** `?sourceType=transcript&sourceId=xxx`
**Response (200):**
```json
{ "success": true, "data": [{ "id", "sourceType", "sourceId", "summaryText", "summaryType", "createdAt" }] }
```

---

### PUT /api/canvas/:id/summaries/:sid
**Auth:** Required
**Description:** Edit a summary's text.
**Body:**
```json
{ "summaryText": "string (1-10000)" }
```
**Response (200):**
```json
{ "success": true, "data": { "id", "summaryText", "updatedAt" } }
```
**Errors:** 404 (summary not found)

---

## 15. AI Settings

### GET /api/ai-settings
**Auth:** Required
**Description:** Get the user's AI configuration. Never returns the actual API key.
**Response (200):**
```json
{
  "success": true,
  "data": {
    "provider": "openai | anthropic | google",
    "model": "string | null",
    "embeddingModel": "string | null",
    "hasApiKey": true
  }
}
```

---

### PUT /api/ai-settings
**Auth:** Required (email auth)
**Description:** Create or update AI configuration. Validates the API key with a test call.
**Body:**
```json
{
  "provider": "openai | anthropic | google",
  "apiKey": "string (required)",
  "model": "string (max 100, optional)",
  "embeddingModel": "string (max 100, optional)"
}
```
**Response (200):**
```json
{ "success": true, "data": { "provider", "model", "embeddingModel", "hasApiKey": true } }
```
**Errors:** 400 (key validation failed), 401 (not authenticated)

---

### DELETE /api/ai-settings
**Auth:** Required (email auth)
**Description:** Remove the user's AI configuration.
**Response (200):**
```json
{ "success": true, "data": { "hasApiKey": false } }
```
**Errors:** 401 (not authenticated)

---

## 16. Sharing & Cloning

### POST /api/canvas/:id/share
**Auth:** Required
**Plan:** Enforced (checkShareLimit — Pro: 5, Team: unlimited)
**Description:** Generate a share code for the canvas.
**Body:** None
**Response (201):**
```json
{ "success": true, "data": { "id", "canvasId", "shareCode": "SHARE-XXXXXXXX", "createdAt" } }
```
**Errors:** 403 (plan limit)

---

### GET /api/canvas/:id/shares
**Auth:** Required
**Description:** List all share codes for a canvas.
**Response (200):**
```json
{ "success": true, "data": [{ "id", "shareCode", "cloneCount", "createdAt", "expiresAt" }] }
```

---

### DELETE /api/canvas/:id/share/:shareId
**Auth:** Required
**Description:** Revoke a share code.
**Response (200):**
```json
{ "success": true }
```
**Errors:** 404 (share not found)

---

### GET /api/canvas/shared/:code
**Auth:** None (public)
**Description:** View a shared canvas (read-only). Includes all data.
**Response (200):**
```json
{
  "success": true,
  "data": { "id", "name", "transcripts", "questions", "memos", "codings", "cases", "relations", "computedNodes" }
}
```
**Errors:** 404 (code not found), 410 (expired)

---

### POST /api/canvas/clone/:code
**Auth:** Required
**Plan:** Enforced (checkCanvasLimit + content limits)
**Description:** Clone a shared canvas into your account. Deep copies all data.
**Body:** None
**Response (201):**
```json
{ "success": true, "data": { "id", "name": "Original Name (Clone)" } }
```
**Errors:** 403 (plan limits exceeded), 404 (code/canvas not found), 409 (name conflict), 410 (expired)

---

## 17. Collaboration

### POST /api/canvas/:id/collaborators
**Auth:** Required
**Plan:** Enforced (maxCollaborators per plan)
**Description:** Invite a collaborator to a canvas by user ID.
**Body:**
```json
{
  "userId": "string (required)",
  "role": "editor | viewer (default: editor)"
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "canvasId", "userId", "role", "createdAt" } }
```
**Errors:** 400 (self-invite), 403 (plan limit), 404 (user not found)

---

### GET /api/canvas/:id/collaborators
**Auth:** Required
**Description:** List collaborators on a canvas (enriched with user name/email).
**Response (200):**
```json
{
  "success": true,
  "data": [{ "id", "canvasId", "userId", "role", "userName", "userEmail", "createdAt" }]
}
```

---

### DELETE /api/canvas/:id/collaborators/:userId
**Auth:** Required
**Description:** Remove a collaborator from a canvas.
**Response (200):**
```json
{ "success": true, "message": "Collaborator removed" }
```
**Errors:** 404 (collaborator not found)

---

## 18. Ethics & Compliance

### GET /api/canvas/:canvasId/ethics
**Auth:** Required
**Plan:** Enforced (checkEthicsAccess — Pro/Team only)
**Description:** Get ethics settings and consent records for a canvas.
**Response (200):**
```json
{
  "success": true,
  "data": {
    "ethicsApprovalId": "string | null",
    "ethicsStatus": "pending | approved | expired | not_required",
    "dataRetentionDate": "ISO date | null",
    "consentRecords": [...]
  }
}
```

---

### PUT /api/canvas/:canvasId/ethics
**Auth:** Required
**Plan:** Enforced (checkEthicsAccess)
**Audited:** Yes
**Description:** Update ethics settings.
**Body:**
```json
{
  "ethicsApprovalId": "string (max 200) | null (optional)",
  "ethicsStatus": "pending | approved | expired | not_required (optional)",
  "dataRetentionDate": "ISO datetime | null (optional)"
}
```
**Response (200):**
```json
{
  "success": true,
  "data": { "ethicsApprovalId", "ethicsStatus", "dataRetentionDate" }
}
```

---

### POST /api/canvas/:canvasId/consent
**Auth:** Required
**Plan:** Enforced (checkEthicsAccess)
**Audited:** Yes
**Description:** Record participant consent.
**Body:**
```json
{
  "participantId": "string (1-200, required)",
  "consentType": "informed | verbal | written | implied (default: informed)",
  "ethicsProtocol": "string (max 500, optional)",
  "notes": "string (max 2000, optional)"
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "participantId", "consentType", "consentStatus": "active" } }
```
**Errors:** 409 (duplicate participant in canvas)

---

### GET /api/canvas/:canvasId/consent
**Auth:** Required
**Plan:** Enforced (checkEthicsAccess)
**Description:** List consent records for a canvas.
**Response (200):**
```json
{ "success": true, "data": [{ "id", "participantId", "consentType", "consentStatus", "createdAt" }] }
```

---

### PUT /api/canvas/:canvasId/consent/:consentId/withdraw
**Auth:** Required
**Plan:** Enforced (checkEthicsAccess)
**Audited:** Yes
**Description:** Withdraw a participant's consent.
**Body:**
```json
{ "notes": "string (max 2000, optional)" }
```
**Response (200):**
```json
{ "success": true, "data": { "id", "consentStatus": "withdrawn", "withdrawalDate" } }
```
**Errors:** 400 (already withdrawn), 404 (consent not found)

---

### POST /api/canvas/:canvasId/transcripts/:transcriptId/anonymize
**Auth:** Required
**Plan:** Enforced (checkEthicsAccess)
**Audited:** Yes
**Description:** Anonymize a transcript by applying find/replace on content and all associated codings.
**Body:**
```json
{
  "replacements": [
    { "find": "John Smith", "replace": "[Participant A]" }
  ] // 1-500 replacements
}
```
**Response (200):**
```json
{ "success": true, "data": { "id", "content": "anonymized...", "isAnonymized": true } }
```
**Errors:** 404 (transcript not in canvas)

---

### GET /api/audit-log
**Auth:** Required
**Description:** Export audit trail (own data only). Paginated with filters.
**Query:** `?from=ISO&to=ISO&action=coding.create&resource=coding&limit=100&offset=0` (max limit: 1000)
**Response (200):**
```json
{
  "success": true,
  "data": {
    "entries": [{ "id", "action", "resource", "resourceId", "timestamp", "method", "path", "meta" }],
    "total": 150,
    "limit": 100,
    "offset": 0
  }
}
```

---

## 19. Billing (Stripe)

### POST /api/billing/create-checkout
**Auth:** Required (email auth)
**Description:** Create a Stripe Checkout session. Auto-applies 40% academic discount for .edu emails.
**Body:**
```json
{
  "priceId": "string (Stripe price ID, required)",
  "plan": "pro | team (optional, default: pro)"
}
```
**Response (200):**
```json
{ "success": true, "data": { "url": "https://checkout.stripe.com/..." } }
```
**Errors:** 400 (missing priceId), 403 (legacy auth), 404 (user not found)

---

### POST /api/billing/create-portal
**Auth:** Required (email auth)
**Description:** Create a Stripe Customer Portal session for managing subscription.
**Body:** None
**Response (200):**
```json
{ "success": true, "data": { "url": "https://billing.stripe.com/..." } }
```
**Errors:** 403 (legacy auth), 404 (no billing account)

---

### GET /api/billing/subscription
**Auth:** Required (email auth)
**Description:** Get current subscription details.
**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "active | trialing | past_due | canceled",
    "currentPeriodStart": "ISO date",
    "currentPeriodEnd": "ISO date",
    "cancelAtPeriodEnd": false
  } | null
}
```
**Errors:** 403 (legacy auth)

---

### POST /api/billing/webhook
**Auth:** None (verified by Stripe signature)
**Content-Type:** `application/json` (raw body)
**Description:** Stripe webhook handler. Processes subscription lifecycle events.
**Handled events:**
- `checkout.session.completed` — Activates subscription, upgrades plan
- `customer.subscription.updated` — Syncs status/period, downgrades if inactive
- `customer.subscription.deleted` — Cancels subscription, downgrades to free
- `invoice.payment_failed` — Marks subscription past_due, downgrades to free

**Response (200):**
```json
{ "received": true }
```
**Errors:** 400 (invalid signature), 500 (not configured / processing error)

---

## 20. Teams

### POST /api/teams
**Auth:** Required (email auth)
**Plan:** Team only
**Description:** Create a team. Creator becomes owner.
**Body:**
```json
{ "name": "string (1-200, required)" }
```
**Response (201):**
```json
{ "success": true, "data": { "id", "name", "ownerId", "members": [...] } }
```
**Errors:** 401 (legacy auth), 403 (not Team plan)

---

### GET /api/teams
**Auth:** Required (email auth)
**Description:** List teams the user belongs to.
**Response (200):**
```json
{
  "success": true,
  "data": [{ "id", "name", "owner": { "id", "name", "email" }, "myRole", "memberCount" }]
}
```

---

### GET /api/teams/:teamId
**Auth:** Required (email auth, must be member)
**Description:** Get team details including all members.
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id", "name", "ownerId",
    "owner": { "id", "name", "email" },
    "members": [{ "userId", "role", "joinedAt", "user": { "id", "name", "email" } }]
  }
}
```
**Errors:** 403 (not a member), 404 (not found)

---

### POST /api/teams/:teamId/members
**Auth:** Required (email auth)
**Plan:** Team only
**Description:** Invite a member by email. Sends invitation email. Only owners and admins can invite.
**Body:**
```json
{
  "email": "string (required)",
  "role": "admin | member (default: member)"
}
```
**Response (201):**
```json
{ "success": true, "data": { "teamId", "userId", "role", "user": { "id", "name", "email" } } }
```
**Errors:** 400 (self-invite), 403 (not owner/admin / not Team plan), 404 (team/user not found), 409 (already member)

---

### DELETE /api/teams/:teamId/members/:userId
**Auth:** Required (email auth)
**Description:** Remove a team member. Owners/admins can remove others; members can remove themselves. Cannot remove the team owner.
**Response (200):**
```json
{ "success": true, "message": "Member removed" }
```
**Errors:** 400 (cannot remove owner), 403 (not authorized), 404 (team/member not found)

---

### DELETE /api/teams/:teamId
**Auth:** Required (email auth, owner only)
**Description:** Delete a team and all memberships.
**Response (200):**
```json
{ "success": true, "message": "Team deleted" }
```
**Errors:** 403 (not owner), 404 (not found)

---

## 21. File Upload & Transcription

### POST /api/canvas/:id/upload/presigned
**Auth:** Required
**Plan:** Enforced (checkFileUploadAccess)
**Description:** Get a pre-signed URL for direct client upload to S3.
**Body:**
```json
{
  "fileName": "string (required)",
  "contentType": "string (required)"
}
```
**Response (200):**
```json
{ "success": true, "data": { "uploadUrl": "string", "storageKey": "string" } }
```
**Errors:** 400 (missing fields)

---

### POST /api/canvas/:id/upload/confirm
**Auth:** Required
**Description:** Confirm upload completion and create FileUpload record.
**Body:**
```json
{
  "storageKey": "string (required)",
  "originalName": "string (required)",
  "mimeType": "string (required)",
  "sizeBytes": 12345
}
```
**Response (200):**
```json
{ "success": true, "data": { "id", "storageKey", "originalName", "mimeType", "status": "uploaded" } }
```

---

### POST /api/canvas/:id/upload/direct
**Auth:** Required
**Plan:** Enforced (checkFileUploadAccess)
**Description:** Direct file upload (multipart form). For local storage / dev mode.
**Content-Type:** `multipart/form-data`
**Field:** `file` (max 500 MB)
**Allowed types:** audio/mpeg, audio/wav, audio/mp4, audio/x-m4a, audio/ogg, audio/webm, audio/flac, video/mp4, video/webm
**Response (200):**
```json
{ "success": true, "data": { "id", "storageKey", "originalName", "mimeType", "sizeBytes", "status": "uploaded" } }
```
**Errors:** 400 (no file / unsupported type)

---

### POST /api/canvas/:id/transcribe
**Auth:** Required
**Description:** Start a transcription job for an uploaded audio/video file (uses Whisper).
**Body:**
```json
{
  "fileUploadId": "string (required)",
  "language": "string (optional, e.g. 'en')"
}
```
**Response (200):**
```json
{ "success": true, "data": { "jobId": "string" } }
```
**Errors:** 400 (missing fileUploadId), 404 (file not found)

---

### GET /api/canvas/:id/transcribe/:jobId
**Auth:** Required
**Description:** Poll transcription job status.
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "status": "queued | processing | completed | failed",
    "progress": 75,
    "resultText": "string | null",
    "errorMessage": "string | null"
  }
}
```
**Errors:** 404 (job not found)

---

### POST /api/canvas/:id/transcribe/:jobId/accept
**Auth:** Required
**Description:** Accept a completed transcription and create a transcript node.
**Body:**
```json
{ "title": "string (optional, defaults to original file name)" }
```
**Response (200):**
```json
{ "success": true, "data": { "id", "title", "content", "sourceType": "transcription" } }
```
**Errors:** 400 (no result text), 404 (completed job not found)

---

## 22. Documents & Region Coding

### POST /api/canvas/:id/documents
**Auth:** Required
**Description:** Create a document node linked to an uploaded file (image or PDF).
**Body:**
```json
{
  "fileUploadId": "string (required)",
  "title": "string (required)",
  "docType": "image | pdf",
  "pageCount": 1,
  "metadata": { ... }
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "title", "docType", "pageCount", "metadata" } }
```
**Errors:** 400 (missing fields / invalid docType), 404 (file not found)

---

### GET /api/canvas/:id/documents
**Auth:** Required
**Description:** List documents in a canvas.
**Response (200):**
```json
{ "success": true, "data": [{ "id", "title", "docType", "pageCount", "metadata" }] }
```

---

### DELETE /api/canvas/:id/documents/:docId
**Auth:** Required
**Description:** Delete a document.
**Response (200):**
```json
{ "success": true }
```
**Errors:** 404 (document not found)

---

### POST /api/canvas/:id/documents/:docId/regions
**Auth:** Required
**Description:** Create a region coding on a document (visual annotation).
**Body:**
```json
{
  "questionId": "string (required)",
  "pageNumber": 1,
  "x": 100.0,
  "y": 200.0,
  "width": 150.0,
  "height": 80.0,
  "note": "string (optional)"
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "documentId", "questionId", "pageNumber", "x", "y", "width", "height", "note" } }
```
**Errors:** 400 (missing fields / question not in canvas), 404 (document not found)

---

### GET /api/canvas/:id/documents/:docId/regions
**Auth:** Required
**Description:** List region codings for a document.
**Response (200):**
```json
{ "success": true, "data": [{ "id", "documentId", "questionId", "pageNumber", "x", "y", "width", "height", "note" }] }
```
**Errors:** 404 (document not found)

---

### DELETE /api/canvas/:id/documents/:docId/regions/:regionId
**Auth:** Required
**Description:** Delete a region coding.
**Response (200):**
```json
{ "success": true }
```
**Errors:** 404 (region not found)

---

## 23. Training Center

### POST /api/canvas/:id/training
**Auth:** Required
**Description:** Create a training document with gold-standard codings for coder training.
**Body:**
```json
{
  "transcriptId": "string (required)",
  "name": "string (required)",
  "instructions": "string (optional)",
  "goldCodings": [{ "questionId", "startOffset", "endOffset", "codedText" }],
  "passThreshold": 0.7
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "name", "instructions", "goldCodings", "passThreshold" } }
```
**Errors:** 400 (missing fields / invalid goldCodings / transcript not in canvas)

---

### GET /api/canvas/:id/training
**Auth:** Required
**Description:** List training documents with attempt counts.
**Response (200):**
```json
{ "success": true, "data": [{ "id", "name", "passThreshold", "goldCodings", "_count": { "attempts": 3 } }] }
```

---

### GET /api/canvas/:id/training/:docId
**Auth:** Required
**Description:** Get training document detail with all attempts.
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id", "name", "instructions", "goldCodings", "passThreshold",
    "attempts": [{ "id", "userId", "codings", "kappaScore", "passed", "createdAt" }]
  }
}
```
**Errors:** 404 (not found)

---

### DELETE /api/canvas/:id/training/:docId
**Auth:** Required
**Description:** Delete a training document and all attempts.
**Response (200):**
```json
{ "success": true }
```
**Errors:** 404 (not found)

---

### POST /api/canvas/:id/training/:docId/attempt
**Auth:** Required
**Description:** Submit a training attempt. Computes Cohen's Kappa against gold-standard codings.
**Body:**
```json
{
  "codings": [{ "questionId", "startOffset", "endOffset", "codedText" }]
}
```
**Response (201):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "userId": "string",
    "codings": [...],
    "kappaScore": 0.82,
    "passed": true,
    "createdAt": "ISO date"
  }
}
```
**Errors:** 400 (invalid codings), 404 (training doc / transcript not found)

---

### GET /api/canvas/:id/training/:docId/attempts
**Auth:** Required
**Description:** List all attempts for a training document.
**Response (200):**
```json
{ "success": true, "data": [{ "id", "userId", "kappaScore", "passed", "codings", "createdAt" }] }
```
**Errors:** 404 (training doc not found)

---

## 24. QDPX Import / Export

### GET /api/canvas/:id/export/qdpx
**Auth:** Required
**Plan:** Enforced (checkExportFormat — Pro/Team only; Free: CSV only)
**Description:** Export canvas as a QDPX file (REFI-QDA standard).
**Response:** Binary `.qdpx` file (Content-Type: `application/zip`)
**Errors:** 403 (plan restriction)

---

### POST /api/canvas/:id/import/qdpx
**Auth:** Required
**Content-Type:** `multipart/form-data`
**Description:** Import a QDPX file into an existing canvas. Max 20 MB, `.qdpx` or `.zip` only.
**Field:** `file`
**Response (200):**
```json
{
  "success": true,
  "message": "Imported 5 codes, 3 sources, 12 codings",
  "codes": 5,
  "sources": 3,
  "codings": 12
}
```
**Errors:** 400 (no file / wrong format)

---

## 25. Repository & Insights

### GET /api/repositories
**Auth:** Required (email auth)
**Plan:** Enforced (checkRepositoryAccess)
**Description:** List the user's research repositories.
**Response (200):**
```json
{ "success": true, "repositories": [{ "id", "name", "description", "_count": { "insights": 5 } }] }
```

---

### POST /api/repositories
**Auth:** Required (email auth)
**Plan:** Enforced (checkRepositoryAccess)
**Description:** Create a research repository.
**Body:**
```json
{
  "name": "string (required)",
  "description": "string (optional)"
}
```
**Response (201):**
```json
{ "success": true, "repository": { "id", "name", "description" } }
```
**Errors:** 400 (missing name)

---

### DELETE /api/repositories/:id
**Auth:** Required (email auth)
**Description:** Delete a repository.
**Response (200):**
```json
{ "success": true }
```
**Errors:** 403 (not owner), 404 (not found)

---

### GET /api/repositories/:id/insights
**Auth:** Required (email auth)
**Description:** List insights in a repository.
**Response (200):**
```json
{ "success": true, "insights": [{ "id", "title", "content", "tags", "canvasId", "sourceType", "sourceId", "createdAt" }] }
```
**Errors:** 403 (not owner), 404 (repository not found)

---

### POST /api/repositories/:id/insights
**Auth:** Required (email auth)
**Description:** Create an insight in a repository.
**Body:**
```json
{
  "title": "string (required)",
  "content": "string (required)",
  "tags": ["string"],
  "canvasId": "string (optional)",
  "sourceType": "string (optional)",
  "sourceId": "string (optional)"
}
```
**Response (201):**
```json
{ "success": true, "insight": { "id", "title", "content", "tags" } }
```
**Errors:** 400 (missing title/content), 403 (not owner), 404 (repository not found)

---

### DELETE /api/repositories/:repoId/insights/:insightId
**Auth:** Required (email auth)
**Description:** Delete an insight.
**Response (200):**
```json
{ "success": true }
```
**Errors:** 403 (not owner), 404 (repository/insight not found)

---

## 26. Integrations

### GET /api/integrations
**Auth:** Required (email auth)
**Plan:** Enforced (checkIntegrationsAccess)
**Description:** List connected integrations. Never returns access tokens.
**Response (200):**
```json
{
  "success": true,
  "integrations": [{ "id", "provider": "zoom | slack | qualtrics", "metadata", "expiresAt", "createdAt" }]
}
```

---

### POST /api/integrations/connect
**Auth:** Required (email auth)
**Plan:** Enforced (checkIntegrationsAccess)
**Description:** Connect an integration (OAuth token exchange).
**Body:**
```json
{
  "provider": "zoom | slack | qualtrics",
  "accessToken": "string (required)",
  "refreshToken": "string (optional)",
  "metadata": { ... },
  "expiresAt": "ISO datetime (optional)"
}
```
**Response (200):**
```json
{ "success": true, "integration": { "id", "provider", "metadata", "expiresAt", "createdAt" } }
```
**Errors:** 400 (missing fields / invalid provider)

---

### DELETE /api/integrations/:id
**Auth:** Required (email auth)
**Description:** Disconnect an integration.
**Response (200):**
```json
{ "success": true }
```
**Errors:** 403 (not owner), 404 (not found)

---

## 27. System Endpoints

These endpoints are NOT under the `/api` prefix.

### GET /health
**Auth:** None
**Description:** Health check with database ping.
**Response (200):**
```json
{ "status": "ok", "timestamp": "ISO date" }
```
**Response (503):**
```json
{ "status": "error", "message": "Service unavailable" }
```

---

### GET /ready
**Auth:** None
**Description:** Readiness check with version and uptime.
**Response (200):**
```json
{ "status": "ready", "version": "1.0.0", "uptime": 12345.67 }
```

---

### GET /metrics
**Auth:** None
**Description:** Basic server metrics.
**Response (200):**
```json
{
  "uptime": 12345.67,
  "requestCount": 5000,
  "memoryUsage": 52428800,
  "timestamp": "ISO date"
}
```

---

## 28. Notifications

### GET /api/notifications
**Auth:** Required (email auth)
**Description:** List user's notifications, paginated. Returns unread count.
**Query:** `?page=1&limit=20&unreadOnly=true`
**Response (200):**
```json
{
  "success": true,
  "data": [{ "id", "type", "title", "message", "read", "metadata": {}, "createdAt" }],
  "pagination": { "page": 1, "limit": 20, "total": 50, "totalPages": 3 },
  "unreadCount": 5
}
```

---

### PUT /api/notifications/:id/read
**Auth:** Required (email auth)
**Description:** Mark a single notification as read.
**Response (200):**
```json
{ "success": true, "message": "Notification marked as read" }
```
**Errors:** 403 (not owner), 404 (not found)

---

### PUT /api/notifications/read-all
**Auth:** Required (email auth)
**Description:** Mark all unread notifications as read.
**Response (200):**
```json
{ "success": true, "message": "All notifications marked as read" }
```

---

### DELETE /api/notifications/:id
**Auth:** Required (email auth)
**Description:** Delete a notification.
**Response (200):**
```json
{ "success": true, "message": "Notification deleted" }
```
**Errors:** 403 (not owner), 404 (not found)

---

## 29. Reports

### POST /api/reports/schedule
**Auth:** Required (email auth)
**Description:** Create a scheduled report configuration.
**Body:**
```json
{
  "canvasId": "string (optional, scope to canvas)",
  "teamId": "string (optional, scope to team)",
  "frequency": "daily | weekly | monthly (default: weekly)",
  "dayOfWeek": 0-6 // optional, 0=Sun (for weekly reports)
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "userId", "canvasId", "frequency", "dayOfWeek", "enabled", "createdAt" } }
```

---

### GET /api/reports/schedules
**Auth:** Required (email auth)
**Description:** List user's report schedules.
**Response (200):**
```json
{ "success": true, "data": [{ "id", "canvasId", "teamId", "frequency", "dayOfWeek", "lastSent", "enabled" }] }
```

---

### PUT /api/reports/schedules/:id
**Auth:** Required (email auth)
**Description:** Update a schedule (enable/disable, change frequency).
**Body:**
```json
{
  "frequency": "daily | weekly | monthly (optional)",
  "dayOfWeek": 0-6 // optional
  "enabled": true | false // optional
}
```
**Response (200):**
```json
{ "success": true, "data": { "id", "frequency", "dayOfWeek", "enabled" } }
```
**Errors:** 403 (not owner), 404 (not found)

---

### DELETE /api/reports/schedules/:id
**Auth:** Required (email auth)
**Description:** Delete a report schedule.
**Response (200):**
```json
{ "success": true, "message": "Schedule deleted" }
```
**Errors:** 403 (not owner), 404 (not found)

---

### POST /api/reports/generate
**Auth:** Required (email auth)
**Description:** Generate a report on-demand (returns HTML).
**Body:**
```json
{ "canvasId": "string (optional)" }
```
**Response (200):**
```json
{ "success": true, "data": { "html": "<html>...</html>", "subject": "QualCanvas Weekly Report — 3/27/2026" } }
```

---

## 30. Calendar

### GET /api/calendar/events
**Auth:** Required (email auth)
**Description:** List calendar events with optional filters.
**Query:** `?from=ISO&to=ISO&type=milestone&canvasId=xxx`
**Response (200):**
```json
{ "success": true, "data": [{ "id", "title", "description", "startDate", "endDate", "allDay", "type", "color", "reminder", "canvasId", "teamId" }] }
```

---

### POST /api/calendar/events
**Auth:** Required (email auth)
**Description:** Create a calendar event.
**Body:**
```json
{
  "title": "string (1-500, required)",
  "description": "string (max 5000, optional)",
  "startDate": "ISO datetime (required)",
  "endDate": "ISO datetime (optional)",
  "allDay": false,
  "type": "milestone | deadline | session | review (default: milestone)",
  "color": "string (max 20, optional)",
  "reminder": 0-10080, // minutes before event (optional)
  "canvasId": "string (optional)",
  "teamId": "string (optional)"
}
```
**Response (201):**
```json
{ "success": true, "data": { "id", "title", "startDate", "type", "createdAt" } }
```

---

### PUT /api/calendar/events/:id
**Auth:** Required (email auth)
**Description:** Update a calendar event.
**Body:** Same fields as POST, all optional.
**Response (200):**
```json
{ "success": true, "data": { "id", "title", "startDate", "type", "updatedAt" } }
```
**Errors:** 403 (not owner), 404 (not found)

---

### DELETE /api/calendar/events/:id
**Auth:** Required (email auth)
**Description:** Delete a calendar event.
**Response (200):**
```json
{ "success": true, "message": "Event deleted" }
```
**Errors:** 403 (not owner), 404 (not found)

---

### GET /api/calendar/export.ics
**Auth:** Required (email auth)
**Description:** Export all calendar events as an iCal (.ics) file.
**Response:** `text/calendar` file download (`qualcanvas-calendar.ics`)

---

## 31. Excel Export

### GET /api/canvas/:id/export/excel
**Auth:** Required
**Description:** Download canvas data as a styled Excel workbook (.xlsx). Includes three sheets: Codebook (codes with colors and frequencies), Codings (all coded segments), and Case Matrix (case-by-code frequency table).
**Response:** Binary `.xlsx` file (Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`)

---

## 32. Admin Portal

**Auth:** All admin endpoints require the `x-admin-key` header containing the `ADMIN_API_KEY` environment variable value. This is separate from JWT authentication.

**Rate Limit:** 30 requests / 1 minute (per IP).

**Error Responses:**
- 403 — Missing or invalid admin key
- 503 — `ADMIN_API_KEY` not configured on the server

---

### GET /api/admin/dashboard
**Auth:** Admin key
**Description:** Aggregate platform metrics for the admin dashboard.
**Response (200):**
```json
{
  "success": true,
  "data": {
    "totalUsers": 150,
    "activeUsers": 42,
    "newSignups7d": 8,
    "newSignups30d": 23,
    "mrr": 456,
    "errorCount24h": 3,
    "activeSessions": 0,
    "planDistribution": { "free": 100, "pro": 40, "team": 10 },
    "testUsers": 3,
    "topFeatures": [
      { "name": "wordcloud", "source": "computed_node", "count": 120 },
      { "name": "auto_code", "source": "ai_usage", "count": 85 }
    ]
  }
}
```

> **Note:** `totalUsers`, `activeUsers`, `newSignups7d`, `newSignups30d`, and `mrr` all exclude test users (emails matching `*@test.com` or `test-*` patterns). The `testUsers` field reports the count of excluded test accounts.

---

### GET /api/admin/users
**Auth:** Admin key
**Description:** Paginated, searchable user list with last login and canvas count.
**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `search` | string | `""` | Filter by email or name (contains match) |
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Results per page (max 100) |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "email": "user@example.com",
      "name": "Jane Doe",
      "plan": "pro",
      "signupDate": "2025-06-01T00:00:00.000Z",
      "lastLogin": "2026-03-25T14:30:00.000Z",
      "status": "active",
      "canvasCount": 5,
      "isTest": false
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 150, "totalPages": 8, "realUsers": 147, "testUsers": 3 }
}
```

---

### GET /api/admin/users/:id
**Auth:** Admin key
**Description:** Full user detail including canvases, recent activity, AI usage stats, and subscription info. Sensitive fields (passwordHash, resetTokenHash) are excluded.
**Response (200):**
```json
{
  "success": true,
  "data": {
    "id": "string",
    "email": "user@example.com",
    "name": "Jane Doe",
    "plan": "pro",
    "subscription": { "...subscription fields" },
    "codingCanvases": [
      { "id": "string", "name": "Study 1", "createdAt": "...", "updatedAt": "...", "_count": { "transcripts": 3, "codings": 45, "computedNodes": 8 } }
    ],
    "recentActivity": [ { "id": "string", "action": "login", "timestamp": "...", "..." : "..." } ],
    "aiUsageStats": [
      { "feature": "auto_code", "count": 12, "totalInputTokens": 5000, "totalOutputTokens": 3000, "totalCostCents": 8 }
    ]
  }
}
```
**Errors:** 404 (user not found)

---

### GET /api/admin/billing
**Auth:** Admin key
**Description:** Billing metrics including MRR, ARR, churn rate, plan breakdown, and recent transactions. Test user subscriptions are excluded from MRR/ARR calculations and paying user counts.
**Response (200):**
```json
{
  "success": true,
  "data": {
    "mrr": 456,
    "arr": 5472,
    "totalPaying": 50,
    "totalFree": 100,
    "churnRate30d": 0.02,
    "planBreakdown": [
      { "plan": "pro", "count": 40, "revenue": 480 },
      { "plan": "team", "count": 10, "revenue": 290 }
    ],
    "recentTransactions": [
      {
        "id": "string",
        "userId": "string",
        "userEmail": "user@example.com",
        "plan": "pro",
        "status": "active",
        "stripeSubscriptionId": "sub_...",
        "currentPeriodStart": "...",
        "currentPeriodEnd": "...",
        "cancelAtPeriodEnd": false,
        "updatedAt": "..."
      }
    ]
  }
}
```

---

### GET /api/admin/health
**Auth:** Admin key
**Description:** System health including database connectivity, memory usage, uptime, and version.
**Response (200):**
```json
{
  "success": true,
  "data": {
    "status": "healthy",
    "uptime": 86400.5,
    "dbConnected": true,
    "dbResponseMs": 12,
    "memoryUsageMb": 128.45,
    "version": "1.0.0",
    "nodeVersion": "v20.11.0"
  }
}
```

`status` is one of: `healthy` (db < 1000ms), `degraded` (db >= 1000ms), `unhealthy` (db unreachable).

---

### GET /api/admin/activity
**Auth:** Admin key
**Description:** Paginated audit log with user email lookup.
**Query Parameters:**

| Param | Type | Default | Description |
|-------|------|---------|-------------|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Results per page (max 100) |
| `type` | string | `""` | Filter by action type (exact match) |

**Response (200):**
```json
{
  "success": true,
  "data": [
    {
      "id": "string",
      "action": "login",
      "actorId": "string",
      "resourceType": "user",
      "resourceId": "string",
      "timestamp": "2026-03-25T14:30:00.000Z",
      "userEmail": "user@example.com"
    }
  ],
  "pagination": { "page": 1, "limit": 20, "total": 500, "totalPages": 25 }
}
```

---

### GET /api/admin/features
**Auth:** Admin key
**Description:** Feature usage aggregation across computed nodes and AI features, with unique canvas/user counts.
**Response (200):**
```json
{
  "success": true,
  "data": [
    { "name": "wordcloud", "source": "computed_node", "totalUsage": 120, "uniqueCanvases": 35, "uniqueUsers": 0 },
    { "name": "auto_code", "source": "ai_usage", "totalUsage": 85, "uniqueCanvases": 0, "uniqueUsers": 28 }
  ]
}
```

Results are sorted by `totalUsage` descending.

---

## Plan Limits Reference

Plan limit enforcement returns HTTP 403 with:
```json
{
  "success": false,
  "error": "Free plan allows max 1 canvas",
  "code": "PLAN_LIMIT_EXCEEDED",
  "limit": "canvases",
  "current": 1,
  "max": 1,
  "upgrade": true
}
```

| Limit | Free | Pro ($12/mo) | Team ($29/mo/seat) |
|-------|------|-------------|-------------------|
| Canvases | 1 | Unlimited | Unlimited |
| Transcripts/canvas | 2 | Unlimited | Unlimited |
| Words/transcript | 5,000 | 50,000 | 50,000 |
| Codes | 5 | Unlimited | Unlimited |
| Analysis types | Stats, Word Cloud | All 13 types | All 13 types |
| Auto-code | No | Yes | Yes |
| AI features | No | Yes | Yes |
| Share codes | 0 | 5 | Unlimited |
| Ethics panel | No | Yes | Yes |
| Cases | No | Yes | Yes |
| QDPX export | No (CSV only) | Yes | Yes |
| Intercoder (Kappa) | No | No | Yes |
| Teams | No | No | Yes |
| Academic discount | - | 40% (.edu) | 40% (.edu) |
