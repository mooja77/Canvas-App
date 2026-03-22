# Canvas App — Master Test Plan

**Version:** 1.0
**Date:** 2026-03-22
**Classification:** Pre-Release QA
**App:** Canvas App — Qualitative Coding Platform
**Stack:** React 18 + Vite / Express + Prisma + PostgreSQL / Stripe / LLM APIs

---

## 1. Overview

This document defines the complete test strategy for the Canvas App before shipping. It covers every user-facing feature, API endpoint, data model, and integration point. Tests are organized by type (unit, integration, E2E, performance, security) and prioritized by risk.

**Current coverage:** 208 tests (117 backend unit, 63 frontend unit, 28 E2E)
**Target coverage:** 500+ tests across all categories

---

## 2. Test Infrastructure

| Layer | Tool | Config |
|-------|------|--------|
| Backend Unit | Vitest | `apps/backend/vitest.config.ts` |
| Frontend Unit | Vitest + RTL + jsdom | `apps/frontend/vitest.config.ts` |
| E2E | Playwright Test | `playwright.config.ts` |
| API Integration | Vitest + Supertest | In-process Express |
| Load Testing | k6 or Artillery | TBD |
| Security Scanning | npm audit + custom | TBD |

**Commands:**
- `npm test` — Unit tests (180, ~3s)
- `npm run test:e2e` — E2E browser tests (28, ~2min)
- `npm run typecheck` — TypeScript compilation check

---

## 3. Test Categories

### 3.1 Unit Tests

#### 3.1.1 Backend Route Handlers

Each route tested for: success path, validation errors, auth failures, plan limit enforcement, ownership checks.

**Authentication (20 tests)**

| Test ID | Route | Test Case | Priority |
|---------|-------|-----------|----------|
| AUTH-001 | POST /api/auth | Valid access code returns JWT | P0 |
| AUTH-002 | POST /api/auth | Invalid code returns 401 | P0 |
| AUTH-003 | POST /api/auth | Rate limited after 10 attempts | P1 |
| AUTH-004 | POST /api/auth/signup | Valid email/password creates user | P0 |
| AUTH-005 | POST /api/auth/signup | Duplicate email returns 409 | P0 |
| AUTH-006 | POST /api/auth/signup | Password < 8 chars returns 400 | P0 |
| AUTH-007 | POST /api/auth/email-login | Valid credentials return JWT with plan | P0 |
| AUTH-008 | POST /api/auth/email-login | Wrong password returns 401 | P0 |
| AUTH-009 | POST /api/auth/google | Valid credential creates/logs in user | P1 |
| AUTH-010 | POST /api/auth/forgot-password | Sends reset email (or logs in dev) | P1 |
| AUTH-011 | POST /api/auth/forgot-password | Non-existent email returns same message | P0 |
| AUTH-012 | POST /api/auth/reset-password | Valid token resets password | P0 |
| AUTH-013 | POST /api/auth/reset-password | Expired token returns 400 | P0 |
| AUTH-014 | GET /api/auth/me | Returns user profile for email auth | P0 |
| AUTH-015 | GET /api/auth/me | Returns profile for legacy auth | P0 |
| AUTH-016 | POST /api/auth/link-account | Links legacy to email user | P1 |
| AUTH-017 | PUT /api/auth/profile | Updates name/email | P1 |
| AUTH-018 | PUT /api/auth/change-password | Changes password with verification | P1 |
| AUTH-019 | DELETE /api/auth/account | Deletes user + cancels Stripe | P1 |
| AUTH-020 | ALL auth routes | CSRF token required on mutations | P0 |

**Canvas CRUD (15 tests)**

