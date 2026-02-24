# Canvas App — Developer Handoff

> **Origin**: Extracted from the WISEShift monorepo (Feb 2026).
> This document gives a new developer everything they need to run, understand, and extend the Canvas App.

---

## 1. What This App Does

A standalone qualitative coding canvas for researchers. Think of it as a visual whiteboard where you can:

- Import or paste interview transcripts
- Create colour-coded research questions (hierarchical)
- Select text passages and code them to questions
- Write memos (analytical sticky notes)
- Group transcripts into cases
- Draw relationships between items
- Run 10 types of computed analysis (word clouds, clustering, sentiment, co-occurrence, etc.)
- Share / clone canvases with other users
- Optionally import narrative data from a running WISEShift instance via REST bridge

---

## 2. Quick Start

```bash
cd "C:\JM Programs\Canvas App"
npm install
npm run db:migrate      # creates SQLite DB + tables
npm run db:seed         # creates demo account CANVAS-DEMO2025
npm run dev             # starts backend (3007) + frontend (5174)
```

Open `http://localhost:5174`. Sign in with `CANVAS-DEMO2025` or register a new account.

---

## 3. Project Structure

```
Canvas App/
├── package.json              # workspace root (scripts: dev, build, db:migrate, db:seed)
├── tsconfig.base.json        # shared compiler options
│
├── shared/                   # @canvas-app/shared
│   ├── package.json
│   ├── tsconfig.json
│   ├── index.ts              # re-exports everything from types/
│   └── types/
│       └── canvas.types.ts   # 340+ lines of interfaces & input types
│
├── apps/backend/             # Express + Prisma
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env                  # DATABASE_URL, JWT_SECRET, PORT
│   ├── prisma/
│   │   ├── schema.prisma     # 13 models (see §6)
│   │   ├── seed.ts           # demo account
│   │   ├── migrations/       # Prisma migrations
│   │   └── canvas-app.db     # SQLite file (gitignored)
│   └── src/
│       ├── index.ts          # entry — Express on port 3007
│       ├── lib/prisma.ts     # singleton Prisma client
│       ├── middleware/
│       │   ├── auth.ts       # JWT / dashboard-code verification
│       │   ├── auditLog.ts   # logs every request to AuditLog table
│       │   ├── csrf.ts       # Origin-header validation on mutations
│       │   ├── errorHandler.ts
│       │   └── validation.ts # Zod schemas for every endpoint
│       ├── routes/
│       │   ├── authRoutes.ts # POST /api/auth (login), POST /api/auth/register
│       │   └── canvasRoutes.ts # ~40 canvas CRUD & analysis endpoints (1015 lines)
│       └── utils/
│           ├── hashing.ts    # SHA-256 + bcrypt
│           ├── jwt.ts        # sign / verify (24h expiry)
│           └── textAnalysis.ts # 10 computed-node algorithms (766 lines)
│
└── apps/frontend/            # React 18 + Vite
    ├── package.json
    ├── tsconfig.json
    ├── vite.config.ts        # port 5174, proxies /api → localhost:3007
    ├── tailwind.config.js
    ├── postcss.config.js
    ├── index.html
    └── src/
        ├── main.tsx          # ReactDOM entry, dark mode init, Toaster
        ├── App.tsx           # BrowserRouter: / → LoginPage, /canvas → CanvasPage
        ├── index.css         # Tailwind base + canvas utility classes
        ├── pages/
        │   ├── LoginPage.tsx     # sign-in / register UI
        │   └── CanvasPage.tsx    # minimal header + CodingCanvas
        ├── stores/
        │   ├── authStore.ts      # Zustand persisted (localStorage key: canvas-app-auth)
        │   ├── uiStore.ts        # dark mode toggle (key: canvas-app-ui)
        │   └── canvasStore.ts    # main state + all actions (~580 lines)
        ├── services/
        │   └── api.ts            # canvasApi, authApi, createWiseShiftBridge()
        ├── hooks/
        │   └── useCanvasHistory.ts  # undo/redo tracking
        └── components/canvas/
            ├── CodingCanvas.tsx       # entry: list view or workspace
            ├── CanvasWorkspace.tsx     # React Flow container
            ├── CodingDensityBar.tsx    # visual coding density indicator
            ├── ConfirmDialog.tsx       # reusable confirm modal
            ├── TranscriptContextMenu.tsx
            ├── nodes/                 # 8 base + 10 computed node components
            │   ├── TranscriptNode.tsx
            │   ├── QuestionNode.tsx
            │   ├── MemoNode.tsx
            │   ├── CaseNode.tsx
            │   ├── ComputedNodeShell.tsx
            │   ├── SearchResultNode.tsx
            │   ├── CooccurrenceNode.tsx
            │   ├── MatrixNode.tsx
            │   ├── StatsNode.tsx
            │   ├── ComparisonNode.tsx
            │   ├── WordCloudNode.tsx
            │   ├── ClusterNode.tsx
            │   ├── CodingQueryNode.tsx
            │   ├── SentimentNode.tsx
            │   └── TreemapNode.tsx
            ├── edges/
            │   ├── CodingEdge.tsx     # transcript → question
            │   └── RelationEdge.tsx   # labelled relationships
            └── panels/
                ├── CanvasListPanel.tsx       # browse / create canvases
                ├── CanvasToolbar.tsx         # add items toolbar
                ├── CodingDetailPanel.tsx     # right panel: coded segments
                ├── AnnotationPopover.tsx     # inline annotation edit
                ├── CaseManagerPanel.tsx      # manage cases
                ├── HierarchyPanel.tsx        # question tree view
                ├── CodingStripesOverlay.tsx  # visual density stripes
                ├── AutoCodeModal.tsx         # keyword/regex auto-code
                ├── ImportNarrativesModal.tsx  # WISEShift bridge + manual entry
                ├── CrossCanvasImportModal.tsx # copy from another canvas
                ├── FileUploadModal.tsx        # import from text/CSV
                ├── TranscriptUploadModal.tsx
                ├── TranscriptSourceMenu.tsx
                ├── ShareCanvasModal.tsx       # generate share code
                ├── CodebookExportModal.tsx    # export codebook
                ├── AddComputedNodeMenu.tsx    # pick computed type
                ├── NodeContextMenu.tsx
                ├── EdgeContextMenu.tsx
                ├── CanvasContextMenu.tsx
                ├── CanvasSearchOverlay.tsx
                ├── SelectionToolbar.tsx
                ├── QuickAddMenu.tsx
                └── KeyboardShortcutsModal.tsx
```

