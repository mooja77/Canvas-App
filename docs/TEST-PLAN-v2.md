# QualCanvas — Master Test Plan v2

**Version:** 2.0
**Date:** 2026-03-23
**Classification:** Pre-Release QA
**App:** QualCanvas — Qualitative Coding Platform for Researchers
**Stack:** React 18 + Vite / Express + Prisma + PostgreSQL / Stripe / LLM APIs (OpenAI, Anthropic, Google) / Socket.IO / i18n (4 languages) / Docker
**Prepared by:** QA Engineering

---

## Table of Contents

1. [Test Strategy](#1-test-strategy)
2. [Functional Test Cases](#2-functional-test-cases)
3. [Integration Test Cases (User Journeys)](#3-integration-test-cases-user-journeys)
4. [Security Test Cases](#4-security-test-cases)
5. [Performance Test Cases](#5-performance-test-cases)
6. [Accessibility Test Cases](#6-accessibility-test-cases)
7. [Compatibility Matrix](#7-compatibility-matrix)
8. [Edge Case Catalog](#8-edge-case-catalog)
9. [Regression Suite](#9-regression-suite)
10. [Test Data Requirements](#10-test-data-requirements)
11. [Release Criteria](#11-release-criteria)
12. [Risk Register](#12-risk-register)

---

## 1. Test Strategy

### 1.1 Test Pyramid

```
          /  E2E (Playwright)  \           ~44 tests   — Critical user journeys
         / Integration (Supertest) \       ~30 tests   — API route chains, DB lifecycle
        /    Unit (Vitest + RTL)     \     ~291 tests  — Functions, stores, components
       ──────────────────────────────────
```

**Total automated:** 335 tests (112 backend unit, 9 frontend unit suites, 30 integration, 44 E2E).
**Target:** 500+ automated tests by GA release.

### 1.2 Tools and Frameworks

| Layer | Tool | Configuration |
|-------|------|---------------|
| Backend Unit | Vitest + Supertest | `apps/backend/vitest.config.ts` |
| Frontend Unit | Vitest + React Testing Library + jsdom | `apps/frontend/vitest.config.ts` |
| E2E | Playwright Test (Chromium) | `playwright.config.ts` |
| API Integration | Vitest + Supertest (in-process Express) | `apps/backend/src/__tests__/` |
| Load Testing | k6 | To be configured |
| Security Scanning | npm audit + OWASP ZAP | To be configured |
| Accessibility | axe-core + Playwright | To be configured |

### 1.3 Environments

| Environment | Database | Auth | Stripe | Purpose |
|-------------|----------|------|--------|---------|
| Local dev | SQLite | JWT (mock seed) | Test keys | Developer iteration |
| CI (GitHub Actions) | SQLite (in-memory) | JWT (test fixtures) | Mocked | Automated gate on every PR |
| Staging | PostgreSQL | JWT (real) | Test mode | Pre-release validation |
| Production | PostgreSQL | JWT (real) | Live mode | Smoke tests only |

### 1.4 Test Data Strategy

- **Seed script:** `npm run db:seed` creates demo account (access code `CANVAS-DEMO2025`), sample canvas, transcripts, codes, and computed nodes.
- **Fixtures:** Static JSON fixtures for each entity type in `apps/backend/src/__tests__/fixtures/`.
- **Factories:** Builder functions that create valid entities with overridable defaults.
- **Personas:** Free, Pro, Team, Legacy (access-code-only), Admin users with pre-configured plan limits.
- **Cleanup:** Each test suite uses transaction rollback or `deleteMany` teardown to ensure isolation.

### 1.5 Naming Convention

Test IDs follow the pattern `{AREA}-{NNN}` (e.g., `AUTH-001`, `CANVAS-015`, `SEC-003`). Priorities:

- **P0:** Blocks release. Core auth, data integrity, payment processing.
- **P1:** High impact. Key features, plan enforcement, export.
- **P2:** Medium impact. UX polish, analysis accuracy, edge cases.
- **P3:** Low impact. Cosmetic, nice-to-have, future features.

---

## 2. Functional Test Cases

### 2.1 Authentication (25 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| AUTH-001 | Email signup with valid data | POST `/api/auth/register` with name, email, password | 201, JWT returned, user created with `free` plan | P0 | Yes |
| AUTH-002 | Email signup with duplicate email | POST `/api/auth/register` with existing email | 409 Conflict, descriptive error message | P0 | Yes |
| AUTH-003 | Email signup with weak password | POST `/api/auth/register` with password < 8 chars | 400, validation error specifying password requirements | P1 | Yes |
| AUTH-004 | Email signup with invalid email format | POST `/api/auth/register` with `notanemail` | 400, validation error for email field | P1 | Yes |
| AUTH-005 | Email login with correct credentials | POST `/api/auth/login` with valid email + password | 200, JWT with userId, role, plan claims | P0 | Yes |
| AUTH-006 | Email login with wrong password | POST `/api/auth/login` with wrong password | 401 Unauthorized, generic error (no info leak) | P0 | Yes |
| AUTH-007 | Email login with non-existent email | POST `/api/auth/login` with unknown email | 401 Unauthorized, same message as wrong password | P0 | Yes |
| AUTH-008 | Google OAuth callback success | GET `/api/auth/google/callback` with valid OAuth code | 302 redirect to frontend with JWT in query/cookie | P1 | No |
| AUTH-009 | Google OAuth callback with invalid code | GET `/api/auth/google/callback` with expired/invalid code | Redirect to login page with error param | P1 | No |
| AUTH-010 | Legacy access code login | POST `/api/auth` with valid access code | 200, JWT with accountId and role, grandfathered to Pro | P0 | Yes |
| AUTH-011 | Legacy access code login with invalid code | POST `/api/auth` with bad access code | 401 Unauthorized | P0 | Yes |
| AUTH-012 | Legacy access code login with expired code | POST `/api/auth` with expired access code | 401, error mentions expiration | P1 | Yes |
| AUTH-013 | Password reset request | POST `/api/auth/forgot-password` with registered email | 200, reset token created, email/log generated | P0 | Partial |
| AUTH-014 | Password reset with valid token | POST `/api/auth/reset-password` with valid token + new password | 200, password updated, old token invalidated | P0 | Partial |
| AUTH-015 | Password reset with expired token | POST `/api/auth/reset-password` with expired token | 400, token expired error | P1 | Yes |
| AUTH-016 | Password reset with used token | POST `/api/auth/reset-password` after token already used | 400, invalid token error | P1 | Yes |
| AUTH-017 | Email verification flow | Click verification link from registration email | Email marked as verified, redirect to app | P1 | No |
| AUTH-018 | Link legacy account to email | POST `/api/auth/link-account` with valid access code JWT + email/password | 200, user record linked to dashboard access | P1 | Yes |
| AUTH-019 | Account deletion | DELETE `/api/auth/account` with valid JWT | 200, user and all owned data cascade-deleted | P1 | Partial |
| AUTH-020 | Session expiry handling | Make API request with expired JWT | 401, frontend shows session-expired banner | P0 | Yes |
| AUTH-021 | Rate limiting on login | Send 10 rapid login attempts | 429 Too Many Requests after threshold | P1 | Yes |
| AUTH-022 | Rate limiting on registration | Send 5 rapid registration attempts | 429 Too Many Requests after threshold | P1 | Yes |
| AUTH-023 | Rate limiting on password reset | Send 5 rapid forgot-password requests | 429 Too Many Requests after threshold | P2 | Yes |
| AUTH-024 | JWT token refresh | Call protected endpoint near token expiry | New token issued transparently or refresh prompt shown | P2 | No |
| AUTH-025 | CSRF protection on state-changing endpoints | POST to auth endpoints without CSRF token (when enabled) | 403 Forbidden | P1 | Yes |

### 2.2 Canvas Management (20 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| CANVAS-001 | Create canvas with valid name | POST `/api/canvas` with name and optional description | 201, canvas object returned with generated ID | P0 | Yes |
| CANVAS-002 | Create canvas with duplicate name | POST `/api/canvas` with name matching existing canvas for same account | 409 Conflict, unique constraint error | P0 | Yes |
| CANVAS-003 | Create canvas exceeding plan limit | Free user with 1 canvas attempts to create second | 403, PLAN_LIMIT_EXCEEDED with upgrade suggestion | P0 | Yes |
| CANVAS-004 | List all canvases for account | GET `/api/canvas` | 200, array of owned canvases (excludes soft-deleted) | P0 | Yes |
| CANVAS-005 | Get canvas detail by ID | GET `/api/canvas/:id` | 200, full canvas with transcripts, questions, memos, codings, positions, computed nodes | P0 | Yes |
| CANVAS-006 | Get canvas owned by different account | GET `/api/canvas/:id` with mismatched auth | 404 Not Found (no info leak about existence) | P0 | Yes |
| CANVAS-007 | Update canvas name | PUT `/api/canvas/:id` with new name | 200, canvas updated | P1 | Yes |
| CANVAS-008 | Update canvas description | PUT `/api/canvas/:id` with new description | 200, description field updated | P2 | Yes |
| CANVAS-009 | Soft delete canvas | DELETE `/api/canvas/:id` | 200, canvas.deletedAt set to now, excluded from list | P0 | Yes |
| CANVAS-010 | List trashed canvases | GET `/api/canvas?deleted=true` | 200, only soft-deleted canvases returned | P1 | Yes |
| CANVAS-011 | Restore soft-deleted canvas | POST `/api/canvas/:id/restore` | 200, deletedAt set to null, canvas appears in main list | P1 | Yes |
| CANVAS-012 | Permanent delete canvas | DELETE `/api/canvas/:id/permanent` on soft-deleted canvas | 200, canvas and all related data cascade-deleted from DB | P1 | Yes |
| CANVAS-013 | Permanent delete active canvas | DELETE `/api/canvas/:id/permanent` on non-deleted canvas | 400, must soft-delete first | P2 | Yes |
| CANVAS-014 | Canvas with invalid ID format | GET `/api/canvas/not-a-valid-id` | 404 or 400, handled gracefully | P2 | Yes |
| CANVAS-015 | Create canvas with empty name | POST `/api/canvas` with empty string name | 400, validation error | P1 | Yes |
| CANVAS-016 | Create canvas with very long name | POST `/api/canvas` with 1000+ char name | 400, validation error or truncation | P2 | Yes |
| CANVAS-017 | Canvas list performance with many canvases | Create 50 canvases, GET `/api/canvas` | 200, response < 500ms, all canvases returned | P2 | No |
| CANVAS-018 | Canvas ownership transferred on account link | Link legacy account to email user | Canvases accessible under new userId auth | P1 | No |
| CANVAS-019 | Canvas ethics metadata | Set ethicsApprovalId and ethicsStatus on canvas | Fields persisted and returned in detail view | P2 | Yes |
| CANVAS-020 | Canvas data retention date | Set dataRetentionDate on canvas | Field persisted, data auto-purge at date (if implemented) | P3 | No |

### 2.3 Transcripts (15 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| TRANS-001 | Create transcript with valid data | POST `/api/canvas/:id/transcripts` with title and content | 201, transcript created with sortOrder | P0 | Yes |
| TRANS-002 | Create transcript exceeding plan limit | Free user with 2 transcripts creates third | 403, PLAN_LIMIT_EXCEEDED | P0 | Yes |
| TRANS-003 | Create transcript exceeding word limit | Free user posts content > 5000 words | 403, word limit error with current/max counts | P0 | Yes |
| TRANS-004 | Update transcript title | PUT `/api/canvas/:id/transcripts/:tid` with new title | 200, title updated | P1 | Yes |
| TRANS-005 | Update transcript content | PUT `/api/canvas/:id/transcripts/:tid` with new content | 200, content updated, word count re-validated | P1 | Yes |
| TRANS-006 | Delete transcript | DELETE `/api/canvas/:id/transcripts/:tid` | 200, transcript and associated codings cascade-deleted | P0 | Yes |
| TRANS-007 | Soft delete transcript | DELETE `/api/canvas/:id/transcripts/:tid` (soft) | 200, deletedAt set, excluded from canvas detail | P1 | Yes |
| TRANS-008 | Assign transcript to case | PUT `/api/canvas/:id/transcripts/:tid` with caseId | 200, transcript.caseId updated | P1 | Yes |
| TRANS-009 | Bulk import transcripts | POST `/api/canvas/:id/transcripts/bulk` with array | 201, all transcripts created respecting plan limits | P1 | Partial |
| TRANS-010 | Cross-canvas import | POST `/api/canvas/:id/transcripts/import/:sourceCanvasId` | 201, transcript copied from source canvas with new IDs | P2 | No |
| TRANS-011 | Anonymize transcript | POST `/api/canvas/:id/transcripts/:tid/anonymize` | 200, PII replaced with placeholders, isAnonymized set true | P1 | Partial |
| TRANS-012 | Create transcript with empty content | POST with empty content string | 400, validation error requiring content | P2 | Yes |
| TRANS-013 | Transcript sortOrder management | Create 3 transcripts, verify sortOrder 0, 1, 2 | Transcripts ordered correctly in canvas detail | P2 | Yes |
| TRANS-014 | Transcript with geolocation metadata | Create transcript with latitude, longitude, locationName | Fields persisted, available for GeoMap analysis | P2 | No |
| TRANS-015 | Transcript with event date | Create transcript with eventDate | Field persisted, available for Timeline analysis | P2 | No |

### 2.4 Coding (25 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| CODE-001 | Create code (question) | POST `/api/canvas/:id/questions` with text and color | 201, question created | P0 | Yes |
| CODE-002 | Create code exceeding plan limit | Free user with 5 codes creates sixth | 403, PLAN_LIMIT_EXCEEDED | P0 | Yes |
| CODE-003 | Update code text | PUT `/api/canvas/:id/questions/:qid` with new text | 200, text updated | P1 | Yes |
| CODE-004 | Update code color | PUT `/api/canvas/:id/questions/:qid` with new color hex | 200, color updated | P2 | Yes |
| CODE-005 | Delete code | DELETE `/api/canvas/:id/questions/:qid` | 200, question and all associated codings cascade-deleted | P0 | Yes |
| CODE-006 | Apply code to text segment | POST `/api/canvas/:id/codings` with transcriptId, questionId, startOffset, endOffset, codedText | 201, coding created | P0 | Yes |
| CODE-007 | Apply code with overlapping offsets | Code same text range with different questions | Both codings created (overlapping allowed) | P1 | Yes |
| CODE-008 | Apply code with invalid offsets | startOffset > endOffset or negative values | 400, validation error | P1 | Yes |
| CODE-009 | Apply code with out-of-bounds offsets | Offsets exceed transcript content length | 400, validation error | P2 | Yes |
| CODE-010 | Delete coding | DELETE `/api/canvas/:id/codings/:cid` | 200, coding removed | P0 | Yes |
| CODE-011 | Update coding annotation | PUT `/api/canvas/:id/codings/:cid` with annotation text | 200, annotation saved | P1 | Yes |
| CODE-012 | Reassign coding to different code | PUT `/api/canvas/:id/codings/:cid/reassign` with newQuestionId | 200, coding.questionId updated | P1 | Yes |
| CODE-013 | Merge codes | POST `/api/canvas/:id/questions/merge` with sourceId, targetId | 200, all codings from source moved to target, source deleted | P1 | Yes |
| CODE-014 | Merge code into itself | POST merge with sourceId === targetId | 400, cannot merge code into itself | P2 | Yes |
| CODE-015 | Auto-code by keyword | POST `/api/canvas/:id/auto-code` with questionId, pattern (keyword mode) | 201, codings created for all keyword matches across transcripts | P1 | Yes |
| CODE-016 | Auto-code by regex | POST `/api/canvas/:id/auto-code` with pattern (regex mode) | 201, codings created for all regex matches | P1 | Yes |
| CODE-017 | Auto-code with invalid regex | POST auto-code with malformed regex | 400, regex parse error message | P2 | Yes |
| CODE-018 | Auto-code on Free plan | Free user attempts auto-code | 403, auto-code not enabled on Free plan | P0 | Yes |
| CODE-019 | In-vivo coding | Select text in transcript, create new question from selected text, apply coding in one operation | Question created with selected text as name, coding applied | P1 | Partial |
| CODE-020 | Code hierarchy — set parent | PUT `/api/canvas/:id/questions/:qid` with parentQuestionId | 200, hierarchical relationship established | P1 | Yes |
| CODE-021 | Code hierarchy — remove parent | PUT with parentQuestionId: null | 200, question becomes top-level | P2 | Yes |
| CODE-022 | Code hierarchy — circular reference | Set question A parent to B, then B parent to A | 400, circular reference prevented | P2 | No |
| CODE-023 | Coding with note | POST coding with optional note field | 201, note persisted with coding | P2 | Yes |
| CODE-024 | List all codings for transcript | GET `/api/canvas/:id/codings?transcriptId=:tid` | 200, filtered list of codings for that transcript | P1 | Yes |
| CODE-025 | Bulk delete codings | DELETE `/api/canvas/:id/codings/bulk` with array of coding IDs | 200, all specified codings removed | P2 | No |

### 2.5 Analysis Nodes (20 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| ANALYSIS-001 | Create stats node | POST `/api/canvas/:id/computed` with nodeType: "stats" | 201, node created with computed stats result | P0 | Yes |
| ANALYSIS-002 | Create word cloud node | POST with nodeType: "wordcloud" | 201, word frequency data computed | P0 | Yes |
| ANALYSIS-003 | Create search node | POST with nodeType: "search", config: { pattern, mode: "keyword" } | 201, search matches computed | P1 | Yes |
| ANALYSIS-004 | Create search node with regex | POST with nodeType: "search", config: { pattern, mode: "regex" } | 201, regex matches computed | P1 | Yes |
| ANALYSIS-005 | Create co-occurrence node | POST with nodeType: "cooccurrence", config: { questionIds } | 201, co-occurring coding segments computed | P1 | Yes |
| ANALYSIS-006 | Create matrix node | POST with nodeType: "matrix" | 201, case-by-code matrix computed | P1 | Yes |
| ANALYSIS-007 | Create comparison node | POST with nodeType: "comparison", config: { transcriptIds } | 201, coding profiles compared | P1 | Yes |
| ANALYSIS-008 | Create cluster node | POST with nodeType: "cluster", config: { k: 3 } | 201, k-means clusters of coded segments | P2 | Yes |
| ANALYSIS-009 | Create coding query node | POST with nodeType: "codingquery", config: { conditions } | 201, boolean query results computed | P1 | Yes |
| ANALYSIS-010 | Create sentiment node | POST with nodeType: "sentiment" | 201, sentiment scores computed per segment | P2 | Yes |
| ANALYSIS-011 | Create treemap node | POST with nodeType: "treemap" | 201, hierarchical size data computed | P2 | Yes |
| ANALYSIS-012 | Create document portrait node | POST with nodeType: "documentportrait" | 201, visual color-coded portrait data | P2 | Yes |
| ANALYSIS-013 | Create timeline node | POST with nodeType: "timeline" | 201, date-sorted entries computed | P2 | Yes |
| ANALYSIS-014 | Create geomap node | POST with nodeType: "geomap" | 201, geo-located transcript data computed | P2 | Yes |
| ANALYSIS-015 | Re-run computed node | PUT `/api/canvas/:id/computed/:nid` (update config or trigger refresh) | 200, result re-computed with latest data | P1 | Yes |
| ANALYSIS-016 | Delete computed node | DELETE `/api/canvas/:id/computed/:nid` | 200, node removed | P1 | Yes |
| ANALYSIS-017 | Free plan analysis restriction | Free user creates "cluster" node (not in allowed list) | 403, analysis type not available on Free plan | P0 | Yes |
| ANALYSIS-018 | Invalid analysis node type | POST with nodeType: "nonexistent" | 400, validation error listing valid types | P2 | Yes |
| ANALYSIS-019 | Analysis with no codings | Create stats node on canvas with 0 codings | 200, result with empty/zero data (no crash) | P1 | Yes |
| ANALYSIS-020 | Analysis config validation | Create co-occurrence with empty questionIds array | 400, validation error requiring at least 2 question IDs | P2 | Yes |

### 2.6 AI Features (15 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| AI-001 | Suggest codes for text segment | POST `/api/canvas/:id/ai/suggest-codes` with transcriptId, codedText, offsets | 200, AI suggestions returned with confidence scores | P0 | Partial |
| AI-002 | Auto-code entire transcript | POST `/api/canvas/:id/ai/auto-code-transcript` with transcriptId | 200, AI-generated codings created as pending suggestions | P1 | Partial |
| AI-003 | Accept AI suggestion | PUT `/api/canvas/:id/ai/suggestions/:sid` with status: "accepted" | 200, suggestion status updated, coding created | P1 | Yes |
| AI-004 | Reject AI suggestion | PUT `/api/canvas/:id/ai/suggestions/:sid` with status: "rejected" | 200, suggestion status updated, no coding created | P1 | Yes |
| AI-005 | Bulk accept suggestions | POST `/api/canvas/:id/ai/suggestions/bulk` with action: "accept", ids array | 200, all specified suggestions accepted | P2 | Yes |
| AI-006 | Bulk reject suggestions | POST `/api/canvas/:id/ai/suggestions/bulk` with action: "reject", ids array | 200, all specified suggestions rejected | P2 | Yes |
| AI-007 | AI on Free plan | Free user calls suggest-codes endpoint | 403, AI not enabled on Free plan | P0 | Yes |
| AI-008 | AI with no API key configured | Pro user without UserAiConfig calls AI endpoint | 400, error prompting user to configure API key | P1 | Partial |
| AI-009 | Save AI config (OpenAI) | POST `/api/ai/config` with provider: "openai", apiKey | 200, key encrypted and stored in UserAiConfig | P1 | Yes |
| AI-010 | Save AI config (Anthropic) | POST `/api/ai/config` with provider: "anthropic", apiKey | 200, key encrypted and stored | P1 | Yes |
| AI-011 | Save AI config (Google) | POST `/api/ai/config` with provider: "google", apiKey | 200, key encrypted and stored | P2 | Yes |
| AI-012 | Chat/RAG query | POST `/api/canvas/:id/chat` with user message | 200, AI response with citations to relevant transcript segments | P1 | Partial |
| AI-013 | Summarize transcript | POST `/api/canvas/:id/summaries` with sourceType: "transcript", sourceId | 200, summary text generated and stored | P1 | Partial |
| AI-014 | AI rate limiting | Exceed aiRequestsPerDay limit (1000 for Pro) | 429, rate limit error with reset time | P2 | No |
| AI-015 | AI usage tracking | Call any AI endpoint successfully | AiUsage record created with provider, model, token counts | P2 | Partial |

### 2.7 Collaboration (15 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| COLLAB-001 | Create share link | POST `/api/canvas/:id/shares` | 201, share code generated, returned with URL | P0 | Yes |
| COLLAB-002 | Share link on Free plan | Free user creates share link | 403, sharing not enabled on Free plan | P0 | Yes |
| COLLAB-003 | Share limit enforcement | Pro user with 5 shares creates sixth | 403, PLAN_LIMIT_EXCEEDED (max 5 shares) | P1 | Yes |
| COLLAB-004 | View shared canvas (read-only) | GET `/api/share/:code` | 200, canvas data returned (read-only snapshot) | P0 | Yes |
| COLLAB-005 | Clone shared canvas | POST `/api/share/:code/clone` | 201, full canvas copy created under cloner's account, cloneCount incremented | P1 | Yes |
| COLLAB-006 | Expired share link | GET `/api/share/:code` where expiresAt is past | 410 Gone, share expired error | P1 | Yes |
| COLLAB-007 | Invalid share code | GET `/api/share/nonexistent` | 404, share not found | P1 | Yes |
| COLLAB-008 | Invite collaborator | POST `/api/canvas/:id/collaborators` with userId and role | 201, collaborator record created | P1 | Yes |
| COLLAB-009 | Collaborator limit enforcement | Pro user exceeds maxCollaborators (3) | 403, PLAN_LIMIT_EXCEEDED | P1 | Yes |
| COLLAB-010 | Remove collaborator | DELETE `/api/canvas/:id/collaborators/:userId` | 200, collaborator removed | P1 | Yes |
| COLLAB-011 | Collaborator access control (editor) | Editor collaborator edits canvas data | 200, changes saved | P1 | No |
| COLLAB-012 | Collaborator access control (viewer) | Viewer collaborator attempts edit | 403, read-only access | P1 | No |
| COLLAB-013 | WebSocket presence join | Connect to Socket.IO with valid JWT, join canvas room | User appears in presence list for that canvas | P1 | No |
| COLLAB-014 | WebSocket cursor sync | Move cursor while connected to canvas room | Other connected users receive cursor position updates | P2 | No |
| COLLAB-015 | WebSocket presence leave | Disconnect from Socket.IO | User removed from presence list within timeout | P2 | No |

### 2.8 Billing (15 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| BILL-001 | Create Stripe Checkout session (Pro monthly) | POST `/api/billing/checkout` with priceId for Pro monthly | 200, Stripe session URL returned | P0 | Yes |
| BILL-002 | Create Stripe Checkout session (Pro annual) | POST `/api/billing/checkout` with Pro annual priceId | 200, Stripe session URL returned | P0 | Yes |
| BILL-003 | Create Stripe Checkout session (Team monthly) | POST `/api/billing/checkout` with Team monthly priceId | 200, Stripe session URL returned | P1 | Yes |
| BILL-004 | Webhook: checkout.session.completed | Simulate Stripe webhook with completed checkout | User plan updated to "pro" or "team", Subscription record created | P0 | Yes |
| BILL-005 | Webhook: customer.subscription.updated | Simulate webhook with subscription update | Subscription record updated (status, period, priceId) | P0 | Yes |
| BILL-006 | Webhook: customer.subscription.deleted | Simulate webhook with subscription cancellation | User plan downgraded to "free", subscription status set to "canceled" | P0 | Yes |
| BILL-007 | Webhook idempotency | Send same webhook event ID twice | Second delivery ignored (WebhookEvent dedup table) | P1 | Yes |
| BILL-008 | Webhook signature validation | Send webhook with invalid Stripe signature | 400, signature mismatch error | P0 | Yes |
| BILL-009 | Customer portal access | POST `/api/billing/portal` | 200, Stripe Customer Portal URL returned | P1 | Yes |
| BILL-010 | Academic discount checkout | POST `/api/billing/checkout` with .edu email | 200, session includes academic coupon (40% off) | P1 | Partial |
| BILL-011 | Plan downgrade with excess data | User on Pro downgrades to Free with 3 canvases (limit: 1) | Existing data preserved but user cannot create new canvases until under limit | P1 | No |
| BILL-012 | Plan upgrade unlocks features | User upgrades from Free to Pro | Auto-code, AI, ethics, shares, all analysis types immediately available | P0 | Partial |
| BILL-013 | Subscription past_due status | Webhook with past_due status | User notified, grace period before downgrade | P1 | Yes |
| BILL-014 | Cancel subscription at period end | POST `/api/billing/cancel` or via portal | cancelAtPeriodEnd set true, access maintained until period end | P1 | Partial |
| BILL-015 | Free user billing checkout rejection | Free user without payment method accesses portal | Appropriate error or redirect to checkout flow | P2 | No |

### 2.9 Ethics and Compliance (10 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| ETHICS-001 | Create consent record | POST `/api/canvas/:id/ethics/consent` with participantId, consentType | 201, consent record created | P1 | Yes |
| ETHICS-002 | Withdraw consent | PUT `/api/canvas/:id/ethics/consent/:pid` with consentStatus: "withdrawn" | 200, withdrawalDate set, status updated | P1 | Yes |
| ETHICS-003 | Duplicate consent for same participant | POST consent with existing participantId on same canvas | 409, unique constraint error | P2 | Yes |
| ETHICS-004 | Ethics on Free plan | Free user accesses ethics endpoints | 403, ethics not enabled on Free plan | P0 | Yes |
| ETHICS-005 | Audit log creation | Perform any state-changing API operation | AuditLog record created with action, resource, actorId, IP, timestamp | P1 | Yes |
| ETHICS-006 | Audit log query | GET `/api/canvas/:id/ethics/audit` | 200, paginated audit log entries for canvas | P2 | Partial |
| ETHICS-007 | Data anonymization | POST anonymize endpoint for transcript | PII patterns (names, emails, phones) replaced with placeholders | P1 | Partial |
| ETHICS-008 | Data retention enforcement | Canvas with dataRetentionDate in the past | Data flagged for purge or access restricted | P2 | No |
| ETHICS-009 | Ethics approval workflow | Set ethicsApprovalId and ethicsStatus on canvas | Status transitions: pending -> approved -> active | P2 | No |
| ETHICS-010 | Consent list for canvas | GET `/api/canvas/:id/ethics/consent` | 200, all consent records for canvas returned | P2 | Yes |

### 2.10 Import/Export (10 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| EXPORT-001 | Export canvas as CSV | GET `/api/canvas/:id/export/csv` | 200, CSV file with codings (transcriptTitle, questionText, codedText, offsets) | P0 | Yes |
| EXPORT-002 | Export canvas as QDPX | GET `/api/canvas/:id/export/qdpx` | 200, valid QDPX XML archive compatible with other QDA tools | P1 | Partial |
| EXPORT-003 | Export canvas as PNG | GET `/api/canvas/:id/export/png` | 200, rendered canvas image | P2 | No |
| EXPORT-004 | Export canvas as HTML | GET `/api/canvas/:id/export/html` | 200, self-contained HTML report | P2 | No |
| EXPORT-005 | Export restricted on Free plan | Free user exports as QDPX (not in allowed formats) | 403, export format not available on Free plan | P0 | Yes |
| EXPORT-006 | Import QDPX file | POST `/api/canvas/:id/import/qdpx` with QDPX file upload | 201, canvas populated with imported codes, transcripts, codings | P1 | Partial |
| EXPORT-007 | Import invalid QDPX | POST import with corrupt/non-QDPX file | 400, parse error with descriptive message | P2 | Yes |
| EXPORT-008 | Bulk transcript import from CSV | POST `/api/canvas/:id/transcripts/import/csv` with CSV file | 201, transcripts created from CSV rows | P2 | No |
| EXPORT-009 | Export codebook | GET `/api/canvas/:id/export/codebook` | 200, structured code definitions with hierarchy and counts | P2 | Partial |
| EXPORT-010 | Survey import (Qualtrics/SurveyMonkey) | POST `/api/canvas/:id/import/survey` with survey data | 201, responses imported as transcripts | P3 | No |

### 2.11 Canvas Workspace UX (25 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| UX-001 | Zoom in with scroll wheel | Scroll up on canvas viewport | Canvas zooms in smoothly, no snap-back | P0 | Yes |
| UX-002 | Zoom out with scroll wheel | Scroll down on canvas viewport | Canvas zooms out smoothly, respects min zoom | P0 | Yes |
| UX-003 | Pan canvas with mouse drag | Click and drag on empty canvas area | Viewport pans, no node selection triggered | P0 | Yes |
| UX-004 | Drag node to new position | Mousedown on node header, drag, release | Node moves to new position, position saved to DB | P0 | Yes |
| UX-005 | Resize node | Drag node resize handle | Node dimensions update, minimum size enforced | P1 | Partial |
| UX-006 | Collapse/expand node | Click collapse button on node | Node toggles between collapsed/expanded state, position saved | P1 | Yes |
| UX-007 | Undo last action | Press Ctrl+Z | Last coding/move/create action reversed | P1 | Partial |
| UX-008 | Redo undone action | Press Ctrl+Shift+Z or Ctrl+Y | Action re-applied | P1 | Partial |
| UX-009 | Keyboard shortcut — new memo | Press configured shortcut key | New memo node created at viewport center | P2 | Yes |
| UX-010 | Keyboard shortcut — delete selected | Press Delete/Backspace with node selected | Confirmation dialog shown, node deleted on confirm | P1 | Yes |
| UX-011 | Context menu on node | Right-click on a node | Context menu with edit, delete, duplicate, collapse options | P1 | Yes |
| UX-012 | Context menu on canvas | Right-click on empty canvas area | Context menu with add transcript, add code, add memo options | P1 | Yes |
| UX-013 | Command palette open | Press Ctrl+K | Command palette overlay appears with search input | P1 | Yes |
| UX-014 | Command palette search | Type in command palette | Commands filtered in real-time, arrow key navigation works | P1 | Yes |
| UX-015 | Snap to grid | Enable snap-to-grid, drag node | Node position snaps to grid intervals | P2 | Partial |
| UX-016 | Dark mode toggle | Toggle dark mode in settings | All components switch to dark theme, preference persisted | P1 | Yes |
| UX-017 | System dark mode detection | OS dark mode enabled, app set to "system" preference | App renders in dark mode | P2 | No |
| UX-018 | Layout save (debounced) | Move multiple nodes quickly | Positions saved to DB after debounce period (not per-pixel) | P0 | Partial |
| UX-019 | Focus mode | Activate focus mode | Sidebar and toolbar hidden, canvas maximized | P2 | Yes |
| UX-020 | Bookmark node | Bookmark a transcript node | Node marked with bookmark indicator, accessible from bookmark list | P2 | Partial |
| UX-021 | Mute/unmute node | Toggle mute on a transcript node | Muted nodes visually dimmed, excluded from analysis computations | P2 | Partial |
| UX-022 | Multi-select nodes | Shift+click or drag-select multiple nodes | All selected nodes highlighted, batch operations available | P1 | Partial |
| UX-023 | Fit view | Press fit-view button or shortcut | Viewport zooms/pans to show all nodes | P2 | Yes |
| UX-024 | Mini-map navigation | Click on mini-map area | Viewport scrolls to clicked region | P2 | No |
| UX-025 | Canvas tab bar | Open multiple canvases via tab bar | Tabs shown, switching tabs preserves viewport state per canvas | P1 | Yes |

### 2.12 Navigation and Pages (15 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| NAV-001 | Landing page renders | Navigate to `/` | Landing page with hero, features, CTA buttons rendered | P0 | Yes |
| NAV-002 | Pricing page renders | Navigate to `/pricing` | Three plan tiers displayed with feature comparison, monthly/annual toggle | P0 | Yes |
| NAV-003 | Pricing page annual toggle | Click annual toggle | Prices update to annual rates with discount shown | P1 | Yes |
| NAV-004 | Login page renders | Navigate to `/login` | Email login form primary, access code section collapsible | P0 | Yes |
| NAV-005 | Login page — access code toggle | Click "Use access code" toggle | Access code input field revealed | P1 | Yes |
| NAV-006 | Account page — authenticated | Navigate to `/account` while logged in | Profile info, plan details, usage stats, billing portal link displayed | P0 | Yes |
| NAV-007 | Account page — unauthenticated | Navigate to `/account` without auth | Redirect to `/login` with return URL preserved | P0 | Yes |
| NAV-008 | Team page | Navigate to `/team` | Team members list, invite form (Team plan only) | P1 | Partial |
| NAV-009 | 404 page | Navigate to `/nonexistent-route` | Custom 404 page with navigation back to home | P1 | Yes |
| NAV-010 | Deep linking to canvas | Navigate to `/canvas?id=:canvasId` | Canvas loaded directly if authenticated, login redirect if not | P1 | Yes |
| NAV-011 | Session expired banner | JWT expires during active session | Session-expired banner shown, user prompted to re-login | P0 | Yes |
| NAV-012 | Privacy policy page | Navigate to `/privacy` | Privacy policy content rendered | P2 | Yes |
| NAV-013 | Terms of service page | Navigate to `/terms` | Terms content rendered | P2 | Yes |
| NAV-014 | Verify email page | Navigate to `/verify-email?token=:token` | Email verification processed, success/error message shown | P1 | No |
| NAV-015 | Repository page | Navigate to `/repository` | Research repositories listed, create/manage interface shown | P2 | Partial |

### 2.13 Teams (10 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| TEAM-001 | Create team | POST `/api/teams` with name | 201, team created, creator added as owner | P1 | Yes |
| TEAM-002 | Invite team member | POST `/api/teams/:id/members` with userId | 201, member added with "member" role | P1 | Yes |
| TEAM-003 | Remove team member | DELETE `/api/teams/:id/members/:userId` | 200, member removed | P1 | Yes |
| TEAM-004 | Update member role | PUT `/api/teams/:id/members/:userId` with role: "admin" | 200, role updated | P2 | Yes |
| TEAM-005 | Only owner can delete team | Non-owner attempts DELETE `/api/teams/:id` | 403, only team owner can delete | P1 | Yes |
| TEAM-006 | Team on non-Team plan | Pro user creates team | 403, teams require Team plan | P0 | Yes |
| TEAM-007 | List team members | GET `/api/teams/:id/members` | 200, array of members with roles and join dates | P1 | Yes |
| TEAM-008 | Intercoder reliability (Kappa) | Two team members code same transcript, compute Kappa | Kappa score computed and returned | P1 | Partial |
| TEAM-009 | Intercoder on non-Team plan | Pro user attempts intercoder computation | 403, intercoder requires Team plan | P1 | Yes |
| TEAM-010 | Team canvas sharing | Share canvas with team members | All team members gain access based on their roles | P1 | No |

### 2.14 Documents and Uploads (10 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| DOC-001 | Upload image document | POST `/api/canvas/:id/documents` with image file | 201, document created, file stored | P1 | Partial |
| DOC-002 | Upload PDF document | POST with PDF file | 201, document created, pageCount extracted | P1 | Partial |
| DOC-003 | Region coding on document | POST `/api/canvas/:id/documents/:did/regions` with coordinates | 201, region coding created with x, y, width, height | P1 | No |
| DOC-004 | File upload on Free plan | Free user attempts file upload | 403, file uploads not enabled on Free plan | P0 | Yes |
| DOC-005 | File size limit | Upload file exceeding maxStorageMb | 413 or 403, storage limit error | P1 | No |
| DOC-006 | Audio upload for transcription | POST audio file to upload endpoint | 201, file uploaded, transcription job queued | P1 | Partial |
| DOC-007 | Transcription job status | GET `/api/canvas/:id/transcription/:jobId` | 200, job status (queued/processing/completed/failed) | P2 | No |
| DOC-008 | Transcription completion | Transcription job completes | Transcript auto-created from result text with timestamps | P1 | No |
| DOC-009 | Invalid file type | Upload .exe or unsupported file type | 400, unsupported file type error | P1 | Yes |
| DOC-010 | Delete document | DELETE `/api/canvas/:id/documents/:did` | 200, document and region codings cascade-deleted | P1 | Yes |

### 2.15 Research Assistant (Chat/RAG) (10 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| CHAT-001 | Send chat message | POST `/api/canvas/:id/chat` with content | 200, AI response with citations array | P1 | Partial |
| CHAT-002 | Chat history | GET `/api/canvas/:id/chat` | 200, ordered list of user/assistant messages | P1 | Yes |
| CHAT-003 | Chat citations reference real data | Send question about transcript content | Citations point to valid transcript segments with sourceId | P1 | No |
| CHAT-004 | Embed canvas data | POST `/api/canvas/:id/embeddings` | 200, text embeddings generated for transcripts and codings | P2 | No |
| CHAT-005 | Summarize canvas | POST `/api/canvas/:id/summaries` with sourceType: "canvas" | 200, overall canvas summary generated | P1 | Partial |
| CHAT-006 | Summarize specific question | POST summaries with sourceType: "question", sourceId | 200, summary of all codings under that question | P2 | Partial |
| CHAT-007 | Summary types | Generate paraphrase, abstract, and thematic summaries | Each type produces appropriately styled output | P2 | No |
| CHAT-008 | Chat on Free plan | Free user accesses chat endpoints | 403, AI not enabled on Free plan | P0 | Yes |
| CHAT-009 | Clear chat history | DELETE `/api/canvas/:id/chat` | 200, all chat messages for canvas deleted | P2 | Yes |
| CHAT-010 | Chat with no embeddings | Send chat message before embeddings exist | Graceful handling, general response without specific citations | P2 | No |

### 2.16 Internationalization (5 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| I18N-001 | English locale (default) | Load app with browser language en | All UI strings in English | P1 | Yes |
| I18N-002 | Spanish locale | Set language to es | All UI strings in Spanish | P2 | No |
| I18N-003 | French locale | Set language to fr | All UI strings in French | P2 | No |
| I18N-004 | German locale | Set language to de | All UI strings in German | P2 | No |
| I18N-005 | Missing translation fallback | Remove a key from es.json | Falls back to English string, no crash | P1 | Partial |

### 2.17 Training Center (5 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| TRAIN-001 | Create training document | POST `/api/canvas/:id/training` with transcript, gold codings, passThreshold | 201, training document created | P2 | Yes |
| TRAIN-002 | Submit training attempt | POST `/api/canvas/:id/training/:tid/attempts` with user codings | 201, Kappa score computed, pass/fail determined | P2 | Partial |
| TRAIN-003 | List training documents | GET `/api/canvas/:id/training` | 200, list of training documents with attempt counts | P2 | Yes |
| TRAIN-004 | Training attempt history | GET `/api/canvas/:id/training/:tid/attempts` | 200, list of attempts with scores and pass status | P2 | Yes |
| TRAIN-005 | Delete training document | DELETE `/api/canvas/:id/training/:tid` | 200, document and attempts cascade-deleted | P2 | Yes |

### 2.18 Research Repository (5 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| REPO-001 | Create repository | POST `/api/repositories` with name | 201, repository created | P2 | Yes |
| REPO-002 | Add insight to repository | POST `/api/repositories/:id/insights` with title, content, tags | 201, insight created | P2 | Yes |
| REPO-003 | Search insights | GET `/api/repositories/:id/insights?search=keyword` | 200, filtered insights returned | P2 | Partial |
| REPO-004 | Repository on Free plan | Free user creates repository | 403, repository not enabled on Free plan | P1 | Yes |
| REPO-005 | Delete repository | DELETE `/api/repositories/:id` | 200, repository and insights cascade-deleted | P2 | Yes |

### 2.19 Integrations (5 cases)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| INTEG-001 | Connect Zoom integration | POST `/api/integrations` with provider: "zoom", accessToken | 201, integration created | P2 | Partial |
| INTEG-002 | Connect Slack integration | POST with provider: "slack" | 201, integration created | P3 | No |
| INTEG-003 | List integrations | GET `/api/integrations` | 200, user's connected integrations listed | P2 | Yes |
| INTEG-004 | Disconnect integration | DELETE `/api/integrations/:id` | 200, integration removed | P2 | Yes |
| INTEG-005 | Integrations on non-Team plan | Pro user attempts to connect integration | 403, integrations require Team plan | P1 | Yes |

---

## 3. Integration Test Cases (User Journeys)

### Journey 1: New Researcher Onboarding

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Navigate to landing page | Hero section, feature cards, CTA visible |
| 2 | Click "Get Started Free" | Redirect to registration page |
| 3 | Fill registration form (name, email, password) | Form validates in real-time |
| 4 | Submit registration | Account created, JWT issued, redirect to canvas page |
| 5 | See empty canvas workspace | Onboarding tour begins (if first visit) |
| 6 | Create first canvas ("My Research") | Canvas created, appears in canvas list |
| 7 | Add first transcript (paste interview text) | Transcript node appears on canvas |
| 8 | Create first code ("Trust") | Question node appears with default color |
| 9 | Select text in transcript, apply code | Coding created, highlight visible in transcript |
| 10 | Add a memo with observations | Memo node appears on canvas |
| 11 | Create stats analysis node | Stats computed, coding frequency chart displayed |
| 12 | Export as CSV | CSV file downloaded with all codings |

**Priority:** P0 | **Automated:** Partial (E2E covers steps 1-6)

### Journey 2: Team Collaboration Workflow

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Team owner upgrades to Team plan | Checkout completes, plan updated |
| 2 | Owner creates team "Research Lab" | Team created with owner as first member |
| 3 | Owner invites 2 researchers by email | Team members added, invitations sent |
| 4 | Team member accepts invitation | Member appears in team list |
| 5 | Owner creates canvas and adds collaborators | Collaborators can access canvas |
| 6 | Two members code same transcript independently | Codings visible per-user |
| 7 | Owner creates training document with gold standard | Training doc available for team |
| 8 | Members submit training attempts | Kappa scores computed for each attempt |
| 9 | Owner runs intercoder reliability analysis | Kappa matrix displayed for all coders |
| 10 | Owner resolves coding disagreements | Final codings reflect consensus |

**Priority:** P1 | **Automated:** Partial (team CRUD tested, intercoder manual)

### Journey 3: Plan Upgrade Flow

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Free user hits canvas limit (1 canvas) | Error message with upgrade CTA shown |
| 2 | User clicks upgrade on pricing page | Redirected to Stripe Checkout |
| 3 | User completes payment (test card) | Webhook fires, plan updated to Pro |
| 4 | User returns to app | JWT refreshed with new plan claims |
| 5 | User creates second canvas | Canvas created successfully |
| 6 | User accesses AI suggest-codes | AI features now available |
| 7 | User enables ethics panel | Ethics consent management accessible |
| 8 | User creates share link | Share link generated (up to 5) |
| 9 | User visits account page | Plan shows "Pro", usage stats accurate |
| 10 | User accesses billing portal | Stripe portal loads with subscription details |

**Priority:** P0 | **Automated:** Partial (webhook tested, E2E manual)

### Journey 4: Data Lifecycle

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Create canvas with 3 transcripts, 5 codes, 20 codings | All data created and visible |
| 2 | Edit transcript content | Content updated, existing codings preserved where valid |
| 3 | Share canvas via share link | Share link generated, read-only view works |
| 4 | External user clones shared canvas | Full copy created, cloneCount incremented |
| 5 | Original user soft-deletes canvas | Canvas moves to trash, excluded from main list |
| 6 | User views trash | Deleted canvas visible with deletion date |
| 7 | User restores canvas | Canvas back in main list, all data intact |
| 8 | User soft-deletes again then permanently deletes | Canvas and all related data removed from DB |
| 9 | Share link for permanently deleted canvas | 404, share no longer valid |
| 10 | Cloned canvas still accessible | Clone is independent, fully functional |

**Priority:** P0 | **Automated:** Yes (integration tests cover this)

### Journey 5: AI-Assisted Coding Workflow

| Step | Action | Verification |
|------|--------|-------------|
| 1 | User configures OpenAI API key | Key encrypted and stored |
| 2 | User selects text in transcript | Selection toolbar appears with "Suggest Codes" |
| 3 | User clicks "Suggest Codes" | AI returns 3-5 code suggestions with confidence scores |
| 4 | User accepts 2 suggestions, rejects 1 | Accepted suggestions become codings, rejected marked |
| 5 | User triggers auto-code on entire transcript | AI generates suggestions for full transcript |
| 6 | User bulk-accepts high-confidence suggestions | Multiple codings created at once |
| 7 | User asks research assistant a question | RAG response with citations to relevant segments |
| 8 | User generates transcript summary | Summary stored and displayed in summary panel |

**Priority:** P1 | **Automated:** Partial (API mocked, LLM calls stubbed)

### Journey 6: Import-Code-Analyze-Export

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Import QDPX file from NVivo/ATLAS.ti | Canvas populated with codes and transcripts |
| 2 | Review imported structure | Codes, transcripts, codings all mapped correctly |
| 3 | Add new codes and apply to imported text | New codings interleave with imported ones |
| 4 | Run full analysis suite (stats, wordcloud, matrix, sentiment) | All analyses compute correctly on combined data |
| 5 | Export as QDPX for colleague | Valid QDPX with all data round-trips cleanly |
| 6 | Export as CSV for spreadsheet analysis | CSV has all codings with correct metadata |

**Priority:** P1 | **Automated:** Partial

### Journey 7: Offline and Recovery

| Step | Action | Verification |
|------|--------|-------------|
| 1 | User loads canvas with data while online | Full canvas data cached locally |
| 2 | Network disconnects | Offline indicator shown |
| 3 | User creates new codings while offline | Operations queued in offlineQueue |
| 4 | User edits memo while offline | Edit queued locally |
| 5 | Network reconnects | Queued operations sync to server |
| 6 | Canvas state matches expected | All offline changes persisted to DB |

**Priority:** P1 | **Automated:** No

### Journey 8: Document Coding Workflow

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Upload PDF document to canvas | Document node appears with page count |
| 2 | Open document viewer | PDF renders with navigation |
| 3 | Draw region on document page | Region coding overlay created |
| 4 | Assign code to region | Region linked to question |
| 5 | Navigate pages, add more regions | Multiple pages with region codings |
| 6 | View region codings in coding detail panel | All regions listed with page numbers |

**Priority:** P2 | **Automated:** No

### Journey 9: Multi-Language Research

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Switch UI language to Spanish | All interface elements in Spanish |
| 2 | Import transcripts in Spanish | Content stored with UTF-8 encoding |
| 3 | Create codes in Spanish | Question text supports Spanish characters |
| 4 | Run word cloud analysis | Word cloud shows Spanish words correctly |
| 5 | Export as CSV | CSV contains Spanish text without encoding issues |

**Priority:** P2 | **Automated:** No

### Journey 10: Cross-Canvas Research

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Create 3 canvases for different sub-studies | All canvases in canvas list |
| 2 | Import transcript from Canvas A into Canvas B | Transcript copied with new IDs |
| 3 | Create research repository | Repository accessible from repository page |
| 4 | Add insights from multiple canvases | Insights linked to source canvases |
| 5 | Search insights across repository | Cross-canvas search results returned |

**Priority:** P2 | **Automated:** No

### Journey 11: Audio Transcription Pipeline

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Upload audio file (MP3/WAV) | File uploaded, transcription job created |
| 2 | Monitor transcription progress | Status updates shown (queued -> processing) |
| 3 | Transcription completes | Transcript auto-created with timestamps |
| 4 | View transcript with timestamp markers | Timestamps displayed alongside text |
| 5 | Code transcribed content | Codings work normally on transcribed text |

**Priority:** P2 | **Automated:** No

### Journey 12: Presentation and Reporting

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Enable presentation mode | Toolbar/sidebar hidden, clean view |
| 2 | Navigate through nodes | Presentation-style navigation |
| 3 | Export rich HTML report | Self-contained HTML with visualizations |
| 4 | Export PNG of canvas | Canvas image rendered at high resolution |

**Priority:** P3 | **Automated:** No

### Journey 13: Case-Based Analysis

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Create cases (Participant A, B, C) | Cases created with attributes |
| 2 | Assign transcripts to cases | Transcripts linked to cases |
| 3 | Run case matrix analysis | Matrix shows codes by case |
| 4 | Run cross-case comparison | Comparison across participants |
| 5 | Run case timeline | Chronological view per case |

**Priority:** P1 | **Automated:** Partial

### Journey 14: Code Hierarchy and Refinement

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Create parent code "Emotions" | Top-level question created |
| 2 | Create child codes "Joy", "Fear", "Anger" | Children linked to parent |
| 3 | Apply child codes to text | Codings reference child questions |
| 4 | View treemap with hierarchy | Treemap shows nested structure |
| 5 | Merge "Fear" into "Anger" | Codings reassigned, "Fear" deleted |
| 6 | Hierarchy panel shows updated tree | Two children remain under "Emotions" |

**Priority:** P1 | **Automated:** Partial

### Journey 15: Academic Onboarding

| Step | Action | Verification |
|------|--------|-------------|
| 1 | Register with .edu email | Account created, email verification sent |
| 2 | Navigate to pricing page | Academic discount badge shown for .edu user |
| 3 | Click upgrade to Pro | Checkout session includes 40% academic coupon |
| 4 | Complete checkout | Pro plan at discounted rate |
| 5 | Verify subscription in account page | Plan shows Pro, discounted price visible |

**Priority:** P1 | **Automated:** Partial

---

## 4. Security Test Cases

### 4.1 Injection (OWASP A03:2021)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| SEC-001 | SQL injection in canvas name | POST `/api/canvas` with name: `'; DROP TABLE "CodingCanvas";--` | 201 or 400, no SQL execution (Prisma parameterized queries) | P0 | Yes |
| SEC-002 | SQL injection in search pattern | Create search node with pattern: `' OR '1'='1` | Pattern treated as literal string | P0 | Yes |
| SEC-003 | NoSQL injection in query params | GET `/api/canvas?name[$gt]=` | Params parsed as strings, no operator injection | P1 | Yes |
| SEC-004 | XSS in transcript content | Save transcript with `<script>alert('xss')</script>` | Content stored verbatim, rendered as text (React auto-escapes) | P0 | Yes |
| SEC-005 | XSS in canvas name | Save canvas with `<img src=x onerror=alert(1)>` | Name escaped in all rendering contexts | P0 | Yes |
| SEC-006 | Command injection in regex pattern | Create search node with regex: `; rm -rf /` | Pattern passed to regex engine only, no shell execution | P0 | Yes |

### 4.2 Broken Authentication (OWASP A07:2021)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| SEC-007 | Access API without JWT | Call any protected endpoint without Authorization header | 401 Unauthorized | P0 | Yes |
| SEC-008 | Access API with tampered JWT | Modify JWT payload and re-sign with wrong secret | 401 Unauthorized, invalid signature | P0 | Yes |
| SEC-009 | Access API with expired JWT | Use JWT past its expiration time | 401 Unauthorized, token expired | P0 | Yes |
| SEC-010 | Brute force login protection | 20 failed login attempts in 1 minute | Account locked or rate-limited (429) | P0 | Yes |
| SEC-011 | Password stored securely | Inspect DB record after registration | passwordHash is bcrypt hash, not plaintext | P0 | Yes |
| SEC-012 | JWT secret rotation | Deploy with new JWT_SECRET | Old tokens invalidated, new tokens work | P1 | No |

### 4.3 Sensitive Data Exposure (OWASP A02:2021)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| SEC-013 | API key not exposed in API response | GET `/api/ai/config` | Response includes provider and model, never raw API key | P0 | Yes |
| SEC-014 | Password hash not in API response | GET `/api/auth/me` or any user endpoint | passwordHash field never included in response | P0 | Yes |
| SEC-015 | Error messages don't leak internals | Trigger server error | Response has generic message, no stack trace or DB schema info | P0 | Yes |
| SEC-016 | HTTPS enforcement | Access app via HTTP in production | Redirect to HTTPS (301) | P0 | No |

### 4.4 Broken Access Control (OWASP A01:2021)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| SEC-017 | Cross-account canvas access | User A tries GET `/api/canvas/:idOwnedByB` | 404 Not Found (not 403, to avoid enumeration) | P0 | Yes |
| SEC-018 | Cross-account coding creation | User A tries POST coding on canvas owned by B | 404, canvas not found for this account | P0 | Yes |
| SEC-019 | Cross-account transcript deletion | User A tries DELETE transcript on canvas owned by B | 404, ownership check fails | P0 | Yes |
| SEC-020 | Collaborator role escalation | Viewer tries to update their own role to editor | 403, cannot modify own collaborator role | P1 | No |
| SEC-021 | Share link doesn't allow mutation | Use share code to attempt POST/PUT/DELETE on canvas data | 403 or 405, shares are read-only | P0 | Yes |

### 4.5 Security Misconfiguration (OWASP A05:2021)

| ID | Description | Steps | Expected Result | Priority | Automated |
|----|-------------|-------|-----------------|----------|-----------|
| SEC-022 | CORS restricts origins in production | Send request from unauthorized origin in production mode | CORS error, request blocked | P0 | No |
| SEC-023 | Security headers present | Inspect response headers | X-Content-Type-Options, X-Frame-Options, CSP headers set | P1 | Partial |
| SEC-024 | Debug endpoints disabled in production | Access any debug/test-only routes in production | 404 or not mounted | P1 | No |
| SEC-025 | Dependency vulnerabilities | Run `npm audit` | Zero critical/high vulnerabilities | P0 | Yes |

---

## 5. Performance Test Cases

| ID | Description | Test Method | Target | Priority | Automated |
|----|-------------|-------------|--------|----------|-----------|
| PERF-001 | Landing page load (cold) | Lighthouse / Playwright timing | First Contentful Paint < 1.5s | P0 | Partial |
| PERF-002 | Canvas page load (warm) | Measure from navigation to interactive | Time to Interactive < 2.0s | P0 | Partial |
| PERF-003 | Canvas detail API response | GET `/api/canvas/:id` with 10 transcripts, 50 codings | p95 < 300ms | P0 | Yes |
| PERF-004 | Canvas list API response | GET `/api/canvas` with 50 canvases | p95 < 200ms | P1 | Yes |
| PERF-005 | Text coding creation | POST `/api/canvas/:id/codings` | p95 < 150ms | P0 | Yes |
| PERF-006 | Layout save (50 nodes) | PUT `/api/canvas/:id/layout` with 50 positions | p95 < 500ms | P1 | Yes |
| PERF-007 | Large canvas rendering (100+ nodes) | Load canvas with 100 nodes, measure render time | Render < 3s, smooth pan/zoom at 30+ fps | P1 | No |
| PERF-008 | Search analysis on large transcript | Search node on 50K word transcript | Computation < 2s | P1 | Yes |
| PERF-009 | Word cloud computation | Word cloud on 50K words | Computation < 3s | P2 | Yes |
| PERF-010 | Concurrent users (10) | k6 load test: 10 virtual users performing mixed operations | p95 < 500ms, zero errors | P1 | No |
| PERF-011 | Concurrent users (50) | k6 load test: 50 virtual users | p95 < 1s, error rate < 1% | P2 | No |
| PERF-012 | Frontend bundle size | Measure production build output | Total JS bundle < 500KB gzipped | P1 | Yes |
| PERF-013 | Database query performance | EXPLAIN ANALYZE on critical queries | No full table scans on indexed columns | P1 | No |
| PERF-014 | WebSocket message latency | Measure cursor update round-trip | p95 < 100ms | P2 | No |
| PERF-015 | Memory leak check | Run app for 30 minutes with continuous operations | Heap growth < 50MB, no leaked event listeners | P1 | No |

---

## 6. Accessibility Test Cases

| ID | Description | Test Method | WCAG Criterion | Priority | Automated |
|----|-------------|-------------|----------------|----------|-----------|
| A11Y-001 | Keyboard navigation — login form | Tab through all form fields, submit with Enter | 2.1.1 Keyboard | P0 | Partial |
| A11Y-002 | Keyboard navigation — canvas workspace | Tab to nodes, use arrow keys for navigation | 2.1.1 Keyboard | P1 | No |
| A11Y-003 | Skip navigation link | Tab from page load, verify skip-to-content link | 2.4.1 Bypass Blocks | P2 | No |
| A11Y-004 | Focus visible on all interactive elements | Tab through app, verify focus ring visible | 2.4.7 Focus Visible | P1 | Partial |
| A11Y-005 | Screen reader — page landmarks | Run axe-core on all pages | 1.3.1 Info and Relationships | P1 | Partial |
| A11Y-006 | Screen reader — form labels | Run axe-core on login, register, canvas forms | 1.3.1 Info and Relationships | P1 | Partial |
| A11Y-007 | Color contrast — light mode | Run axe-core contrast check on all pages | 1.4.3 Contrast (Minimum) | P1 | Partial |
| A11Y-008 | Color contrast — dark mode | Run axe-core contrast check in dark mode | 1.4.3 Contrast (Minimum) | P1 | No |
| A11Y-009 | Image alt text | Verify all images and icons have alt text or aria-label | 1.1.1 Non-text Content | P1 | Partial |
| A11Y-010 | ARIA roles on canvas nodes | Verify ReactFlow nodes have appropriate ARIA roles | 4.1.2 Name, Role, Value | P2 | No |
| A11Y-011 | Error messages announced | Submit invalid form, verify error announced to screen reader | 3.3.1 Error Identification | P1 | No |
| A11Y-012 | Modal focus trap | Open any modal (share, export, command palette) | 2.4.3 Focus Order | P1 | Partial |
| A11Y-013 | Responsive text scaling | Set browser font size to 200% | Text reflows without horizontal scroll | 1.4.4 Resize Text | P2 | No |
| A11Y-014 | Motion preferences | Set prefers-reduced-motion | Animations disabled or reduced | 2.3.3 Animation from Interactions | P2 | No |
| A11Y-015 | Touch target size | Verify interactive elements on mobile | Touch targets >= 44x44px | 2.5.5 Target Size | P2 | No |

---

## 7. Compatibility Matrix

### 7.1 Browser Compatibility

| Browser | Versions | Support Level | Test Frequency |
|---------|----------|---------------|----------------|
| Chrome | Latest 2 (131+) | Full | Every release |
| Firefox | Latest 2 (133+) | Full | Every release |
| Safari | Latest 2 (17+) | Full | Every release |
| Edge | Latest 2 (131+) | Full | Every release |
| Chrome Mobile (Android) | Latest | Full | Major releases |
| Safari Mobile (iOS) | Latest 2 (17+) | Full | Major releases |
| Samsung Internet | Latest | Best effort | Quarterly |
| Opera | Latest | Best effort | Quarterly |

### 7.2 Screen Resolutions

| Category | Resolution | Breakpoint | Test Priority |
|----------|------------|------------|---------------|
| Desktop (Large) | 1920x1080 | >= 1280px | P0 |
| Desktop (Standard) | 1366x768 | >= 1024px | P0 |
| Desktop (Wide) | 2560x1440 | >= 1280px | P2 |
| Tablet (Landscape) | 1024x768 (iPad) | 768-1024px | P1 |
| Tablet (Portrait) | 768x1024 (iPad) | 768-1024px | P1 |
| Mobile (Large) | 414x896 (iPhone 11) | < 768px | P1 |
| Mobile (Standard) | 375x812 (iPhone X) | < 768px | P1 |
| Mobile (Small) | 360x640 (Android) | < 768px | P2 |

### 7.3 Operating Systems

| OS | Versions | Test Priority |
|----|----------|---------------|
| Windows | 10, 11 | P0 |
| macOS | Ventura (13), Sonoma (14), Sequoia (15) | P0 |
| Linux | Ubuntu 22.04+ | P1 |
| iOS | 17+, 18+ | P1 |
| Android | 13+, 14+ | P1 |
| ChromeOS | Latest | P3 |

### 7.4 Docker Compatibility

| Environment | Test |
|-------------|------|
| Docker Desktop (Windows) | Build and run docker-compose |
| Docker Desktop (macOS) | Build and run docker-compose |
| Docker Engine (Linux) | Build and run docker-compose |
| Docker Compose v2 | Multi-stage build, volume mounts, health checks |

---

## 8. Edge Case Catalog

### 8.1 Data Scale

| ID | Description | Steps | Expected Result | Priority |
|----|-------------|-------|-----------------|----------|
| EDGE-001 | 10,000 codings on single canvas | Create canvas with 10K codings via bulk insert | Canvas loads (may paginate), analysis nodes compute without timeout | P1 |
| EDGE-002 | 100 canvases per account | Create 100 canvases (Pro plan) | Canvas list loads and paginates correctly | P2 |
| EDGE-003 | 50K word transcript | Create transcript at maximum word limit | Transcript renders, coding overlay performs adequately | P1 |
| EDGE-004 | 500 codes on single canvas | Create 500 questions (Pro plan) | Question list renders, treemap handles large datasets | P2 |
| EDGE-005 | 100 nodes on canvas workspace | Place 100 nodes via layout | Canvas renders, pan/zoom functional at 30+ fps | P1 |

### 8.2 Network Failures

| ID | Description | Steps | Expected Result | Priority |
|----|-------------|-------|-----------------|----------|
| EDGE-006 | Network disconnect during save | Sever network while saving coding | Error notification shown, coding queued for retry or user prompted | P0 |
| EDGE-007 | Network disconnect during file upload | Sever network mid-upload | Upload fails gracefully, partial file cleaned up | P1 |
| EDGE-008 | Slow 3G connection | Throttle to 400kbps | App functional, loading indicators shown, no timeouts under 30s | P2 |
| EDGE-009 | API timeout (30s) | Backend response delayed beyond 30s | Frontend shows timeout error, no hung spinner | P1 |
| EDGE-010 | WebSocket reconnection | Kill and restart WebSocket connection | Client auto-reconnects, presence restored | P1 |

### 8.3 Concurrent Operations

| ID | Description | Steps | Expected Result | Priority |
|----|-------------|-------|-----------------|----------|
| EDGE-011 | Simultaneous coding by two users | Two users code same text segment concurrently | Both codings created (no conflict), or last-write-wins with notification | P1 |
| EDGE-012 | Simultaneous canvas deletion and edit | User A deletes canvas while User B edits | User B gets 404 on next save, informed canvas was deleted | P1 |
| EDGE-013 | Race condition on plan limit | Two requests simultaneously reach canvas limit | At most one succeeds, database constraint prevents over-limit | P0 |
| EDGE-014 | Duplicate form submission | Double-click submit on registration | Only one account created (server-side dedup or idempotency) | P1 |

### 8.4 Plan Limit Boundaries

| ID | Description | Steps | Expected Result | Priority |
|----|-------------|-------|-----------------|----------|
| EDGE-015 | Exactly at canvas limit | Free user with exactly 1 canvas tries to create another | Clear error message, not off-by-one | P0 |
| EDGE-016 | Exactly at transcript word limit | Free user pastes exactly 5000 words | Accepted (limit is inclusive) | P1 |
| EDGE-017 | 5001 words | Free user pastes 5001 words | Rejected with clear word count feedback | P1 |
| EDGE-018 | Downgrade with excess canvases | Pro user with 5 canvases downgrades to Free | Existing canvases preserved, creation blocked until under limit | P0 |
| EDGE-019 | Downgrade with excess codes | Pro user with 20 codes downgrades | Existing codes preserved, creation blocked | P1 |
| EDGE-020 | Downgrade mid-analysis | User downgrades while cluster analysis is in progress | Analysis completes or fails gracefully, node type marked unavailable | P2 |

### 8.5 Auth Edge Cases

| ID | Description | Steps | Expected Result | Priority |
|----|-------------|-------|-----------------|----------|
| EDGE-021 | Token expires during long edit session | JWT expires while user is editing transcript | Next API call returns 401, session-expired banner shown, unsaved work preserved locally | P0 |
| EDGE-022 | Multiple browser tabs | Open app in 3 tabs, perform actions in each | State consistent across tabs (via polling or storage events) | P1 |
| EDGE-023 | Login on two devices simultaneously | Login on laptop and phone | Both sessions valid, data consistent | P1 |
| EDGE-024 | Account deletion while logged in on another device | Delete account on device A | Device B receives 401 on next request, redirected to login | P1 |

### 8.6 Malformed Data

| ID | Description | Steps | Expected Result | Priority |
|----|-------------|-------|-----------------|----------|
| EDGE-025 | Invalid UTF-8 in transcript | POST transcript with invalid byte sequences | 400 validation error or bytes sanitized, no DB corruption | P1 |
| EDGE-026 | Oversized request body | POST 10MB JSON payload | 413 Payload Too Large, server not crashed | P0 |
| EDGE-027 | Corrupt QDPX import file | Import binary garbage as QDPX | 400, parse error with user-friendly message | P1 |
| EDGE-028 | Extremely long field values | 100K character canvas name | 400, validation error with max length specified | P1 |
| EDGE-029 | Null bytes in strings | Include \0 in transcript content | Handled safely, no truncation or crash | P2 |
| EDGE-030 | Empty request body | POST to creation endpoints with empty body | 400, validation error listing required fields | P1 |

---

## 9. Regression Suite

These test cases correspond to specific bugs that were fixed and must not recur.

| ID | Bug Description | Original Symptom | Regression Test | Priority | Automated |
|----|----------------|-----------------|-----------------|----------|-----------|
| REG-001 | Scroll zoom snap-back | Canvas viewport snapped back to original zoom level after wheel event ended | Verify zoom level persists 2s after scroll stops; no requestAnimationFrame revert | P0 | Yes |
| REG-002 | Node position reset on re-render | Dragging a node then triggering re-render (e.g., toggling sidebar) reset node to its initial position | Drag node, toggle sidebar, verify position unchanged | P0 | Yes |
| REG-003 | Layout save spam | Every pixel of drag sent a layout save API call, causing hundreds of requests | Verify layout save is debounced (1 API call per drag operation, not per pixel) | P0 | Yes |
| REG-004 | Sidebar overlap on small screens | Sidebar panel overlapped canvas content on screens < 1400px wide | Resize to 1366x768, verify sidebar pushes or overlays without covering content | P1 | Yes |
| REG-005 | DOM nesting warning (button in button) | React console warning about nested `<button>` elements in node headers | Verify no DOM nesting violations in rendered canvas nodes | P1 | Yes |
| REG-006 | Tab duplication | Clicking canvas tab rapidly created duplicate tab entries in tab bar | Click same tab 5 times rapidly, verify only 1 tab exists | P1 | Yes |
| REG-007 | Coding highlight misalignment | After editing transcript text, existing coding highlights shifted to wrong positions | Edit transcript, verify all coding highlights still align with correct text | P0 | Partial |
| REG-008 | Dark mode contrast on analysis nodes | Analysis node results were unreadable in dark mode (dark text on dark background) | Toggle dark mode, verify all analysis node text has sufficient contrast | P1 | Partial |
| REG-009 | Share modal close on backdrop click | Clicking modal backdrop didn't close the share modal | Click backdrop, verify modal closes | P1 | Yes |
| REG-010 | Empty canvas crash | Opening a canvas with zero transcripts/codes caused React error boundary | Load empty canvas, verify workspace renders without error | P0 | Yes |
| REG-011 | Case deletion orphans transcripts | Deleting a case left transcript.caseId pointing to deleted record | Delete case, verify transcripts have caseId set to null | P1 | Yes |
| REG-012 | Concurrent layout save race condition | Two rapid layout saves could result in stale positions overwriting newer ones | Save layout, immediately modify and save again, verify final positions correct | P1 | Partial |
| REG-013 | Unicode in code names breaks analysis | Code names with emoji or CJK characters caused analysis computation errors | Create code with emoji name, run stats analysis, verify no crash | P1 | Yes |
| REG-014 | Auto-code regex catastrophic backtracking | Certain regex patterns caused CPU hang | Run auto-code with known backtracking pattern (e.g., `(a+)+$`), verify timeout not exceeding 5s | P0 | Yes |
| REG-015 | Webhook replay creates duplicate subscriptions | Replayed Stripe webhook created second subscription record | Send same webhook event ID twice, verify only one subscription exists | P0 | Yes |

---

## 10. Test Data Requirements

### 10.1 User Personas

| Persona | Plan | Auth Method | Key Attributes |
|---------|------|-------------|----------------|
| free_researcher | Free | Email/password | 1 canvas, 2 transcripts, 5 codes, limited analysis |
| pro_researcher | Pro | Email/password | Unlimited canvases, AI enabled, ethics, shares |
| team_owner | Team | Email/password | Team owner, unlimited shares, intercoder |
| team_member | Team | Email/password | Team member (editor role) |
| team_viewer | Team | Email/password | Team member (viewer role) |
| legacy_user | Pro (grandfathered) | Access code | Dashboard access code, no email, linked account option |
| admin_user | Pro | Email/password | Role: admin (for dashboard access) |
| unverified_user | Free | Email/password | emailVerified: false |
| academic_user | Pro | Email/password (.edu) | Academic discount, .edu email |
| expired_user | Free | Email/password | Subscription canceled, downgraded from Pro |

### 10.2 Canvas Fixtures

| Fixture | Contents | Use Case |
|---------|----------|----------|
| empty_canvas | 0 transcripts, 0 codes, 0 codings | Empty state testing, REG-010 |
| small_canvas | 1 transcript (500 words), 3 codes, 10 codings | Basic functionality testing |
| medium_canvas | 5 transcripts (5K words total), 10 codes, 100 codings, 3 computed nodes | Integration testing |
| large_canvas | 20 transcripts (40K words total), 50 codes, 1000 codings, 10 computed nodes | Performance testing |
| max_free_canvas | 2 transcripts (5K words each), 5 codes | Plan limit boundary testing |
| shared_canvas | Small canvas with 2 active share links | Share/collaboration testing |
| ethics_canvas | Medium canvas with consent records and ethics metadata | Ethics testing |
| case_canvas | 3 cases, 6 transcripts (2 per case), 15 codes | Case-based analysis testing |
| multilingual_canvas | Transcripts in English, Spanish, and French | i18n and encoding testing |
| rich_canvas | All entity types present (memos, cases, relations, documents, training docs) | Full feature regression |

### 10.3 Seed Command

```bash
npm run db:seed
```

Creates:
- Demo dashboard access with code `CANVAS-DEMO2025`
- Sample canvas "Research Canvas" with 2 transcripts, 5 codes, and sample codings
- Default computed nodes (stats, wordcloud)
- No user accounts (created via registration in tests)

### 10.4 Test Data Cleanup

- **Unit tests:** Each test uses isolated mocks or in-memory state.
- **Integration tests:** Transaction rollback or `prisma.$transaction` wrapping.
- **E2E tests:** Dedicated test database, full cleanup between suites via `prisma.codingCanvas.deleteMany()` chain.

---

## 11. Release Criteria

### 11.1 Test Pass Rates

| Priority | Required Pass Rate | Current | Target |
|----------|-------------------|---------|--------|
| P0 (Critical) | 100% | 100% | 100% |
| P1 (High) | 95%+ | 93% | 95%+ |
| P2 (Medium) | 80%+ | N/A | 80%+ |
| P3 (Low) | Best effort | N/A | 70%+ |

### 11.2 Coverage Requirements

| Metric | Target |
|--------|--------|
| Backend unit test line coverage | >= 80% |
| Frontend unit test line coverage | >= 60% |
| E2E critical path coverage | 100% of P0 journeys |
| API endpoint coverage | >= 90% of routes tested |

### 11.3 Security Gates

- Zero critical vulnerabilities in `npm audit`
- Zero high-severity vulnerabilities unfixed for > 7 days
- All OWASP Top 10 categories tested
- Stripe webhook signature validation verified
- No sensitive data in API responses (passwords, API keys, tokens)
- CORS configured correctly for production origin

### 11.4 Performance Gates

- First Contentful Paint < 1.5s (desktop, 4G)
- Time to Interactive < 2.0s (desktop, 4G)
- API p95 response time < 500ms for all CRUD endpoints
- Canvas renders 100 nodes without dropping below 30fps
- Production JS bundle < 500KB gzipped
- No memory leaks detected in 30-minute session

### 11.5 Accessibility Gates

- Zero WCAG 2.1 AA violations detected by axe-core
- All forms keyboard-navigable
- All modals have focus trap
- Color contrast ratio >= 4.5:1 for normal text, >= 3:1 for large text

### 11.6 Operational Readiness

- Docker build succeeds and container starts cleanly
- Health check endpoint responds within 5s of container start
- Database migrations run without error on fresh PostgreSQL
- Seed script completes without error
- All environment variables documented and validated at startup
- Logging captures structured JSON with request IDs

---

## 12. Risk Register

| ID | Risk | Likelihood | Impact | Mitigation | Detection |
|----|------|-----------|--------|------------|-----------|
| RISK-001 | Data loss from cascade delete bug | Medium | Critical | Soft-delete by default, daily DB backups, cascade-delete integration tests (Journey 4) | Audit log monitoring, backup verification tests |
| RISK-002 | Stripe payment processing failure | Low | Critical | Webhook retry logic, idempotency keys, manual reconciliation procedure, webhook signature validation | Stripe dashboard alerts, webhook failure monitoring, BILL-007/BILL-008 tests |
| RISK-003 | AI API outage (OpenAI/Anthropic/Google) | Medium | High | Graceful degradation (AI features unavailable, rest of app works), multi-provider fallback, user notification | Health check pinging AI endpoints, AI-008 error handling, timeout monitoring |
| RISK-004 | Security breach — unauthorized data access | Low | Critical | JWT validation on every request, ownership checks, rate limiting, input validation (Zod schemas), audit logging | SEC-017 through SEC-021 automated tests, audit log review, penetration testing |
| RISK-005 | Performance degradation under load | Medium | High | Database indexing, query optimization, connection pooling, CDN for static assets, caching | PERF-010/011 load tests, APM monitoring, database slow query log |
| RISK-006 | Regex denial of service (ReDoS) | Medium | Medium | Regex timeout (5s limit), input length limits, pattern complexity validation | REG-014 automated test, CPU monitoring, auto-code timeout enforcement |
| RISK-007 | Plan limit bypass via race condition | Low | High | Database-level unique constraints, optimistic locking, transaction isolation | EDGE-013 test, audit log monitoring for anomalous resource counts |
| RISK-008 | Data corruption from concurrent WebSocket edits | Medium | High | Last-write-wins with conflict notification, operational transforms (future), WebSocket event ordering | EDGE-011/012 tests, data integrity checks in nightly jobs |
| RISK-009 | Third-party dependency vulnerability | High | Medium | Weekly `npm audit`, Dependabot alerts, pinned dependency versions, automated security scanning in CI | SEC-025 automated check, GitHub security alerts, quarterly dependency review |
| RISK-010 | Deployment failure (Docker/migration) | Low | High | Multi-stage Docker build tested in CI, migration dry-run on staging, rollback procedure documented, health check endpoint | Docker build in CI pipeline, staging deployment smoke test, health check monitoring |

---

## Appendix A: Test ID Summary

| Area | ID Range | Count |
|------|----------|-------|
| Authentication | AUTH-001 to AUTH-025 | 25 |
| Canvas Management | CANVAS-001 to CANVAS-020 | 20 |
| Transcripts | TRANS-001 to TRANS-015 | 15 |
| Coding | CODE-001 to CODE-025 | 25 |
| Analysis Nodes | ANALYSIS-001 to ANALYSIS-020 | 20 |
| AI Features | AI-001 to AI-015 | 15 |
| Collaboration | COLLAB-001 to COLLAB-015 | 15 |
| Billing | BILL-001 to BILL-015 | 15 |
| Ethics & Compliance | ETHICS-001 to ETHICS-010 | 10 |
| Import/Export | EXPORT-001 to EXPORT-010 | 10 |
| Canvas Workspace UX | UX-001 to UX-025 | 25 |
| Navigation & Pages | NAV-001 to NAV-015 | 15 |
| Teams | TEAM-001 to TEAM-010 | 10 |
| Documents & Uploads | DOC-001 to DOC-010 | 10 |
| Research Assistant | CHAT-001 to CHAT-010 | 10 |
| Internationalization | I18N-001 to I18N-005 | 5 |
| Training Center | TRAIN-001 to TRAIN-005 | 5 |
| Research Repository | REPO-001 to REPO-005 | 5 |
| Integrations | INTEG-001 to INTEG-005 | 5 |
| Security | SEC-001 to SEC-025 | 25 |
| Performance | PERF-001 to PERF-015 | 15 |
| Accessibility | A11Y-001 to A11Y-015 | 15 |
| Edge Cases | EDGE-001 to EDGE-030 | 30 |
| Regression | REG-001 to REG-015 | 15 |
| Integration Journeys | Journey 1-15 | 15 |
| **Total** | | **420 cases + 15 journeys** |

## Appendix B: Automation Roadmap

| Phase | Timeline | Scope | Test Count |
|-------|----------|-------|------------|
| Phase 1 (Current) | Complete | Backend unit tests, basic E2E | 335 |
| Phase 2 | Sprint 1-2 | P0 security tests, billing webhook tests, plan limit E2E | +50 |
| Phase 3 | Sprint 3-4 | Frontend component tests (RTL), accessibility (axe-core) | +60 |
| Phase 4 | Sprint 5-6 | Performance baselines (k6), AI feature stubs, collaboration | +40 |
| Phase 5 | Sprint 7-8 | Edge cases, regression suite, cross-browser Playwright | +55 |
| **Target** | 8 sprints | Full automation coverage | **540+** |

---

*Document generated: 2026-03-23. Review cycle: Update after each sprint. Owner: QA Engineering.*