| Test ID | Route | Test Case | Priority |
|---------|-------|-----------|----------|
| CANVAS-001 | GET /canvas | Lists owned canvases (email auth) | P0 |
| CANVAS-002 | GET /canvas | Lists owned canvases (legacy auth) | P0 |
| CANVAS-003 | GET /canvas | Does not leak other users' canvases | P0 |
| CANVAS-004 | POST /canvas | Creates canvas within plan limit | P0 |
| CANVAS-005 | POST /canvas | Rejects when at canvas limit (Free=1) | P0 |
| CANVAS-006 | GET /canvas/:id | Returns full canvas with all relations | P0 |
| CANVAS-007 | GET /canvas/:id | Returns 403 for non-owner | P0 |
| CANVAS-008 | PUT /canvas/:id | Updates name/description | P1 |
| CANVAS-009 | DELETE /canvas/:id | Deletes canvas + cascades | P1 |
| CANVAS-010 | PUT /canvas/:id/layout | Saves node positions (upsert) | P0 |
| CANVAS-011 | PUT /canvas/:id/layout | Validates position schema | P1 |
| CANVAS-012 | ALL canvas routes | Validates params with Zod | P1 |
| CANVAS-013 | ALL canvas routes | Returns 401 without auth token | P0 |
| CANVAS-014 | POST /canvas | Validates name length (1-200) | P1 |
| CANVAS-015 | GET /canvas/:id | safeJsonParse handles corrupted data | P1 |

**Transcript Operations (12 tests)**

| Test ID | Route | Test Case | Priority |
|---------|-------|-----------|----------|
| TRANS-001 | POST /canvas/:id/transcripts | Creates transcript | P0 |
| TRANS-002 | POST /canvas/:id/transcripts | Enforces transcript limit per canvas | P0 |
| TRANS-003 | POST /canvas/:id/transcripts | Enforces word limit | P0 |
| TRANS-004 | PUT /canvas/:id/transcripts/:tid | Updates title/content | P0 |
| TRANS-005 | DELETE /canvas/:id/transcripts/:tid | Deletes + cascades codings | P0 |
| TRANS-006 | POST /canvas/:id/import-narratives | Bulk import (1-100) | P1 |
| TRANS-007 | POST /canvas/:id/import-narratives | Rejects > 100 narratives | P1 |
| TRANS-008 | POST /canvas/:id/import-from-canvas | Copies from owned canvas | P1 |
| TRANS-009 | POST /canvas/:id/import-from-canvas | Rejects from non-owned canvas | P1 |
| TRANS-010 | POST /canvas/:id/transcripts | Validates title (1-200 chars) | P1 |
| TRANS-011 | POST /canvas/:id/transcripts | Validates content (non-empty) | P1 |
| TRANS-012 | ALL transcript routes | Param validation on :id and :tid | P1 |

**Coding Operations (18 tests)**

| Test ID | Route | Test Case | Priority |
|---------|-------|-----------|----------|
| CODE-001 | POST /canvas/:id/questions | Creates question/code | P0 |
| CODE-002 | POST /canvas/:id/questions | Enforces code limit (Free=5) | P0 |
| CODE-003 | PUT /canvas/:id/questions/:qid | Updates text/color/parent | P0 |
| CODE-004 | DELETE /canvas/:id/questions/:qid | Deletes + cascades codings | P0 |
| CODE-005 | POST /canvas/:id/questions/merge | Merges source into target | P1 |
| CODE-006 | POST /canvas/:id/codings | Creates text coding | P0 |
| CODE-007 | POST /canvas/:id/codings | Validates offsets (start < end) | P0 |
| CODE-008 | DELETE /canvas/:id/codings/:cid | Deletes coding | P0 |
| CODE-009 | PUT /canvas/:id/codings/:cid/reassign | Reassigns to new question | P1 |
| CODE-010 | POST /canvas/:id/memos | Creates memo | P0 |
| CODE-011 | PUT /canvas/:id/memos/:mid | Updates memo content | P0 |
| CODE-012 | DELETE /canvas/:id/memos/:mid | Deletes memo | P0 |
| CODE-013 | POST /canvas/:id/cases | Creates case | P1 |
| CODE-014 | PUT /canvas/:id/cases/:caseId | Updates case attributes | P1 |
| CODE-015 | DELETE /canvas/:id/cases/:caseId | Deletes case, nulls transcript refs | P1 |
| CODE-016 | POST /canvas/:id/relations | Creates cross-reference | P1 |
| CODE-017 | DELETE /canvas/:id/relations/:relId | Deletes relation | P1 |
| CODE-018 | POST /canvas/:id/codings | Audit log created on coding | P2 |