---

## 4. Ports & URLs

| Service          | Dev Port | Notes                                   |
|------------------|----------|-----------------------------------------|
| Backend API      | 3007     | `process.env.PORT`                      |
| Frontend (Vite)  | 5174     | proxies `/api/*` → `localhost:3007`     |
| Production       | 3007     | backend serves frontend static build    |

---

## 5. Authentication

**Two ways to authenticate:**

1. **Dashboard code** (plaintext) — looked up via SHA-256 index + bcrypt verify
2. **JWT** — returned on login, passed in `x-dashboard-code` header

**Login flow:**
```
POST /api/auth  { dashboardCode: "CANVAS-DEMO2025" }
→ { success: true, data: { jwt, dashboardAccessId, name, role } }
```

**Register flow:**
```
POST /api/auth/register  { name: "Alice" }
→ { success: true, data: { accessCode: "CANVAS-XXXXXXXX", jwt, ... } }
```

The frontend stores auth state in Zustand (`authStore.ts`) persisted to `localStorage` under key `canvas-app-auth`. The axios interceptor in `api.ts` injects the JWT on every request.

**JWT config:** 24h expiry, secret from `JWT_SECRET` env var.

---

## 6. Database Schema (Prisma + SQLite)

13 models. The core data model:

```
DashboardAccess (user account)
  └── CodingCanvas (project)
        ├── CanvasTranscript (text source, optional case assignment)
        ├── CanvasQuestion (coding category, hierarchical via parentQuestionId)
        ├── CanvasMemo (analytical note)
        ├── CanvasTextCoding (code: transcript × question, with offsets)
        ├── CanvasNodePosition (React Flow x/y/collapsed per node)
        ├── CanvasCase (group of transcripts)
        ├── CanvasRelation (labelled link between any two items)
        ├── CanvasComputedNode (analysis result, config + result as JSON)
        └── CanvasShare (share code for read-only / clone access)

ConsentRecord (ethics: who consented when)
AuditLog (every API request, hashed IP)
```

Key constraints:
- `@@unique([dashboardAccessId, name])` on CodingCanvas
- `@@unique([canvasId, nodeId])` on CanvasNodePosition
- `@@unique([canvasId, name])` on CanvasCase
- All children cascade-delete when parent canvas is deleted

---

## 7. API Endpoints

### Auth (public)
| Method | Path                  | Description                    |
|--------|-----------------------|--------------------------------|
| POST   | `/api/auth`           | Login with dashboard code      |
| POST   | `/api/auth/register`  | Create new account             |

