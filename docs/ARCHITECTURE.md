# QualCanvas Architecture

## 1. System Overview

QualCanvas is a SaaS qualitative coding canvas for researchers, built as a monorepo with an Express + Prisma + PostgreSQL backend, a React 18 + Vite frontend, and a shared types package. The system supports real-time collaboration via WebSockets, Stripe billing with Free/Pro/Team tiers, AI-assisted coding (OpenAI, Anthropic, Google), file uploads to S3, and QDPX interoperability.

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloudflare DNS                          │
│                   qualcanvas.com                            │
└──────────┬──────────────────────────────┬───────────────────┘
           │                              │
           ▼                              ▼
┌─────────────────────┐      ┌─────────────────────────────┐
│   Vercel (Frontend)  │      │   Railway (Backend)          │
│   Static SPA (Vite)  │─────▶│   Express + Socket.IO        │
│   Port 5174 (dev)    │ API  │   Port 3007                  │
│                      │proxy │                              │
│  React 18            │      │  ┌──────────┐ ┌───────────┐ │
│  React Flow          │      │  │ Prisma   │ │ Socket.IO │ │
│  Zustand             │      │  │ ORM      │ │ Server    │ │
│  Tailwind CSS        │      │  └────┬─────┘ └───────────┘ │
│  i18next             │      │       │                      │
└─────────────────────┘      │       ▼                      │
                              │  ┌──────────┐               │
                              │  │PostgreSQL│               │
                              │  │ 16       │               │
                              │  └──────────┘               │
                              └──────┬──────────────────────┘
                                     │
                        ┌────────────┼────────────┐
                        ▼            ▼            ▼
                   ┌─────────┐ ┌─────────┐ ┌──────────┐
                   │ Stripe  │ │ AWS S3  │ │ AI APIs  │
                   │ Billing │ │ Storage │ │ OpenAI   │
                   │         │ │         │ │ Anthropic│
                   │         │ │         │ │ Google   │
                   └─────────┘ └─────────┘ └──────────┘