**Analysis/Computed Nodes (15 tests)**

| Test ID | Route | Test Case | Priority |
|---------|-------|-----------|----------|
| COMP-001 | POST /canvas/:id/computed | Creates computed node | P0 |
| COMP-002 | POST /canvas/:id/computed | Validates nodeType enum | P0 |
| COMP-003 | POST /canvas/:id/computed/:nodeId/run | Executes search analysis | P0 |
| COMP-004 | POST /canvas/:id/computed/:nodeId/run | Executes cooccurrence | P1 |
| COMP-005 | POST /canvas/:id/computed/:nodeId/run | Executes stats | P1 |
| COMP-006 | POST /canvas/:id/computed/:nodeId/run | Executes wordcloud | P1 |
| COMP-007 | POST /canvas/:id/computed/:nodeId/run | Executes sentiment | P1 |
| COMP-008 | POST /canvas/:id/computed/:nodeId/run | Executes matrix | P1 |
| COMP-009 | POST /canvas/:id/computed/:nodeId/run | Executes comparison | P1 |
| COMP-010 | POST /canvas/:id/computed/:nodeId/run | Executes cluster | P1 |
| COMP-011 | POST /canvas/:id/computed/:nodeId/run | Executes codingquery | P1 |
| COMP-012 | POST /canvas/:id/computed/:nodeId/run | Plan limit on Free (stats+wordcloud only) | P0 |
| COMP-013 | POST /canvas/:id/computed/:nodeId/run | Rate limited (30 per 15min) | P1 |
| COMP-014 | PUT /canvas/:id/computed/:nodeId | Updates config | P1 |
| COMP-015 | DELETE /canvas/:id/computed/:nodeId | Deletes node | P1 |

**Sharing & Cloning (10 tests)**

| Test ID | Route | Test Case | Priority |
|---------|-------|-----------|----------|
| SHARE-001 | POST /canvas/:id/share | Creates share code | P0 |
| SHARE-002 | POST /canvas/:id/share | Enforces share limit (Free=0) | P0 |
| SHARE-003 | GET /canvas/:id/shares | Lists shares for canvas | P1 |
| SHARE-004 | DELETE /canvas/:id/share/:shareId | Deletes share | P1 |
| SHARE-005 | POST /canvas/clone/:code | Clones canvas from valid code | P0 |
| SHARE-006 | POST /canvas/clone/:code | Rejects expired share code | P0 |
| SHARE-007 | POST /canvas/clone/:code | Enforces plan limits on cloned content | P0 |
| SHARE-008 | GET /canvas/shared/:code | Returns canvas data (public) | P0 |
| SHARE-009 | GET /canvas/shared/:code | Returns 404 for invalid code | P0 |
| SHARE-010 | POST /canvas/clone/:code | Increments clone count | P2 |

**Billing (12 tests)**

| Test ID | Route | Test Case | Priority |
|---------|-------|-----------|----------|
| BILL-001 | POST /api/billing/create-checkout | Creates Stripe checkout session | P0 |
| BILL-002 | POST /api/billing/create-checkout | Auto-applies .edu coupon | P1 |
| BILL-003 | POST /api/billing/create-portal | Creates customer portal session | P1 |
| BILL-004 | GET /api/billing/subscription | Returns subscription details | P1 |
| BILL-005 | POST /api/billing/webhook | checkout.session.completed → creates subscription | P0 |
| BILL-006 | POST /api/billing/webhook | subscription.updated → updates plan | P0 |
| BILL-007 | POST /api/billing/webhook | subscription.deleted → downgrades to free | P0 |
| BILL-008 | POST /api/billing/webhook | invoice.payment_failed → marks past_due | P0 |
| BILL-009 | POST /api/billing/webhook | Validates Stripe signature | P0 |
| BILL-010 | POST /api/billing/webhook | Rejects invalid signature | P0 |
| BILL-011 | POST /api/billing/webhook | Idempotent (duplicate event ignored) | P1 |
| BILL-012 | ALL billing routes | Requires auth (except webhook) | P0 |