### Canvas (protected — requires auth + audit log)
| Method | Path                                    | Description                          |
|--------|-----------------------------------------|--------------------------------------|
| GET    | `/api/canvas`                           | List user's canvases                 |
| POST   | `/api/canvas`                           | Create canvas                        |
| GET    | `/api/canvas/:id`                       | Full canvas detail (all relations)   |
| PUT    | `/api/canvas/:id`                       | Update name/description              |
| DELETE | `/api/canvas/:id`                       | Delete canvas + all children         |
| POST   | `/api/canvas/:id/transcripts`           | Add transcript                       |
| PUT    | `/api/canvas/:id/transcripts/:tid`      | Update transcript                    |
| DELETE | `/api/canvas/:id/transcripts/:tid`      | Delete transcript                    |
| POST   | `/api/canvas/:id/questions`             | Add question                         |
| PUT    | `/api/canvas/:id/questions/:qid`        | Update question                      |
| DELETE | `/api/canvas/:id/questions/:qid`        | Delete question                      |
| POST   | `/api/canvas/:id/questions/merge`       | Merge two questions                  |
| POST   | `/api/canvas/:id/memos`                 | Add memo                             |
| PUT    | `/api/canvas/:id/memos/:mid`            | Update memo                          |
| DELETE | `/api/canvas/:id/memos/:mid`            | Delete memo                          |
| POST   | `/api/canvas/:id/codings`               | Create coding (text → question)      |
| PUT    | `/api/canvas/:id/codings/:cid`          | Update annotation                    |
| DELETE | `/api/canvas/:id/codings/:cid`          | Delete coding                        |
| PUT    | `/api/canvas/:id/codings/:cid/reassign` | Move coding to different question    |
| PUT    | `/api/canvas/:id/layout`                | Save node positions (batch upsert)   |
| POST   | `/api/canvas/:id/cases`                 | Create case                          |
| PUT    | `/api/canvas/:id/cases/:caseId`         | Update case                          |
| DELETE | `/api/canvas/:id/cases/:caseId`         | Delete case                          |
| POST   | `/api/canvas/:id/relations`             | Create relation                      |
| PUT    | `/api/canvas/:id/relations/:relId`      | Update relation label                |
| DELETE | `/api/canvas/:id/relations/:relId`      | Delete relation                      |
| POST   | `/api/canvas/:id/computed`              | Create computed node                 |
| PUT    | `/api/canvas/:id/computed/:nodeId`      | Update config/label                  |
| DELETE | `/api/canvas/:id/computed/:nodeId`      | Delete computed node                 |
| POST   | `/api/canvas/:id/computed/:nodeId/run`  | Execute computation → returns result |
| POST   | `/api/canvas/:id/auto-code`             | Keyword/regex auto-code              |
| POST   | `/api/canvas/:id/import-narratives`     | Import pre-formatted narratives      |
| POST   | `/api/canvas/:id/import-from-canvas`    | Copy transcripts from another canvas |
| POST   | `/api/canvas/:id/share`                 | Generate share code                  |
| GET    | `/api/canvas/:id/shares`                | List active shares                   |
| DELETE | `/api/canvas/:id/share/:shareId`        | Revoke share                         |

### Public (no auth)
| Method | Path                          | Description                 |
|--------|-------------------------------|-----------------------------|
| GET    | `/api/canvas/shared/:code`    | Read shared canvas          |
| POST   | `/api/canvas/clone/:code`     | Clone shared canvas         |

---

## 8. Computed Node Types

10 analysis algorithms in `backend/src/utils/textAnalysis.ts`:

| Type          | What it does                                                     |
|---------------|------------------------------------------------------------------|
| search        | Keyword/regex search across transcripts with context snippets    |
| cooccurrence  | Finds overlapping codings between question pairs                 |
| matrix        | Case × Question framework matrix with excerpts and counts        |
| stats         | Coding counts & coverage by question or transcript               |
| comparison    | Side-by-side transcript profiles by question                     |
| wordcloud     | Token frequency analysis (stop words removed)                    |
| cluster       | TF-IDF + K-Means clustering (3 random restarts)                 |
| codingquery   | Boolean AND/OR/NOT queries across questions                      |
| sentiment     | AFINN lexicon-based sentiment scoring (100+ words)               |
| treemap       | Hierarchical question tree with sizing by code count             |

All functions are pure — they take data arrays and return result objects. No side effects.