```

---

## 2. Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Runtime | Node.js | 20 (Alpine in Docker) |
| Language | TypeScript | ^5.7.0 |
| Frontend Framework | React | ^18.3.1 |
| Build Tool | Vite | ^6.0.7 |
| CSS | Tailwind CSS | ^3.4.17 |
| Canvas Library | @xyflow/react (React Flow) | ^12.10.1 |
| State Management | Zustand | ^5.0.3 |
| Routing (Frontend) | react-router-dom | ^7.1.1 |
| Charts | Recharts | ^2.15.0 |
| Word Cloud | @visx/wordcloud + @visx/text | ^3.12.0 |
| i18n | i18next + react-i18next | ^25.10.4 / ^16.6.1 |
| HTTP Client | Axios | ^1.7.9 |
| Error Tracking | @sentry/react | ^10.45.0 |
| UI Components | @headlessui/react + @heroicons/react | ^2.2.0 |
| Graph Layout | dagre | ^0.8.5 |
| PWA | vite-plugin-pwa | ^0.21.1 |
| Backend Framework | Express | ^4.21.2 |
| ORM | Prisma | ^6.3.0 |
| Database | PostgreSQL (prod) / SQLite (dev) | 16+ |
| WebSocket | Socket.IO | ^4.8.3 |
| Auth | jsonwebtoken + bcryptjs | ^9.0.3 / ^3.0.3 |
| Validation | Zod | ^3.24.1 |
| Security | helmet | ^8.0.0 |
| Rate Limiting | express-rate-limit | ^7.5.0 |
| Payments | Stripe | ^20.4.1 |
| AI - OpenAI | openai | ^6.32.0 |
| AI - Anthropic | @anthropic-ai/sdk | ^0.80.0 |
| AI - Google | @google/generative-ai | ^0.24.1 |
| File Upload | multer | ^2.1.1 |
| Object Storage | @aws-sdk/client-s3 | ^3.1012.0 |
| Email | nodemailer | ^8.0.3 |
| XML Parsing | fast-xml-parser | ^5.5.7 |
| Archive | archiver + yauzl | ^7.0.1 / ^3.2.1 |
| Logging | morgan | ^1.10.0 |
| Google Auth | google-auth-library | ^10.6.2 |
| Test Runner | Vitest | ^4.0.18 |
| E2E Testing | Playwright | ^1.58.2 |
| Linter | ESLint | ^9.39.3 |
| Concurrency | concurrently | ^9.1.0 |

---

## 3. Monorepo Structure

```
qualcanvas/
├── apps/
│   ├── backend/
│   │   ├── prisma/
│   │   │   ├── schema.prisma          # 34 models, PostgreSQL provider
│   │   │   ├── migrations/            # Prisma migration files
│   │   │   └── seed.ts                # Demo data seeder
│   │   ├── src/
│   │   │   ├── index.ts               # Express app entry, middleware stack
│   │   │   ├── config/
│   │   │   │   └── plans.ts           # Free/Pro/Team plan limits
│   │   │   ├── lib/
│   │   │   │   ├── prisma.ts          # Prisma client singleton
│   │   │   │   ├── socket.ts          # Socket.IO server init + events
│   │   │   │   └── presence.ts        # In-memory presence tracking
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts            # Dual JWT auth (email + legacy)
│   │   │   │   ├── auditLog.ts        # Request audit logging
│   │   │   │   ├── csrf.ts            # CSRF via Origin header validation
│   │   │   │   ├── errorHandler.ts    # Global error handler (AppError)
│   │   │   │   ├── planLimits.ts      # Plan enforcement middleware factories
│   │   │   │   └── validation.ts      # Zod schema validation middleware
│   │   │   ├── routes/                # 21 route modules
│   │   │   └── utils/
│   │   │       ├── textAnalysis.ts    # Analysis engine (~766 lines)
│   │   │       ├── routeHelpers.ts    # getAuthId, getAuthUserId, getOwnedCanvas
│   │   │       ├── jwt.ts            # Token sign/verify helpers
│   │   │       └── hashing.ts        # SHA-256, bcrypt utilities
│   │   ├── scripts/
│   │   │   └── backup.sh             # DB backup script
│   │   ├── package.json
│   │   └── tsconfig.json
│   └── frontend/
│       ├── src/
│       │   ├── main.tsx               # React entry + i18n init
│       │   ├── App.tsx                # Route definitions
│       │   ├── components/
│       │   │   ├── canvas/            # Canvas workspace + node components
│       │   │   ├── ErrorBoundary.tsx
│       │   │   ├── UpgradePrompt.tsx
│       │   │   ├── OfflineBanner.tsx
│       │   │   └── LoadingSkeleton.tsx
│       │   ├── hooks/                 # 15+ custom hooks
│       │   ├── stores/                # Zustand stores (4 stores)
│       │   ├── services/
│       │   │   └── api.ts             # Axios API client
│       │   ├── lib/
│       │   │   ├── socket.ts          # Socket.IO client
│       │   │   └── offlineStorage.ts  # IndexedDB canvas cache
│       │   ├── pages/                 # Route page components
│       │   └── i18n/                  # en, es, fr, de translations
│       ├── vite.config.ts
│       ├── tailwind.config.js
│       └── package.json
├── shared/
│   ├── types/
│   │   └── canvas.types.ts            # ~370 lines of shared interfaces
│   └── package.json
├── e2e/                               # Playwright E2E tests
├── docs/
│   ├── API.md                         # REST API reference
│   ├── DEPLOY.md                      # Deployment guide
│   └── ARCHITECTURE.md                # This file
├── .github/workflows/ci.yml           # GitHub Actions CI
├── Dockerfile                         # Multi-stage Docker build (Node 20 Alpine)
├── docker-compose.yml                 # PostgreSQL 16 + app services
├── vercel.json                        # Vercel frontend config + API rewrites
├── playwright.config.ts               # E2E test configuration
├── tsconfig.base.json                 # Shared TypeScript config
├── CLAUDE.md                          # Project instructions
└── package.json                       # Root workspace config
```

Workspaces defined in root `package.json`:
- `shared` — shared TypeScript types (`@qualcanvas/shared`)
- `apps/frontend` — Vite React SPA (`@qualcanvas/frontend`)
- `apps/backend` — Express API server (`@qualcanvas/backend`)

---

## 4. Backend Architecture

### 4.1 Entry Point and Middleware Stack

The middleware stack in `apps/backend/src/index.ts` is applied in this order:

| Order | Middleware | Purpose |
|-------|-----------|---------|
| 1 | `trust proxy` | Railway/Vercel reverse proxy support |
| 2 | `helmet` | Security headers (CSP, HSTS, X-Frame-Options) |
| 3 | `cors` | CORS with configurable `ALLOWED_ORIGINS` |
| 4 | `morgan` | HTTP request logging (`combined` prod, `dev` local) |
| 5 | `express.raw` | Raw body for `/api/billing/webhook` (Stripe signature) |
| 6 | `express.json` | JSON body parsing (1MB default) |
| 7 | Request counter | Increments counter for `/metrics` endpoint |
| 8 | `csrfProtection` | Origin/Referer/Sec-Fetch-Site validation on mutations |
| 9 | `generalLimiter` | 500 req/15min on `/api/*` (skipped in test/E2E) |
| 10 | `computeLimiter` | 30 req/15min on computed node `/run` endpoints |
| 11 | `express.json(10mb)` | Larger body limit for transcript/import routes |
| 12 | Request timeout | 30-second timeout per request |
| 13 | Route handlers | Versioned API router (`/api/v1` + `/api`) |
| 14 | Static files | Production-only: serves frontend build |
| 15 | `errorHandler` | Global error handler (AppError class) |

### 4.2 Route Modules

All routes are mounted under `/api/v1` and `/api` (backwards compat).

| File | Prefix | Auth | Audit | Purpose |
|------|--------|------|-------|---------|
| `authRoutes.ts` | `/auth` | No | No | Legacy access-code login/register |
| `userAuthRoutes.ts` | `/auth` | Mixed | No | Email signup/login, password reset, profile, Google OAuth |
| `billingRoutes.ts` | `/billing` | Mixed | No | Stripe checkout/portal/subscription/webhook |
| `canvasRoutes.ts` | `/canvas` | Yes | Yes | Canvas CRUD, main orchestration |
| `transcriptRoutes.ts` | `/canvas/:id/transcripts` | Yes | Yes | Transcript CRUD, import, anonymize |
| `codingRoutes.ts` | `/canvas/:id/codings` | Yes | Yes | Text coding CRUD, reassign, auto-code |
| `computedRoutes.ts` | `/canvas/:id/computed` | Yes | Yes | Analysis node CRUD + run |
| `shareRoutes.ts` | `/canvas/:id/share` | Yes | Yes | Share code generation, public viewing, cloning |
| `ethicsRoutes.ts` | `/canvas/:id/ethics` | Yes | Yes | Ethics settings, consent records, audit log |
| `aiRoutes.ts` | `/canvas/:id/ai` | Yes | Yes | AI code suggestions, auto-coding |
| `aiSettingsRoutes.ts` | `/ai-settings` | Yes | No | User AI config (API key storage) |
| `chatRoutes.ts` | `/canvas/:id/chat` | Yes | Yes | Research assistant (RAG chat) |
| `summaryRoutes.ts` | `/canvas/:id/summaries` | Yes | Yes | AI text summarization |
| `uploadRoutes.ts` | `/canvas/:id/uploads` | Yes | Yes | File upload, audio transcription |
| `collaborationRoutes.ts` | `/canvas/:id/collaborators` | Yes | Yes | Collaborator invites, roles |
| `documentRoutes.ts` | `/canvas/:id/documents` | Yes | Yes | Document (PDF/image) + region coding |
| `trainingRoutes.ts` | `/canvas/:id/training` | Yes | Yes | Intercoder training exercises |
| `qdpxRoutes.ts` | `/canvas/:id/qdpx` | Yes | Yes | QDPX export/import (interop) |
| `repositoryRoutes.ts` | `/repositories` | Yes | Yes | Research insight repository |
| `integrationRoutes.ts` | `/integrations` | Yes | Yes | Third-party integrations (Zoom, Slack, Qualtrics) |
| `teamRoutes.ts` | `/teams` | Yes | Yes | Team management, member roles |

Public (unauthenticated) routes:
- `GET /health` — DB health check
- `GET /ready` — Readiness probe with version/uptime
- `GET /metrics` — Basic request count + memory metrics
- `GET /canvas/shared/:code` — Public shared canvas viewing

### 4.3 Database Schema (34 Models)

```
┌──────────────────┐       ┌───────────────────┐
│      User        │       │  DashboardAccess   │
│──────────────────│       │───────────────────│
│ id (PK)          │◄──┐   │ id (PK)            │
│ email (unique)   │   │   │ accessCode (unique)│
│ passwordHash     │   │   │ name               │
│ name, role, plan │   │   │ role               │
│ stripeCustomerId │   └───│ userId (FK, opt)   │
├──────────────────┤       └────────┬──────────┘
│ subscription     │                │
│ dashboardAccess  │                │
│ repositories     │                │
│ integrations     │                │
│ aiConfig         │                │
│ ownedTeams       │                │
│ teamMemberships  │                │
└──────────────────┘                │
         │                          │
         ▼                          ▼
┌────────────────────────────────────────────┐
│              CodingCanvas                   │
│────────────────────────────────────────────│
│ id (PK)                                    │
│ dashboardAccessId (FK)                     │
│ userId (FK, optional)                      │
│ name, description                          │
│ ethicsStatus, deletedAt (soft delete)      │
├────────────────────────────────────────────┤
│ Has many:                                  │
│  ├── transcripts    (CanvasTranscript)      │
│  ├── questions      (CanvasQuestion)       │
│  ├── codings        (CanvasTextCoding)     │
│  ├── memos          (CanvasMemo)           │
│  ├── cases          (CanvasCase)           │
│  ├── relations      (CanvasRelation)       │
│  ├── computedNodes  (CanvasComputedNode)   │
│  ├── nodePositions  (CanvasNodePosition)   │
│  ├── shares         (CanvasShare)          │
│  ├── consentRecords (ConsentRecord)        │
│  ├── collaborators  (CanvasCollaborator)   │
│  ├── documents      (CanvasDocument)       │
│  ├── fileUploads    (FileUpload)           │
│  ├── textEmbeddings (TextEmbedding)        │
│  ├── chatMessages   (ChatMessage)          │
│  ├── summaries      (Summary)             │
│  ├── aiSuggestions  (AiSuggestion)         │
│  └── trainingDocs   (TrainingDocument)     │
└────────────────────────────────────────────┘

Key relationships:
  CanvasTranscript ──< CanvasTextCoding >── CanvasQuestion
  CanvasQuestion ──< CanvasQuestion (self-ref hierarchy via parentQuestionId)
  CanvasTranscript >── CanvasCase (optional grouping)
  CanvasDocument ──< DocumentRegionCoding
  TrainingDocument ──< TrainingAttempt
  FileUpload ──< TranscriptionJob
  User ──< Subscription (1:1)
  User ──< UserAiConfig (1:1, encrypted API keys)
  User ──< Team (owner) ──< TeamMember
  User ──< ResearchRepository ──< RepositoryInsight
  User ──< Integration (per-provider)

Standalone:
  AuditLog          — action/resource audit trail
  WebhookEvent      — Stripe webhook deduplication
  AiUsage           — token/cost tracking per request
```

### 4.4 Auth System (Dual Auth)

```
┌─────────────────────────────────────────────────────┐
│                    auth middleware                    │
│  Checks: Authorization: Bearer <jwt>                │
│      OR: x-dashboard-code: <jwt>                    │
└──────────────┬──────────────────────┬───────────────┘
               │                      │
               ▼                      ▼
   ┌───────────────────┐   ┌───────────────────────┐
   │  Email Auth (JWT)  │   │  Legacy Auth (JWT)     │
   │───────────────────│   │───────────────────────│
   │ payload: {         │   │ payload: {             │
   │   userId,          │   │   accountId,           │
   │   role,            │   │   role                 │
   │   plan             │   │ }                      │
   │ }                  │   │                        │
   │                    │   │ Resolves via            │
   │ Resolves via       │   │ DashboardAccess table  │
   │ User table         │   │                        │
   │                    │   │ Grandfathered to Pro   │
   │ Sets: req.userId   │   │                        │
   │       req.userPlan │   │ Sets: req.dashboardId  │
   │       X-User-Plan  │   │       req.userPlan=pro │
   └───────────────────┘   └───────────────────────┘
```

Legacy access-code users can link their account to an email via `POST /auth/link-account`.

### 4.5 Plan Tiers and Limits

| Limit | Free | Pro ($12/mo) | Team ($29/mo/seat) |
|-------|------|-------------|-------------------|
| Canvases | 1 | Unlimited | Unlimited |
| Transcripts/canvas | 2 | Unlimited | Unlimited |
| Words/transcript | 5,000 | 50,000 | 50,000 |
| Codes | 5 | Unlimited | Unlimited |
| Auto-code | No | Yes | Yes |
| Analysis types | stats, wordcloud | All 13 types | All 13 types |
| Export formats | CSV | CSV, PNG, HTML, MD, QDPX | CSV, PNG, HTML, MD, QDPX |
| Share codes | 0 | 5 | Unlimited |
| Ethics panel | No | Yes | Yes |
| Cases | No | Yes | Yes |
| Intercoder (Kappa) | No | No | Yes |
| AI features | No | Yes (1000 req/day) | Yes (1000 req/day) |
| File uploads | No | Yes | Yes |
| Storage | 0 MB | 500 MB | 5,000 MB |
| Transcription | 0 min/mo | 60 min/mo | 300 min/mo |
| Collaborators | 0 | 3 | Unlimited |
| Repository | No | Yes | Yes |
| Integrations | No | No | Yes |

Analysis types (13): `search`, `cooccurrence`, `matrix`, `stats`, `comparison`, `wordcloud`, `cluster`, `codingquery`, `sentiment`, `treemap`, `documentportrait`, `timeline`, `geomap`.

Academic discount: 40% off for `.edu` emails via Stripe coupon.

---

## 5. Frontend Architecture

### 5.1 Routes

| Path | Component | Protected | Lazy | Description |
|------|-----------|-----------|------|-------------|
| `/` | `LandingPage` | No | No | Public marketing page |
| `/login` | `LoginPage` | No | No | Email login (primary) + access code (collapsible) |
| `/pricing` | `PricingPage` | No | No | Tier comparison, monthly/annual toggle |
| `/account` | `AccountPage` | Yes | Yes | Profile, plan, usage, billing portal |
| `/canvas/:canvasId?` | `CanvasPage` | Yes | Yes | Main canvas workspace (deep linking) |
| `/repository` | `RepositoryPage` | Yes | Yes | Research insight repository |
| `/team` | `TeamPage` | Yes | Yes | Team management |
| `/forgot-password` | `ForgotPasswordPage` | No | No | Password reset request |
| `/reset-password` | `ResetPasswordPage` | No | No | Password reset with token |
| `/verify-email` | `VerifyEmailPage` | No | No | Email verification |
| `/terms` | `TermsPage` | No | No | Terms of service |
| `/privacy` | `PrivacyPage` | No | No | Privacy policy |
| `/guide` | `GuidePage` | No | No | User guide |
| `*` | `NotFoundPage` | No | No | 404 fallback |

Global components rendered on all routes: `ErrorBoundary`, `OfflineBanner`, `UpgradePrompt`.

### 5.2 State Management (Zustand Stores)

| Store | File | Persisted | Purpose |
|-------|------|-----------|---------|
| `authStore` | `stores/authStore.ts` | Yes (localStorage) | JWT, user profile, plan, dual auth state |
| `uiStore` | `stores/uiStore.ts` | Yes (localStorage) | Dark mode, onboarding, sidebar, edge style, scroll mode, zoom tier |
| `canvasStore` | `stores/canvasStore.ts` | No | Canvas list, active canvas, CRUD operations, text selection, layout |
| `shortcutStore` | `stores/shortcutStore.ts` | Yes (localStorage) | Customizable keyboard shortcuts |

Components use granular Zustand selector hooks (migrated in commit `95c0449`).

### 5.3 Custom Hooks

| Hook | File | Purpose |
|------|------|---------|
| `useCanvasHistory` | `hooks/useCanvasHistory.ts` | Undo/redo stack for canvas operations |
| `useCanvasKeyboard` | `hooks/useCanvasKeyboard.ts` | Keyboard shortcut handling |
| `useMobile` | `hooks/useMobile.ts` | Touch gesture support (pinch, pan, tap) |
| `useAutoLayout` | `hooks/useAutoLayout.ts` | Dagre-based automatic node layout |
| `useCollaboration` | `hooks/useCollaboration.ts` | WebSocket collaboration + presence |
| `useFileUpload` | `hooks/useFileUpload.ts` | File upload with progress tracking |
| `useAiSuggestions` | `hooks/useAiSuggestions.ts` | AI coding suggestion management |
| `useCanvasBookmarks` | `hooks/useCanvasBookmarks.ts` | Canvas bookmark management |
| `useCanvasGroups` | `hooks/useCanvasGroups.ts` | Visual node grouping |
| `useCanvasStickyNotes` | `hooks/useCanvasStickyNotes.ts` | Sticky note CRUD |
| `useCanvasRerouteNodes` | `hooks/useCanvasRerouteNodes.ts` | Edge reroute waypoints |
| `useCodeBookmarks` | `hooks/useCodeBookmarks.ts` | Code bookmark management |
| `useContainerSize` | `hooks/useContainerSize.ts` | Responsive container dimensions |
| `useNodeColors` | `hooks/useNodeColors.ts` | Node color management |
| `useSessionTimeout` | `hooks/useSessionTimeout.ts` | Auto-logout on session expiry |
| `usePageMeta` | `hooks/usePageMeta.ts` | Dynamic page title/meta |

### 5.4 Canvas Node Types (21 Total)

Defined in `CanvasWorkspace.tsx`:

**Base nodes (7):**

| Type | Component | Description |
|------|-----------|-------------|
| `transcript` | `TranscriptNode` | Text transcript with coding highlights |
| `question` | `QuestionNode` | Research question / code (hierarchical) |
| `memo` | `MemoNode` | Research memo / annotation |
| `case` | `CaseNode` | Analytical case grouping |
| `group` | `GroupNode` | Visual grouping container |
| `sticky` | `StickyNoteNode` | Free-form sticky note |
| `reroute` | `RerouteNode` | Edge reroute waypoint |

**Computed nodes (14, wrapped with error boundary):**

| Type | Component | Description |
|------|-----------|-------------|
| `search` | `SearchResultNode` | Text search results |
| `cooccurrence` | `CooccurrenceNode` | Code co-occurrence analysis |
| `matrix` | `MatrixNode` | Code-by-document matrix |
| `stats` | `StatsNode` | Descriptive statistics |
| `comparison` | `ComparisonNode` | Cross-case comparison |
| `wordcloud` | `WordCloudNode` | Word frequency visualization |
| `cluster` | `ClusterNode` | Code clustering |
| `codingquery` | `CodingQueryNode` | Boolean coding queries |
| `sentiment` | `SentimentNode` | Sentiment analysis |
| `treemap` | `TreemapNode` | Hierarchical code treemap |
| `timeline` | `TimelineNode` | Temporal event timeline |
| `geomap` | `GeoMapNode` | Geographic data mapping |
| `document` | `DocumentNode` | PDF/image document viewer |
| `documentportrait` | `DocumentPortraitNode` | Document portrait visualization |

### 5.5 Build Configuration

Vite config (`apps/frontend/vite.config.ts`):
- **PWA**: Auto-update service worker, NetworkFirst API caching (5min TTL, 50 entries)
- **Path alias**: `@` maps to `./src`
- **Code splitting** (manual chunks):
  - `react-vendor`: react, react-dom, react-router-dom
  - `viz-vendor`: @xyflow/react, dagre, recharts
  - `visx-vendor`: @visx/wordcloud, @visx/text
- **Dev proxy**: `/api` requests forwarded to `http://localhost:3007`

---

## 6. Real-time Collaboration

WebSocket server is initialized in `apps/backend/src/lib/socket.ts` using Socket.IO, mounted on the same HTTP server as Express. Authentication uses JWT token from `socket.handshake.auth.token`.

### 6.1 WebSocket Events

| Direction | Event | Payload | Description |
|-----------|-------|---------|-------------|
| Client -> Server | `canvas:join` | `{ canvasId }` | Join a canvas room (auto-leaves previous rooms) |
| Client -> Server | `canvas:leave` | `{ canvasId }` | Leave a canvas room |
| Client -> Server | `node:move` | `{ canvasId, nodeId, x, y }` | Broadcast node position change |
| Client -> Server | `cursor:move` | `{ canvasId, x, y }` | Broadcast cursor position |
| Client -> Server | `canvas:change` | `{ canvasId, changeType, payload }` | Generic change event (legacy) |
| Client -> Server | `canvas:node-added` | `{ canvasId, data }` | New node added |
| Client -> Server | `canvas:node-deleted` | `{ canvasId, data: { nodeId, nodeType } }` | Node deleted |
| Client -> Server | `canvas:node-moved` | `{ canvasId, data: { nodeId, position } }` | Node repositioned |
| Client -> Server | `canvas:coding-added` | `{ canvasId, data }` | New coding created |
| Client -> Server | `canvas:coding-deleted` | `{ canvasId, data: { codingId } }` | Coding deleted |
| Client -> Server | `canvas:transcript-updated` | `{ canvasId, data: { transcriptId } }` | Transcript content changed |
| Server -> Client | `presence:updated` | `{ canvasId, users: PresenceEntry[] }` | Room presence changed |
| Server -> Client | `presence:current` | `{ canvasId, users, self }` | Initial presence on join |
| Server -> Client | `node:moved` | `{ userId, userName, nodeId, x, y }` | Another user moved a node |
| Server -> Client | `cursor:moved` | `{ userId, userName, x, y }` | Another user's cursor position |
| Server -> Client | `canvas:changed` | `{ userId, userName, changeType, payload }` | Generic change broadcast |
| Server -> Client | `canvas:node-added` | `{ userId, userName, data }` | Node added by another user |
| Server -> Client | `canvas:node-deleted` | `{ userId, userName, data }` | Node deleted by another user |
| Server -> Client | `canvas:coding-added` | `{ userId, userName, data }` | Coding added by another user |
| Server -> Client | `canvas:coding-deleted` | `{ userId, userName, data }` | Coding deleted by another user |
| Server -> Client | `canvas:transcript-updated` | `{ userId, userName, data }` | Transcript updated by another user |

### 6.2 Presence System

Implemented in `apps/backend/src/lib/presence.ts` as an in-memory `Map<canvasId, Map<userId, PresenceEntry>>`.

```typescript
interface PresenceEntry {
  userId: string;
  name: string;
  color: string;        // Assigned from 10-color palette
  cursor?: { x: number; y: number };
  joinedAt: number;
}
```

- Users are assigned deterministic colors based on join order (10-color palette).
- Cursor positions are updated in real-time.
- On disconnect, users are removed from all rooms and presence is broadcast.
- Room maps are cleaned up when the last user leaves.

---

## 7. External Integrations

### 7.1 Stripe Billing Flow

```
User clicks "Upgrade"
        │
        ▼
POST /billing/create-checkout  ──►  Stripe Checkout Session
        │                                     │
        ▼                                     ▼
  Redirect to Stripe  ──────►  Payment completed
                                              │
                                              ▼
                              Stripe webhook: checkout.session.completed
                                              │
                                              ▼
                              Backend updates User.plan + creates Subscription
                                              │
                                              ▼
                              X-User-Plan header syncs to frontend
```

Webhook events handled:
- `checkout.session.completed` — Activate subscription
- `customer.subscription.updated` — Plan changes, cancellations
- `customer.subscription.deleted` — Subscription ended
- `invoice.payment_succeeded` — Payment confirmation
- `invoice.payment_failed` — Payment failure

Webhook deduplication via `WebhookEvent` table (Stripe event ID as primary key).

### 7.2 AI / LLM Providers

Three providers supported, configurable per-user via `UserAiConfig`:

| Provider | SDK | Features |
|----------|-----|----------|
| OpenAI | `openai` ^6.32.0 | Code suggestions, auto-coding, summarization, chat, embeddings |
| Anthropic | `@anthropic-ai/sdk` ^0.80.0 | Code suggestions, auto-coding, summarization, chat |
| Google | `@google/generative-ai` ^0.24.1 | Code suggestions, auto-coding, summarization |

Usage tracked per-request in `AiUsage` table (input/output tokens, cost).

### 7.3 Storage

- **S3** (`@aws-sdk/client-s3`): File uploads (audio, documents, images)
- **Pre-signed URLs** (`@aws-sdk/s3-request-presigner`): Secure direct client uploads/downloads
- **Local fallback**: Development mode can use local filesystem

### 7.4 Email

- **nodemailer** with SMTP transport (configurable host/port/auth)
- Used for: email verification, password reset links, notifications
- If SMTP is not configured, reset links are logged to console (development mode)
- Recommended production provider: Resend.com

### 7.5 Third-Party Integrations (Team plan)

Stored in `Integration` model with OAuth tokens:
- **Zoom** — Meeting recording import
- **Slack** — Notifications
- **Qualtrics** — Survey data import

---

## 8. Security

### 8.1 Authentication

| Mechanism | Details |
|-----------|---------|
| JWT tokens | Signed with `JWT_SECRET`, sent via `Authorization: Bearer` or `x-dashboard-code` header |
| Password hashing | bcryptjs (cost factor default) |
| Google OAuth | `google-auth-library` for token verification |
| Session timeout | 30-minute inactivity timeout (communicated via `X-Session-Timeout` header) |

### 8.2 CORS

- Production: Only `ALLOWED_ORIGINS` (comma-separated) are permitted
- Development: `http://localhost:5174` and `http://localhost:3007`
- Credentials: enabled

### 8.3 CSRF Protection

Origin-based validation on mutation methods (`POST`, `PUT`, `PATCH`, `DELETE`):
1. Check `Origin` header against allowed origins
2. Fall back to `Sec-Fetch-Site: same-origin/same-site`
3. Fall back to `Referer` header origin check
4. Reject if none match

### 8.4 Content Security Policy (Helmet)

```
default-src: 'self'
script-src:  'self', https://accounts.google.com
style-src:   'self', 'unsafe-inline'
img-src:     'self', data:
connect-src: 'self', https://accounts.google.com
font-src:    'self'
frame-src:   'self', https://accounts.google.com
worker-src:  'self', blob:
child-src:   'self', blob:
```

HSTS enabled in production: `max-age=31536000; includeSubDomains`.

### 8.5 Rate Limiting

| Scope | Limit | Window |
|-------|-------|--------|
| General API (`/api/*`) | 500 requests | 15 minutes |
| Compute endpoints (`/computed/:nid/run`) | 30 requests | 15 minutes |

Both limits are disabled when `NODE_ENV=test` or `E2E_TEST=true`.

### 8.6 API Key Encryption

User AI API keys (`UserAiConfig`) are encrypted at rest using AES-256-GCM:
- `apiKeyEncrypted` — ciphertext
- `apiKeyIv` — initialization vector
- `apiKeyTag` — authentication tag
- Encryption key from `ENCRYPTION_KEY` env var (32-byte hex)

### 8.7 Input Validation

- Zod schemas applied via `validate()` and `validateParams()` middleware
- 24+ validation schemas in `apps/backend/src/middleware/validation.ts`
- Body size limits: 1MB default, 10MB for transcript/import routes
- Request timeout: 30 seconds

### 8.8 Additional

- Soft delete for canvases (recoverable via trash)
- Audit logging on all protected routes via `auditLog` middleware
- Webhook signature verification for Stripe events
- Non-root user in Docker (`USER node`)

---

## 9. Build & Deploy

### 9.1 Docker Multi-Stage Build

The `Dockerfile` uses 5 stages on Node 20 Alpine:

| Stage | Purpose |
|-------|---------|
| `deps` | Install all dependencies (`npm ci --ignore-scripts`) |
| `build-shared` | Compile shared types package |
| `build-frontend` | Build Vite frontend (static assets) |
| `build-backend` | Build backend TypeScript + Prisma generate |
| `production` | Minimal image: production deps + compiled artifacts |

Production image features:
- `npm ci --omit=dev` for minimal node_modules
- Prisma client generated for production
- Runs as non-root `node` user
- Health check: `wget` to `/health` every 30s
- Startup: `prisma migrate deploy && node dist/index.js`

### 9.2 Docker Compose

Services:
- `db`: PostgreSQL 16 Alpine (port 5432, persistent volume `pgdata`)
- `app`: Built from Dockerfile (port 3007, depends on `db`)

### 9.3 Production Deployment

| Component | Platform | URL |
|-----------|----------|-----|
| Frontend | Vercel | qualcanvas.com |
| Backend | Railway | canvas-app-production.up.railway.app |
| DNS | Cloudflare | qualcanvas.com |
| Database | Railway PostgreSQL | Internal connection string |

**Vercel configuration** (`vercel.json`):
- Build: `npm run build -w shared && npm run build -w apps/frontend`
- Output: `apps/frontend/dist`
- Rewrites: `/api/*` and `/health` proxied to Railway backend
- SPA fallback: `/(.*) -> /index.html`

### 9.4 CI/CD Pipeline

GitHub Actions workflow (`.github/workflows/ci.yml`):

```
push/PR to main
      │
      ▼
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│  Type Check   │────▶│  Unit Tests   │────▶│  E2E Tests   │
│  (tsc -b)     │     │  (vitest)     │     │  (Playwright) │
│               │     │  234 + 131    │     │  44 tests     │
│  ubuntu-latest│     │  SQLite test  │     │  Chromium     │
│  Node 20      │     │  DB           │     │  Artifacts on │
│               │     │               │     │  failure      │
└──────────────┘     └──────────────┘     └──────────────┘
```

All jobs use `ubuntu-latest` with Node 20 and npm caching. E2E test failures upload `test-results/` as artifacts (7-day retention).

---

## 10. Testing

### 10.1 Test Counts

| Layer | Framework | Count | Location |
|-------|-----------|-------|----------|
| Backend unit | Vitest | 234 | `apps/backend/src/**/*.test.ts` |
| Frontend unit | Vitest + Testing Library | 131 | `apps/frontend/src/**/*.test.ts` |
| E2E | Playwright | 44 | `e2e/` |
| **Total** | | **409** | |

### 10.2 Test Infrastructure

| Tool | Purpose |
|------|---------|
| Vitest ^4.0.18 | Unit test runner (backend + frontend) |
| @testing-library/react ^16.3.2 | React component testing |
| @testing-library/user-event ^14.6.1 | User interaction simulation |
| @testing-library/jest-dom ^6.9.1 | DOM assertion matchers |
| jsdom ^29.0.1 | Browser environment simulation |
| supertest ^7.2.2 | HTTP integration testing |
| Playwright ^1.58.2 | E2E browser testing |

### 10.3 Playwright Configuration

- Test directory: `e2e/`
- Sequential execution (1 worker, not parallel)
- 30-second timeout per test
- Auth setup project saves state to `e2e/.auth/user.json`
- Browser projects: Chromium (default), Firefox, WebKit, Mobile Chrome, Mobile Safari
- Dev server auto-started with `E2E_TEST=true`
- Screenshots on failure, trace on first retry

### 10.4 Running Tests

```bash
# All unit tests (backend + frontend)
npm test