**Ethics & Compliance (8 tests)**

| Test ID | Route | Test Case | Priority |
|---------|-------|-----------|----------|
| ETHICS-001 | GET /canvas/:id/ethics | Returns ethics settings | P1 |
| ETHICS-002 | GET /canvas/:id/ethics | Free plan returns 403 | P0 |
| ETHICS-003 | PUT /canvas/:id/ethics | Updates approval status | P1 |
| ETHICS-004 | POST /canvas/:id/consent | Records consent | P1 |
| ETHICS-005 | PUT /canvas/:id/consent/:id/withdraw | Withdraws consent | P1 |
| ETHICS-006 | PUT /canvas/:id/transcripts/:tid/anonymize | Anonymizes with replacements | P1 |
| ETHICS-007 | PUT /canvas/:id/transcripts/:tid/anonymize | Validates replacement array (1-500) | P1 |
| ETHICS-008 | ALL ethics routes | Audit log created | P2 |

**AI Features (10 tests)**

| Test ID | Route | Test Case | Priority |
|---------|-------|-----------|----------|
| AI-001 | POST /canvas/:id/ai/suggest-codes | Returns code suggestions | P1 |
| AI-002 | POST /canvas/:id/ai/suggest-codes | Free plan returns 403 | P0 |
| AI-003 | POST /canvas/:id/ai/suggest-codes | No AI config returns 400 | P0 |
| AI-004 | POST /canvas/:id/ai/auto-code-transcript | Auto-codes transcript | P1 |
| AI-005 | POST /canvas/:id/ai/auto-code-transcript | Truncates > 30K chars | P2 |
| AI-006 | POST /canvas/:id/ai/summarize | Generates summary | P1 |
| AI-007 | PUT /ai-settings | Saves encrypted API key | P1 |
| AI-008 | PUT /ai-settings | Validates with test call | P1 |
| AI-009 | GET /ai-settings | Never returns API key | P0 |
| AI-010 | DELETE /ai-settings | Removes config | P1 |

#### 3.1.2 Frontend Stores

| Test ID | Store | Test Case | Priority |
|---------|-------|-----------|----------|
| STORE-001 | authStore | Initial state unauthenticated | P0 |
| STORE-002 | authStore | setAuth sets legacy auth | P0 |
| STORE-003 | authStore | setEmailAuth sets email auth | P0 |
| STORE-004 | authStore | logout clears all state | P0 |
| STORE-005 | authStore | updatePlan changes plan | P0 |
| STORE-006 | canvasStore | Initial state empty | P0 |
| STORE-007 | canvasStore | setPendingSelection/clear | P0 |
| STORE-008 | canvasStore | setSelectedQuestionId | P0 |
| STORE-009 | canvasStore | toggleCodingStripes | P0 |
| STORE-010 | canvasStore | Selector hooks return correct slices | P0 |
| STORE-011 | uiStore | darkMode detects system preference | P1 |
| STORE-012 | uiStore | toggleDarkMode + DOM class | P0 |
| STORE-013 | uiStore | scrollMode persists | P1 |
| STORE-014 | uiStore | zoomTier not persisted | P1 |
| STORE-015 | uiStore | edgeStyle changes | P1 |

#### 3.1.3 Frontend Hooks

| Test ID | Hook | Test Case | Priority |
|---------|------|-----------|----------|
| HOOK-001 | useCanvasKeyboard | Ignores keys in INPUT elements | P0 |
| HOOK-002 | useCanvasKeyboard | Ignores keys in contentEditable | P0 |
| HOOK-003 | useCanvasKeyboard | Ctrl+K toggles command palette | P0 |
| HOOK-004 | useCanvasKeyboard | Ctrl+Z calls onUndo | P0 |
| HOOK-005 | useCanvasKeyboard | Ctrl+M calls onToggleMute | P0 |
| HOOK-006 | useCanvasKeyboard | F key calls fitView | P0 |
| HOOK-007 | useCanvasKeyboard | Delete calls handleDelete | P0 |
| HOOK-008 | useCanvasKeyboard | Escape dismisses in priority order | P0 |
| HOOK-009 | useCanvasHistory | pushState adds to timeline | P0 |
| HOOK-010 | useCanvasHistory | undo returns previous state | P0 |
| HOOK-011 | useCanvasHistory | redo returns next state | P0 |
| HOOK-012 | useCanvasHistory | Max 50 entries (oldest discarded) | P1 |
| HOOK-013 | useCanvasHistory | clearHistory resets | P1 |
| HOOK-014 | useCanvasHistory | Debounces rapid pushes (300ms) | P2 |