To add a new computed node type:
1. Add the algorithm in `textAnalysis.ts`
2. Add a case in `canvasRoutes.ts` → `POST /:id/computed/:nodeId/run` switch
3. Add config/result types in `shared/types/canvas.types.ts`
4. Create a React component in `frontend/src/components/canvas/nodes/`
5. Register it in `CanvasWorkspace.tsx` node type map

---

## 9. WISEShift Bridge (Optional Integration)

The Canvas App can optionally fetch narrative responses from a running WISEShift instance.

**How it works:**

1. User opens `ImportNarrativesModal` → selects "WISEShift Bridge" tab
2. Enters WISEShift base URL (e.g. `http://localhost:3006`) and a dashboard code
3. Frontend creates an Axios client via `createWiseShiftBridge(baseUrl, code)`
4. Fetches available narratives: `GET {baseUrl}/api/v1/research/narratives`
5. User picks which to import
6. Frontend calls `canvasStore.importNarratives(narratives)` → `POST /api/canvas/:id/import-narratives`
7. Backend creates CanvasTranscript records with `sourceType: 'import'`

**WISEShift endpoint contract** (already implemented in WISEShift):
```
GET /api/v1/research/narratives
  Headers: x-dashboard-code: DASH-XXXXXXXX
  Query params: ?assessmentId=... or ?ids=id1,id2,...
  Returns: { success: true, data: [{ id, title, content, orgName, domainKey, questionId }] }
```

The bridge is entirely optional — users can also paste text manually or upload files.

---

## 10. Environment Variables

### Backend (`apps/backend/.env`)
```env
DATABASE_URL="file:./canvas-app.db"
JWT_SECRET="canvas-app-dev-secret-change-in-production"
PORT=3007
NODE_ENV=development
```

**Production additions:**
```env
NODE_ENV=production
JWT_SECRET=<strong-random-string>
ALLOWED_ORIGINS=https://your-domain.com   # for CSRF validation
```

### Frontend
No `.env` needed. In dev, Vite proxies `/api` to the backend. In production, the backend serves the frontend build on the same origin.

---

## 11. Security Features

| Feature        | Implementation                                              |
|----------------|-------------------------------------------------------------|
| Auth           | JWT (24h) or SHA-256 + bcrypt dashboard codes               |
| CSRF           | Origin header validation on POST/PUT/PATCH/DELETE            |
| Rate limiting  | 500 requests / 15 min per IP                                |
| Audit logging  | Every request → AuditLog table (hashed IP, action, resource)|
| Consent        | ConsentRecord table for ethics compliance                    |
| Headers        | Helmet (CSP disabled for canvas rendering)                   |
| Passwords      | bcrypt 12 rounds                                            |

---

## 12. Deployment

### Build
```bash
npm run build
# Produces:
#   shared/dist/
#   apps/frontend/dist/   (static files)
#   apps/backend/dist/    (compiled JS)
```

### Run in production
```bash
cd apps/backend
npm start   # runs: prisma migrate deploy && node dist/index.js
```

The backend serves the frontend static build from `../frontend/dist` when `NODE_ENV=production`. Everything runs on a single port (3007).

### Database
- Dev: SQLite (file-based, zero config)
- Production: change `datasource db` in `schema.prisma` to PostgreSQL if needed

---

## 13. Common Development Tasks

### Add a new endpoint
1. Add Zod schema in `middleware/validation.ts`
2. Add route handler in `routes/canvasRoutes.ts`
3. Add method in `frontend/src/services/api.ts` → `canvasApi`
4. Add action in `frontend/src/stores/canvasStore.ts`
5. Use in component via `useCanvasStore()`

### Modify the database
1. Edit `apps/backend/prisma/schema.prisma`
2. Run `npm run db:migrate` (creates migration + applies)
3. Re-seed if needed: `npm run db:seed`

### Add a new node type to the canvas
1. Create component in `frontend/src/components/canvas/nodes/`
2. Register in `CanvasWorkspace.tsx` node type map
3. If it's a computed type, also add the algorithm in `textAnalysis.ts`

---

## 14. Gotchas & Notes

- **Text coding offsets** are character-based (startOffset/endOffset into transcript content string), not line-based.
- **Cascade deletes**: deleting a canvas removes all its children. Deleting a question removes its codings.
- **Computed node results** are stored as JSON strings in the `result` column — parsed on read.
- **React Flow positions** are persisted to `CanvasNodePosition` table on every layout save.
- **No test suite** exists yet — that's a good early investment.
- **The `setup` field on `TourChapter`** is no longer used (canvas tour was removed from WISEShift). You may want to add your own onboarding tour using `driver.js`.
- **Demo code**: `CANVAS-DEMO2025` expires 2027-12-31.