# E2E tests (Chromium)
npm run test:e2e

# E2E - all browsers
npm run test:e2e:all

# E2E - specific browser
npm run test:e2e:firefox
npm run test:e2e:webkit

# E2E - mobile viewports
npm run test:e2e:mobile

# Type checking
npm run typecheck

# Linting
npm run lint
```

---

## 11. Environment Variables

### Required

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string (prod) or `file:./canvas-app.db` (dev SQLite) |
| `JWT_SECRET` | 32+ char random string for JWT signing |

### Optional — Backend

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | `production` / `development` / `test` | `development` |
| `PORT` | HTTP server port | `3007` |
| `ALLOWED_ORIGINS` | Comma-separated frontend URLs for CORS | All origins in dev |
| `REGISTRATION_ENABLED` | Enable new user signups (`true`/`false`) | `false` |
| `APP_URL` | Public app URL (email links, Stripe redirects) | — |
| `ENCRYPTION_KEY` | 32-byte hex key for AES-256-GCM encryption of API keys | — |
| `E2E_TEST` | Enables E2E test mode (skips rate limits) | — |

### Optional — Stripe

| Variable | Description |
|----------|-------------|
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `STRIPE_ACADEMIC_COUPON_ID` | Coupon ID for .edu discount (40% off) |

### Optional — SMTP

| Variable | Description | Default |
|----------|-------------|---------|
| `SMTP_HOST` | SMTP server hostname | — |
| `SMTP_PORT` | SMTP port | `465` |
| `SMTP_USER` | SMTP username | — |
| `SMTP_PASS` | SMTP password | — |
| `SMTP_FROM` | From address for emails | — |

### Optional — AI / OAuth

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Default OpenAI API key (users can also provide their own) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID for sign-in |

### Optional — Frontend (VITE_ prefix)

| Variable | Description |
|----------|-------------|
| `VITE_STRIPE_PRO_MONTHLY_PRICE_ID` | Stripe price ID for Pro monthly |
| `VITE_STRIPE_PRO_ANNUAL_PRICE_ID` | Stripe price ID for Pro annual |
| `VITE_STRIPE_TEAM_MONTHLY_PRICE_ID` | Stripe price ID for Team monthly |
| `VITE_STRIPE_TEAM_ANNUAL_PRICE_ID` | Stripe price ID for Team annual |
| `VITE_WS_URL` | WebSocket URL (points to Railway in production) |

---

## 12. Key Commands

| Command | Description |
|---------|-------------|
| `npm install` | Install all workspace dependencies |
| `npm run dev` | Start backend + frontend concurrently (builds shared first) |
| `npm run dev:backend` | Start backend only (tsx watch) |
| `npm run dev:frontend` | Start frontend only (Vite) |
| `npm run build` | Full production build (shared -> backend -> frontend) |
| `npm start` | Start production server (from apps/backend) |
| `npm test` | Run all unit tests (234 backend + 131 frontend) |
| `npm run test:e2e` | Run E2E tests (Chromium, 44 tests) |
| `npm run test:e2e:all` | Run E2E tests on all browsers |
| `npm run test:e2e:firefox` | Run E2E tests on Firefox |
| `npm run test:e2e:webkit` | Run E2E tests on WebKit |
| `npm run test:e2e:mobile` | Run E2E tests on mobile viewports |
| `npm run typecheck` | Type-check backend + frontend (`tsc -b`) |
| `npm run lint` | ESLint across all packages |
| `npm run lint:fix` | ESLint with auto-fix |
| `npm run format` | Prettier format all TypeScript files |
| `npm run format:check` | Prettier check (no write) |
| `npm run db:migrate` | Run Prisma migrations (`prisma migrate dev`) |
| `npm run db:seed` | Seed demo data (`tsx prisma/seed.ts`) |