#### 3.1.4 Backend Utilities

| Test ID | Utility | Test Case | Priority |
|---------|---------|-----------|----------|
| UTIL-001 | textAnalysis | searchTranscripts keyword mode | P0 |
| UTIL-002 | textAnalysis | searchTranscripts regex mode | P0 |
| UTIL-003 | textAnalysis | computeCooccurrence | P1 |
| UTIL-004 | textAnalysis | computeStats | P1 |
| UTIL-005 | textAnalysis | computeWordFrequency | P1 |
| UTIL-006 | textAnalysis | computeSentiment | P1 |
| UTIL-007 | textAnalysis | computeClusters | P1 |
| UTIL-008 | textAnalysis | computeCodingQuery | P1 |
| UTIL-009 | textAnalysis | buildFrameworkMatrix | P1 |
| UTIL-010 | textAnalysis | computeComparison | P1 |
| UTIL-011 | textAnalysis | computeTreemap | P2 |
| UTIL-012 | textAnalysis | computeTimeline | P2 |
| UTIL-013 | safeJsonParse | Returns parsed JSON | P0 |
| UTIL-014 | safeJsonParse | Returns fallback on invalid JSON | P0 |
| UTIL-015 | encryption | Encrypt/decrypt API key roundtrip | P0 |
| UTIL-016 | jwt | Sign and verify token | P0 |
| UTIL-017 | jwt | Reject expired token | P0 |

---

### 3.2 Integration Tests

**Full-Flow User Journeys**

| Test ID | Journey | Steps | Priority |
|---------|---------|-------|----------|
| INT-001 | New User Onboarding | Signup → create canvas → add transcript → code text → view analysis | P0 |
| INT-002 | Returning User | Login → open canvas → see existing codings → add new code | P0 |
| INT-003 | Plan Upgrade | Free user → hits limit → Stripe checkout → webhook → pro features unlocked | P0 |
| INT-004 | Plan Downgrade | Pro user → cancel → webhook → free limits enforced, data preserved | P0 |
| INT-005 | Legacy Migration | Access code login → link email → verify dual auth works | P1 |
| INT-006 | Canvas Sharing | Create canvas → share → colleague clones → both see codings | P0 |
| INT-007 | Ethics Workflow | Set approval → record consent → anonymize transcript → verify audit log | P1 |
| INT-008 | AI Coding | Configure API key → AI suggest codes → accept suggestion → verify coding created | P1 |
| INT-009 | Auto-Code | Select question → set pattern → auto-code all transcripts → verify codings | P1 |
| INT-010 | Import/Export | Create canvas → add content → export QDPX → import to new canvas → verify parity | P1 |
| INT-011 | Password Reset | Forgot password → email sent → click link → reset → login with new password | P1 |
| INT-012 | Account Deletion | Delete account → verify Stripe canceled → verify data deleted → verify login fails | P1 |

**Cross-Feature Interactions**

| Test ID | Interaction | Test Case | Priority |
|---------|------------|-----------|----------|
| CROSS-001 | Coding + Analysis | Create codings → run stats → verify counts match | P0 |
| CROSS-002 | Case + Matrix | Assign transcripts to cases → run matrix → verify case×code grid | P1 |
| CROSS-003 | Hierarchy + Treemap | Create parent/child codes → run treemap → verify hierarchy | P1 |
| CROSS-004 | Merge + Codings | Merge two codes → verify codings reassigned | P1 |
| CROSS-005 | Delete + Cascade | Delete transcript → verify codings deleted → verify analysis updated | P0 |
| CROSS-006 | Share + Plan Limits | Free user clones Pro canvas → content truncated to free limits | P0 |

---

### 3.3 E2E Browser Tests

**Canvas Workspace (existing: 28 tests)**

| Test ID | Feature | Test Case | Status |
|---------|---------|-----------|--------|
| E2E-001 | Canvas load | Nodes and edges render | PASS |
| E2E-002 | Scroll zoom in | mouse.wheel(-300) increases scale | PASS |
| E2E-003 | Scroll zoom out | mouse.wheel(300) decreases scale | PASS |
| E2E-004 | Zoom stability | Zoom doesn't snap back after 2s | PASS |
| E2E-005 | Zoom In button | Click increases scale | PASS |
| E2E-006 | Fit View button | Click resets viewport | PASS |
| E2E-007 | Node drag | Position preserved after data sync | PASS |
| E2E-008 | Console errors | Zero errors on canvas load | PASS |
| E2E-009 | Scroll mode toggle | Zoom ↔ Pan toggle works | PASS |
| E2E-010 | Session expired | Banner shows on /login?expired=true | PASS |
| E2E-011 | Undo (Ctrl+Z) | Toast + position restored after drag | PASS |
| E2E-012 | Mute (Ctrl+M) | Node muted + unmuted with badge | PASS |
| E2E-013 | Context menu (node) | Right-click shows options | PASS |
| E2E-014 | Context menu (canvas) | Right-click empty area shows menu | PASS |
| E2E-015 | Collapse node | Button collapses node | PASS |
| E2E-016 | Shortcuts modal | ? key opens, shows Undo/Redo/Mute | PASS |
| E2E-017 | Command palette | Ctrl+K opens search | PASS |
| E2E-018 | Multi-zoom cycle | In/in/out without snap-back | PASS |
| E2E-019 | Pan mode | Scroll pans (not zooms) in pan mode | PASS |
| E2E-020 | Selection | Click shows "1 selected" | PASS |
| E2E-021 | Select all | Ctrl+A shows "N selected" | PASS |
| E2E-022 | Tab preview | Hover tab shows tooltip | PASS |
| E2E-023 | Minimap | Minimap visible | PASS |
| E2E-024 | Status bar | Shows stats + zoom % | PASS |
| E2E-025 | Deep link | /canvas/:id opens canvas | PASS |
| E2E-026 | Stripes toggle | Button toggles stripes | PASS |
| E2E-027 | Edge style | Dropdown changes style | PASS |
| E2E-028 | Auth setup | Login saves state for tests | PASS |

**Additional E2E Tests Needed**

| Test ID | Feature | Test Case | Priority |
|---------|---------|-----------|----------|
| E2E-029 | Node resize | Drag handle changes node size | P0 |
| E2E-030 | Alt+Drag | Alt+drag duplicates node | P1 |
| E2E-031 | Auto-arrange | Arrange button rearranges nodes | P0 |
| E2E-032 | Sub-code prompt | Add Sub-Code shows name prompt | P1 |
| E2E-033 | Code navigation | Click code in sidebar focuses node | P0 |
| E2E-034 | Detail panel | View coded segments shows panel below toolbar | P0 |
| E2E-035 | Snap to grid | G key toggles grid, nodes snap | P1 |
| E2E-036 | Viewport bookmarks | Ctrl+Shift+1 saves, Alt+1 recalls | P1 |
| E2E-037 | Focus mode | Ctrl+. hides sidebar/toolbar | P1 |
| E2E-038 | Dark mode | Toggle preserves across reload | P1 |
| E2E-039 | Transcript text | Full text visible at 35%+ zoom | P0 |
| E2E-040 | Canvas list | Search/sort/filter canvases | P1 |
| E2E-041 | New canvas | Create canvas with template | P1 |
| E2E-042 | Delete canvas | Delete with confirmation | P1 |
| E2E-043 | Multi-tab | Open multiple canvases, switch tabs | P1 |
| E2E-044 | Computed node run | Run word cloud, see results | P1 |
| E2E-045 | Text coding | Select text → assign code → coding appears | P0 |

**Page Tests**

| Test ID | Page | Test Case | Priority |
|---------|------|-----------|----------|
| E2E-050 | Landing | All sections render, CTA buttons work | P1 |
| E2E-051 | Pricing | Tier cards render, monthly/annual toggle | P1 |
| E2E-052 | Login | Email tab, access code tab, form validation | P0 |
| E2E-053 | Forgot Password | Email input, submit, confirmation message | P1 |
| E2E-054 | Account | Profile section, usage stats, billing link | P1 |
| E2E-055 | 404 | Unknown route shows NotFoundPage | P1 |

---

### 3.4 Performance Tests

| Test ID | Scenario | Metric | Target | Priority |
|---------|----------|--------|--------|----------|
| PERF-001 | Canvas with 50 nodes | Initial render time | < 2s | P1 |
| PERF-002 | Canvas with 200 nodes | Scroll zoom FPS | > 30fps | P1 |
| PERF-003 | Canvas with 1000 codings | Load time | < 5s | P1 |
| PERF-004 | Text analysis (50K words) | Computation time | < 10s | P2 |
| PERF-005 | Layout save | API response time | < 500ms | P1 |
| PERF-006 | Canvas list (100 canvases) | Page load time | < 2s | P2 |
| PERF-007 | QDPX export (large canvas) | Generation time | < 30s | P2 |
| PERF-008 | Concurrent users (10) | API p95 latency | < 1s | P2 |
| PERF-009 | Frontend bundle | Initial load (gzipped) | < 500KB | P2 |
| PERF-010 | Memory leak check | 30min session | No growth > 50MB | P2 |

---

### 3.5 Security Tests

| Test ID | Category | Test Case | Priority |
|---------|----------|-----------|----------|
| SEC-001 | Auth | JWT token required on all /api routes (except public) | P0 |
| SEC-002 | Auth | Expired JWT returns 401 | P0 |
| SEC-003 | Auth | Tampered JWT returns 401 | P0 |
| SEC-004 | CSRF | State-changing requests require CSRF token | P0 |
| SEC-005 | CSRF | GET requests don't require CSRF | P0 |
| SEC-006 | Ownership | User A cannot access User B's canvas | P0 |
| SEC-007 | Ownership | User A cannot modify User B's transcripts | P0 |
| SEC-008 | Ownership | User A cannot delete User B's codings | P0 |
| SEC-009 | Rate Limit | Auth endpoints limited to 10/15min | P0 |
| SEC-010 | Rate Limit | Compute endpoints limited to 30/15min | P1 |
| SEC-011 | Rate Limit | General API limited to 500/15min | P1 |
| SEC-012 | Input | SQL injection attempts safely handled | P0 |
| SEC-013 | Input | XSS in transcript content sanitized | P0 |
| SEC-014 | Input | Path traversal in file uploads blocked | P0 |
| SEC-015 | Encryption | API keys encrypted at rest (AES-GCM) | P0 |
| SEC-016 | Encryption | API keys never returned in GET responses | P0 |
| SEC-017 | Passwords | Bcrypt with 12 rounds | P0 |
| SEC-018 | Passwords | Reset tokens expire after 1 hour | P0 |
| SEC-019 | Headers | Security headers set (Helmet) | P1 |
| SEC-020 | Headers | CORS restricted to allowed origins | P1 |

---

### 3.6 Accessibility Tests

| Test ID | Area | Test Case | Priority |
|---------|------|-----------|----------|
| A11Y-001 | Navigation | Skip-to-content link works | P1 |
| A11Y-002 | Navigation | All interactive elements keyboard-reachable | P1 |
| A11Y-003 | Aria | Buttons have accessible labels | P1 |
| A11Y-004 | Aria | Modals have role="dialog" | P1 |
| A11Y-005 | Aria | Form inputs have labels | P1 |
| A11Y-006 | Color | WCAG AA contrast on all text | P2 |
| A11Y-007 | Color | Dark mode maintains contrast | P2 |
| A11Y-008 | Screen Reader | Canvas nodes announced correctly | P2 |
| A11Y-009 | Focus | Modal focus trap works | P1 |
| A11Y-010 | Focus | Escape closes modals + returns focus | P1 |

---

## 4. Test Data

### Fixtures

**Users**
- Free user: `free@test.com` / `Test1234!` (1 canvas, 2 transcripts, 5 codes)
- Pro user: `pro@test.com` / `Test1234!` (unlimited)
- Team user: `team@test.com` / `Test1234!` (unlimited + collaboration)
- Legacy user: access code `CANVAS-DEMO2025` (grandfathered Pro)

**Canvases**
- Empty canvas (0 content)
- Small canvas (2 transcripts, 5 codes, 15 codings)
- Medium canvas (10 transcripts, 25 codes, 200 codings, 10 computed nodes)
- Large canvas (50 transcripts, 100 codes, 5000 codings)

### Seed Command
```bash
npm run db:seed
```

---

## 5. Environments

| Environment | URL | Database | Stripe | Purpose |
|------------|-----|----------|--------|---------|
| Local Dev | localhost:5174 | SQLite | Test keys | Developer testing |
| CI | GitHub Actions | SQLite (memory) | Mock | Automated on PR |
| Staging | staging.app.com | PostgreSQL | Test keys | Pre-release QA |
| Production | app.com | PostgreSQL | Live keys | Post-deploy smoke |

---

## 6. Release Criteria

### Must Pass Before Ship
- [ ] All P0 tests pass (100%)
- [ ] All P1 tests pass (>95%)
- [ ] Zero console errors on all pages
- [ ] TypeScript compilation: 0 errors
- [ ] ESLint: 0 errors (warnings acceptable)
- [ ] No critical or high security vulnerabilities (npm audit)
- [ ] Performance targets met (P1 scenarios)
- [ ] Smoke test on staging environment passes

### Acceptable Deferrals
- P2 tests (nice-to-have, can ship without)
- Performance optimization for edge cases (1000+ nodes)
- Full accessibility audit (WCAG AAA)
- i18n testing

---

## 7. Test Execution Schedule

| Phase | When | What | Duration |
|-------|------|------|----------|
| Unit tests | Every commit (CI) | `npm test` | ~3s |
| E2E tests | Every PR (CI) | `npm run test:e2e` | ~2min |
| Integration tests | Nightly (CI) | Full integration suite | ~10min |
| Performance tests | Weekly | Load scenarios | ~30min |
| Security scan | Weekly | npm audit + custom | ~5min |
| Manual QA | Pre-release | Exploratory testing | ~2hr |
| Staging smoke | Pre-deploy | Critical paths | ~15min |

---

## 8. Bug Severity Classification

| Level | Definition | Response | Example |
|-------|-----------|----------|---------|
| **S0 Critical** | App unusable, data loss | Fix immediately, hotfix deploy | Cannot login, data corruption |
| **S1 Major** | Feature broken, no workaround | Fix before next release | Cannot create codings, export fails |
| **S2 Minor** | Feature degraded, workaround exists | Schedule for next sprint | Tooltip misaligned, slow load |
| **S3 Cosmetic** | Visual only, no functional impact | Backlog | Font size, spacing |

---

## 9. Appendix: Risk Matrix

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Data loss on canvas delete | Low | Critical | Cascade delete tests, soft-delete planned |
| Stripe webhook missed | Medium | High | Idempotency, event replay, monitoring |
| AI API key leaked | Low | Critical | AES encryption, never in GET responses |
| Rate limiter bypass | Low | High | Per-IP + per-user limiting, auth on all routes |
| XSS in transcript content | Medium | High | React auto-escaping, CSP headers |
| Session hijacking | Low | Critical | HTTPS, HttpOnly cookies, short JWT expiry |
| Large canvas performance | High | Medium | React.memo, Zustand selectors, pagination planned |
| Concurrent edit conflicts | Medium | Medium | Last-write-wins (WebSocket sync planned) |
