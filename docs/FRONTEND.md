Perfect! Now I have comprehensive data. Let me compile the detailed technical documentation:

---

# QualCanvas Frontend - Comprehensive Technical Documentation

## 1. APP STRUCTURE

### Routes (App.tsx, lines 1-92)

**Entry Point:** `apps/frontend/src/App.tsx`
- Wraps app in `ErrorBoundary`, `BrowserRouter`, `OfflineBanner`, `UpgradePrompt`
- Uses React Router v7.1.1 with lazy loading for protected routes
- Sentry error tracking enabled in production (main.tsx lines 11-16)

**Route Hierarchy:**

| Path | Component | Protected | Loading | Notes |
|------|-----------|-----------|---------|-------|
| `/` | LandingPage | No | Direct | Public marketing page |
| `/login` | LoginPage | No | Direct | Email + legacy access code auth |
| `/pricing` | PricingPage | No | Direct | Tier comparison, annual/monthly toggle |
| `/account` | AccountPage | Yes | Suspense→PageSkeleton | Profile, plan, usage, billing portal |
| `/canvas/:canvasId?` | CanvasPage | Yes | Suspense→PageSkeleton | Main workspace with optional canvas ID deep-link |
| `/repository` | RepositoryPage | Yes | Suspense→PageSkeleton | Repository & insights management |
| `/team` | TeamPage | Yes | Suspense→PageSkeleton | Team management |
| `/forgot-password` | ForgotPasswordPage | No | Direct | Email password reset flow |
| `/reset-password` | ResetPasswordPage | No | Direct | Token-based password reset |
| `/verify-email` | VerifyEmailPage | No | Direct | Email verification flow |
| `/terms` | TermsPage | No | Direct | Legal |
| `/privacy` | PrivacyPage | No | Direct | Legal |
| `/guide` | GuidePage | No | Direct | Help/onboarding |
| `*` | NotFoundPage | No | Direct | 404 |

**Protected Route Implementation (lines 24-28):**
```typescript
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const authenticated = useAuthStore(s => s.authenticated);
  if (!authenticated) return <Navigate to="/login" replace />;
  return <>{children}</>;
}
```

**Lazy-Loaded Components:**
- `CanvasPage` (line 19): async import from `./pages/CanvasPage`
- `AccountPage` (line 20): async import from `./pages/AccountPage`
- `RepositoryPage` (line 21): async import from `./pages/RepositoryPage`
- `TeamPage` (line 22): async import from `./pages/TeamPage`

All lazy routes use `<Suspense fallback={<PageSkeleton />}>` for smooth loading states.

**Error Boundary Setup (App.tsx line 32):**
- Single top-level `ErrorBoundary` wraps entire app
- Additional error boundaries wrap computed nodes in `CanvasWorkspace.tsx` (lines 104-115)
- Fallback: Displays error message with "Try again" button
- Logs errors via Sentry in production

**Toast System (main.tsx lines 27-33):**
- `react-hot-toast` with position: "bottom-right"
- Dark mode styling: `dark:bg-gray-800 dark:text-white`
- Border radius: 10px, padding: 12px 16px

---

## 2. ALL STORES (Zustand)

### 2.1 Auth Store (`authStore.ts`, 116 lines)

**Persistence:** `qualcanvas-auth` localStorage key with rehydration validation

**State Fields:**
- `jwt: string | null` - JWT token
- `name: string | null` - User's display name
- `role: string | null` - User role (e.g., "user", "admin")
- `authenticated: boolean` - Login flag
- `authType: AuthType | null` - `'email'` or `'legacy'` (access code)
- `dashboardCode: string | null` - Legacy access code
- `dashboardAccessId: string | null` - Legacy account identifier
- `email: string | null` - Email (email auth only)
- `userId: string | null` - Unique user ID (email auth only)
- `plan: string | null` - Subscription tier: `'free'`, `'pro'`, `'team'`
- `emailVerified: boolean` - Email verification status

**Actions:**

| Method | Parameters | Behavior |
|--------|-----------|----------|
| `setAuth` | `{ dashboardCode, jwt, name, role, dashboardAccessId }` | Sets legacy auth, marks as `'legacy'` authType, sets plan to `'pro'` (grandfathered) |
| `setEmailAuth` | `{ jwt, email, userId, name, role, plan, emailVerified? }` | Sets email auth, clears legacy fields, authType `'email'` |
| `setEmailVerified` | `boolean` | Updates email verification status |
| `updatePlan` | `string` | Updates plan tier (synced from `X-User-Plan` response header) |
| `logout` | none | Clears all auth state |

**Rehydration Guard (lines 96-112):** If JWT missing but authenticated flag set, resets to logged-out state to prevent stale auth.

---

### 2.2 Canvas Store (`canvasStore.ts`, 670 lines)

**No Persistence** — state is ephemeral, loaded on each session.

**State Sections:**

#### Canvas List Management
- `canvases: (CodingCanvas & { _count: { transcripts, questions, codings } })[]` - Array of user's canvases
- `loading: boolean` - Fetch in progress
- `error: string | null` - Error message
- `trashedCanvases: (CodingCanvas & { _count })[]` - Soft-deleted canvases
- `trashLoading: boolean` - Trash fetch in progress

#### Active Canvas
- `activeCanvasId: string | null` - Currently open canvas ID
- `activeCanvas: CanvasDetail | null` - Full canvas data with all nested content

#### Coding Workflow
- `pendingSelection: PendingSelection | null` - Selected text for coding
  - `transcriptId: string`
  - `startOffset: number`
  - `endOffset: number`
  - `codedText: string`

#### UI State
- `selectedQuestionId: string | null` - Highlight detail panel for a code
- `showCodingStripes: boolean` - Overlay coding density visualization
- `savingLayout: boolean` - Layout save in progress
- `runningNodeId: string | null` - Computed node execution in progress

**Canvas Actions (Lines 137-194):**

| Method | Signature | Notes |
|--------|-----------|-------|
| `fetchCanvases` | `() => Promise<void>` | GET `/canvas`, populates canvases list |
| `createCanvas` | `(name: string, description?: string) => Promise<CodingCanvas>` | POST `/canvas`, prepends to list |
| `deleteCanvas` | `(id: string) => Promise<void>` | DELETE `/canvas/{id}`, removes from list |
| `openCanvas` | `(id: string) => Promise<void>` | GET `/canvas/{id}`, sets activeCanvas; fallback to IndexedDB on error |
| `closeCanvas` | `() => void` | Clears activeCanvasId, activeCanvas, pendingSelection, selectedQuestionId |
| `refreshCanvas` | `() => Promise<void>` | Refetch active canvas (no-op if none open) |
| `fetchTrash` | `() => Promise<void>` | GET `/canvas/trash`, populates trashedCanvases |
| `restoreCanvas` | `(id: string) => Promise<void>` | POST `/canvas/{id}/restore`, removes from trash |
| `permanentDeleteCanvas` | `(id: string) => Promise<void>` | DELETE `/canvas/{id}/permanent` |

**Transcript Actions (Lines 222-262):**
```typescript
addTranscript(title, content) → CanvasTranscript
updateTranscript(tid, { title?, content?, caseId? })
deleteTranscript(tid) → removes codings for this transcript
```
Emits `canvas:node-added`, `canvas:transcript-updated`, `canvas:node-deleted` socket events.

**Question (Code) Actions (Lines 265-307):**
```typescript
addQuestion(text, color?) → CanvasQuestion
updateQuestion(qid, { text?, color?, parentQuestionId? })
deleteQuestion(qid) → cascades to child questions, removes codings
```
Questions support parent-child hierarchies for code categorization.

**Memo Actions (Lines 309-345):**
```typescript
addMemo(content, title?, color?) → CanvasMemo
updateMemo(mid, { title?, content?, color? })
deleteMemo(mid)
```

**Coding Actions (Lines 349-399):**
```typescript
createCoding(transcriptId, questionId, startOffset, endOffset, codedText) → CanvasTextCoding
deleteCoding(codingId)
updateCodingAnnotation(codingId, annotation: string | null)
reassignCoding(codingId, newQuestionId)
setPendingSelection(PendingSelection | null)
```
Emits `canvas:coding-added`, `canvas:coding-deleted` socket events.

**Layout Actions (Lines 401-422):**
```typescript
saveLayout(positions: CanvasNodePosition[]) → PUT `/canvas/{id}/layout`
```
Positions include: `nodeId`, `nodeType`, `x`, `y`, `width`, `height`, `collapsed`.
Debounces on error, shows toast.

**Case Actions (Lines 428-473):**
```typescript
addCase(name, attributes?) → CanvasCase
updateCase(caseId, { name?, attributes? })
deleteCase(caseId) → cascades to transcript caseId links, relations
```

**Relation Actions (Lines 478-510):**
```typescript
addRelation(fromType: 'case' | 'question', fromId, toType, toId, label) → CanvasRelation
updateRelation(relId, label)
deleteRelation(relId)
```

**Computed Node Actions (Lines 515-570):**
```typescript
addComputedNode(nodeType: ComputedNodeType, label, config?) → CanvasComputedNode
updateComputedNode(nodeId, { label?, config? })
deleteComputedNode(nodeId)
runComputedNode(nodeId) → triggers analysis, sets runningNodeId state
```
nodeType options: `'stats'`, `'wordcloud'`, `'cooccurrence'`, `'matrix'`, `'comparison'`, `'cluster'`, `'sentiment'`, `'timeline'`, `'geomap'`, `'search'`, `'codingquery'`, `'treemap'`, `'documentportrait'`.

**Auto-Code Actions (Lines 573-587):**
```typescript
autoCode(questionId, pattern, mode: 'keyword' | 'regex', transcriptIds?) 
  → POST `/canvas/{id}/auto-code`
  → returns { created: number }
  → emits 'canvas:coding-added' socket event
```

**In-Vivo Coding (Lines 591-595):**
```typescript
codeInVivo(transcriptId, startOffset, endOffset, codedText)
  → Creates question with text = codedText
  → Creates coding linking to new question
```

**Spread to Paragraph (Lines 599-618):**
```typescript
spreadToParagraph(transcriptId, startOffset, endOffset, codedText)
  → Finds paragraph boundaries (double newlines)
  → Creates question, codes entire paragraph
```

**Merge & Import (Lines 622-643):**
```typescript
mergeQuestions(sourceId, targetId)
  → POST `/canvas/{id}/questions/merge`
  → Refreshes canvas to sync merged codings

importNarratives(narratives: { title, content, sourceType?, sourceId? }[])
  → POST `/canvas/{id}/import-narratives`

importFromCanvas(sourceCanvasId, transcriptIds)
  → POST `/canvas/{id}/import-from-canvas`
```

**UI Toggles (Line 647):**
```typescript
toggleCodingStripes() → Toggles showCodingStripes
setSelectedQuestionId(id | null)
```

**Granular Selector Hooks (Lines 650-670):**
All are memoized to prevent unnecessary re-renders:
```typescript
useActiveCanvas() → activeCanvas
useActiveCanvasId() → activeCanvasId
useCanvasTranscripts() → activeCanvas?.transcripts || []
useCanvasQuestions() → activeCanvas?.questions || []
useCanvasCodings() → activeCanvas?.codings || []
useCanvasMemos() → activeCanvas?.memos || []
useCanvasCases() → activeCanvas?.cases || []
useCanvasRelations() → activeCanvas?.relations || []
useCanvasComputedNodes() → activeCanvas?.computedNodes || []
useCanvasNodePositions() → activeCanvas?.nodePositions || []
useSelectedQuestionId() → selectedQuestionId
usePendingSelection() → pendingSelection
useCanvasLoading() → loading
useCanvasError() → error
useShowCodingStripes() → showCodingStripes
useRunningNodeId() → runningNodeId
useTrashedCanvases() → trashedCanvases
useTrashLoading() → trashLoading
```

---

### 2.3 UI Store (`uiStore.ts`, 62 lines)

**Persistence:** `qualcanvas-ui` with `partialize` (excludes zoomTier)

**State:**
- `darkMode: boolean` - Dark mode enabled (defaults to system preference)
- `onboardingComplete: boolean` - Onboarding tour shown
- `sidebarCollapsed: boolean` - Code navigator sidebar state
- `edgeStyle: EdgeStyleType` - Bezier | straight | step | smoothstep
- `scrollMode: ScrollMode` - Zoom | pan (mouse wheel behavior)
- `zoomTier: ZoomTier` - Full | reduced | minimal (node detail level)

**Actions:**
```typescript
toggleDarkMode() → Updates DOM .dark class, saves to localStorage
completeOnboarding() → onboardingComplete = true
resetOnboarding() → onboardingComplete = false
setSidebarCollapsed(v: boolean)
setEdgeStyle(style: EdgeStyleType)
setScrollMode(mode: ScrollMode)
setZoomTier(tier: ZoomTier)
```

---

### 2.4 Shortcut Store (`shortcutStore.ts`, 151 lines)

**Persistence:** `qualcanvas-shortcuts`

**State:**
- `shortcuts: ShortcutMap` - Object mapping action names to key combos

**Default Shortcuts (Lines 8-31):**
```
fitView: 'f'
zoomTo100: '1'
zoomToFit: '0'
toggleGrid: 'g'
toggleCollapse: 'c'
showShortcuts: '?'
commandPalette: 'ctrl+k'
search: 'ctrl+f'
copy: 'ctrl+c'
paste: 'ctrl+v'
duplicate: 'ctrl+d'
selectAll: 'ctrl+a'
undo: 'ctrl+z'
redo: 'ctrl+shift+z'
mute: 'ctrl+m'
autoLayout: 'ctrl+shift+l'
focusMode: 'ctrl+.'
group: 'ctrl+g'
delete: 'delete'
collapseAll: 'ctrl+shift+c'
alignLeft: 'shift+a'
distributeH: 'shift+d'
```

**Actions:**
```typescript
getShortcut(action: string) → string
setShortcut(action, combo) → Updates localStorage
resetShortcut(action) → Reverts to default
resetAll() → Resets all shortcuts
```

**Utility Functions:**
```typescript
matchesShortcut(e: KeyboardEvent, combo: string) → boolean
  → Parses combo ('ctrl+shift+z'), compares to event modifiers/key
  → Special handling: 'delete' matches 'backspace', '?' and '.' literal

eventToCombo(e: KeyboardEvent) → string | null
  → Converts KeyboardEvent to combo string
  → Returns null for modifier-only key presses
  → Normalizes key names (space, escape, etc.)
```

---

### 2.5 AI Config Store (`aiConfigStore.ts`, 34 lines)

**No Persistence** — runtime state only

**State:**
- `configured: boolean` - AI API key configured
- `provider: string | null` - AI provider (e.g., 'openai')
- `loaded: boolean` - Config fetch completed

**Actions:**
```typescript
setConfigured(boolean, provider?: string)
fetchConfig() → GET `/ai-settings`
  → Sets configured, provider from response
  → Marks as loaded on success or error
  → Idempotent: skips if already loaded
```

---

### 2.6 Chat Store (`chatStore.ts`, 72 lines)

**No Persistence** — ephemeral per-canvas

**State:**
- `messages: ChatMessage[]` - Conversation history
- `loading: boolean` - Message send in progress
- `indexing: boolean` - Canvas embedding in progress
- `indexed: boolean` - Canvas has been embedded
- `error: string | null`

**Actions:**
```typescript
loadHistory(canvasId) → GET `/canvas/{id}/ai/chat/history`
sendMessage(canvasId, message) → POST `/canvas/{id}/ai/chat`
  → Optimistically adds user message
  → Receives assistant message, appends to messages
indexCanvas(canvasId) → POST `/canvas/{id}/ai/embed`
  → Indexes canvas for semantic search in research assistant
clearMessages() → Resets state for new canvas
```

---

## 3. ALL HOOKS

### 3.1 useCanvasKeyboard (`useCanvasKeyboard.ts`, 200+ lines)

**Purpose:** Orchestrates all keyboard shortcuts for canvas operations

**Parameters (CanvasKeyboardOptions interface):**
- UI state: `showSearch`, `showShortcuts`, `showCommandPalette`, `contextMenu`, etc.
- State setters for dismissing modals on Escape
- Node/edge/selection management: `nodes`, `setNodes`, `rfInstanceRef`
- Action handlers: `handleCopy`, `handlePaste`, `handleDuplicate`, etc.
- Undo/redo: `onUndo`, `onRedo`, `canUndo`, `canRedo`
- Viewport bookmarks: `saveBookmark(slot, viewport)`, `recallBookmark(slot)`
- Layout: `handleAutoLayout`
- Focus mode: `setFocusMode`
- Tabs: `onNextTab?`, `onPrevTab?`
- Mute: `onToggleMute?`

**Key Behaviors:**
- Escape dismisses all modals
- Shortcuts from `useShortcutStore` via `matchesShortcut()`
- Viewport bookmarks: 5 slots (0-9 keys) save/recall `{ x, y, zoom }`
- Tab navigation switches between open canvases
- Copy/paste uses clipboard (in-memory ref)

---

### 3.2 useCanvasHistory (`useCanvasHistory.ts`, 130 lines)

**Return Type (UseCanvasHistoryReturn):**
```typescript
{
  pushState: (nodes: Node[], edges: Edge[]) => void
  undo: () => { nodes, edges } | null
  redo: () => { nodes, edges } | null
  canUndo: boolean
  canRedo: boolean
  clearHistory: () => void
}
```

**Configuration:**
- `MAX_HISTORY = 50` - Max snapshots retained
- `DEBOUNCE_MS = 300` - Rapid pushes replace last entry if within threshold

**Internal:**
- `timelineRef: HistoryEntry[]` - Array of snapshots
- `pointerRef: number` - Current position in timeline (-1 = empty)
- `cloneForHistory()` - Strips callbacks, keeps layout (position, size, collapsed)

**Algorithm:**
- Timeline: `[snap0, snap1, snap2, ...]`
- pushState: append after pointer, truncate redo entries
- undo/redo: decrement/increment pointer, return snapshot
- Debouncing: if same action repeated within 300ms, updates current snapshot instead of adding new

---

### 3.3 useMobile (`useMobile.ts`, 22 lines)

```typescript
useMobile(breakpoint = 768): boolean
```
- Detects mobile/tablet: `window.innerWidth < breakpoint || 'ontouchstart' in window`
- Listens to resize events, updates on change
- Default breakpoint: 768px (iPad)

---

### 3.4 useCollaboration (`useCollaboration.ts`, 160+ lines)

**Parameters:**
```typescript
{ canvasId: string | null, enabled?: boolean }
```

**Return:**
```typescript
{
  collaborators: CollaboratorPresence[]
  cursors: Map<userId, { x, y, name, color }>
  isConnected: boolean
  emitNodeMove(nodeId, x, y)
  emitCanvasChange(changeType, payload?)
  emitNodeAdded(canvasId, { type, id })
  emitNodeDeleted(canvasId, nodeId, nodeType)
  emitNodeMoved(canvasId, nodeId, { x, y })
  emitCodingAdded(canvasId, { id, transcriptId, questionId })
  emitCodingDeleted(canvasId, codingId)
  emitTranscriptUpdated(canvasId, transcriptId)
}
```

**Socket Events Emitted:**
- `canvas:join` - Join canvas room on connect
- `canvas:cursor-moved` - Cursor position (throttled 50ms)
- `canvas:node-moved` - Node drag (throttled 100ms)

**Socket Events Listened:**
- `presence:updated` - Collaborator list
- `presence:current` - Initial presence sync
- `cursor:moved` - Remote cursor
- `canvas:node-added`, `canvas:coding-added`, etc. - Refresh canvas if from other user

**Throttling:**
- Cursor: 50ms
- Node moves: 100ms (10 per second max)

---

### 3.5 useSessionTimeout (`useSessionTimeout.ts`, 68 lines)

**Return:**
```typescript
{ showWarning: boolean, dismissWarning: () => void }
```

**Timers:**
- `INACTIVITY_WARNING_MS = 1800000` (30 minutes)
- `INACTIVITY_LOGOUT_MS = 2100000` (35 minutes)

**Events Tracked:**
- mousemove, keydown, click, scroll, touchstart
- Throttled: 5 seconds between activity events

**Behavior:**
- Shows warning modal at 30 min
- Auto-logs out at 35 min
- Dismissing warning resets timers
- Activity resets timers

---

### 3.6 useAutoLayout (`useAutoLayout.ts`, 80+ lines)

**Dependencies:** dagre library

**Return:**
```typescript
{ applyLayout: (direction?: 'LR' | 'TB', spacing?: { node, rank }) => void }
```

**Configuration:**
- `DEFAULT_NODE_WIDTH = 280`
- `DEFAULT_NODE_HEIGHT = 200`
- Direction: LR (left-right) or TB (top-bottom)
- Node spacing: 60px
- Rank spacing: 100px

**Algorithm:**
- Uses dagre graph layout
- Filters out 'group' nodes (don't participate in layout)
- Reads node dimensions from `measured.width/height` or style
- Converts dagre center positions to top-left
- Returns position map for setNodes update

---

### 3.7 useAiSuggestions (`useAiSuggestions.ts`, 100+ lines)

**Return:**
```typescript
{
  suggestions: AiSuggestion[]
  loading: boolean
  suggestCodes(transcriptId, codedText, startOffset, endOffset) → Promise<AiSuggestion[]>
  autoCodeTranscript(transcriptId, instructions?) → Promise<AiSuggestion[]>
  fetchSuggestions(transcriptId?) → Promise<void>
  acceptSuggestion(suggestionId) → Promise<void>
  rejectSuggestion(suggestionId) → Promise<void>
  bulkAccept(suggestionIds[]) → Promise<void>
}
```

**API Calls:**
- POST `/canvas/{id}/ai/suggest-codes` - Get code suggestions for text segment
- POST `/canvas/{id}/ai/auto-code-transcript` - Auto-code entire transcript
- GET `/canvas/{id}/ai/suggestions?status=pending` - Fetch pending suggestions
- PUT `/canvas/{id}/ai/suggestions/{id}` - Accept/reject with status

---

### 3.8 useContainerSize (`useContainerSize.ts`, 40 lines)

**Purpose:** ResizeObserver hook for responsive layout

**Return:**
```typescript
{ width: number, height: number }
```

**Features:**
- Uses ResizeObserver (not polling)
- Debounces via requestAnimationFrame
- Skips state update if size unchanged
- Cleanup: disconnects observer, cancels RAF

---

### 3.9 useCanvasGroups (`useCanvasGroups.ts`, 100+ lines)

**Return:**
```typescript
{
  groups: CanvasGroup[]
  addGroup(title, color, x, y, width, height) → string (id)
  removeGroup(id)
  updateGroup(id, { title?, color?, x?, y?, width?, height? })
  setGroupMembers(id, memberNodeIds[])
  collapseGroupAsTheme(id)
  expandGroup(id)
}
```

**Persistence:** `canvas-groups-{canvasId}` in localStorage

**CanvasGroup interface:**
```typescript
{
  id: string
  title: string
  color: string
  x, y, width, height: number
  memberNodeIds?: string[]
  collapsedAsTheme?: boolean
}
```

---

### 3.10 useFileUpload (`useFileUpload.ts`, 53 lines)

**Return:**
```typescript
{
  uploading: boolean
  progress: number (0-100)
  fileUploadId: string | null
  uploadFile(file: File) → Promise<FileUpload | null>
  reset() → Clears state
}
```

**API:**
- POST `/canvas/{id}/upload/direct` with FormData
- Tracks progress via onUploadProgress callback
- Returns FileUpload object with id

**Error Handling:**
- Catches errors, shows toast, returns null

---

### 3.11 useCanvasBookmarks (`useCanvasBookmarks.ts`)

**Slots:** 5 viewport bookmarks (keyed by canvas)
```typescript
{
  bookmarks: Map<string, { x, y, zoom }>
  saveBookmark(slot: number, viewport)
  recallBookmark(slot: number) → Bookmark | null
  hasBookmark(slot: number) → boolean
}
```

---

### 3.12 useNodeColors (`useNodeColors.ts`)

```typescript
{
  colorMap: Map<string, string>
  setNodeColor(nodeId, color)
  getNodeColor(nodeId) → color with fallback
}
```
Persists in localStorage per canvas.

---

### 3.13 useCanvasStickyNotes (`useCanvasStickyNotes.ts`)

```typescript
{
  stickyNotes: StickyNote[]
  addStickyNote(x, y, text, color)
  removeStickyNote(id)
  updateStickyNote(id, { text?, color?, x?, y? })
}
```

---

## 4. API CLIENT (`services/api.ts`, 503 lines)

**Base Client:** `canvasClient` (axios instance)
```typescript
const canvasClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '/api',
  headers: { 'Content-Type': 'application/json' },
});
```

### Interceptors:

#### 1. Auth Injection (Lines 34-51)
- Reads JWT from `localStorage['qualcanvas-auth'].state.jwt`
- If `authType === 'email'`: `Authorization: Bearer {jwt}`
- If `authType === 'legacy'`: `x-dashboard-code: {jwt}`

#### 2. Plan Limit Handler (Lines 54-63)
- On 403 with `code === 'PLAN_LIMIT_EXCEEDED'`
- Dispatches custom event: `window.dispatchEvent(new CustomEvent('plan-limit-exceeded', { detail }))`

#### 3. Plan Sync (Lines 66-78)
- Reads `X-User-Plan` response header
- If differs from `authStore.plan`, updates via `updatePlan()`

#### 4. 401 Logout (Lines 83-96)
- On 401 (expired JWT), calls `logout()`
- Redirects to `/login?expired=true`
- Prevents redirect loop with `isRedirecting` flag (2s debounce)

### API Object Exports:

#### Canvas CRUD (100-123)
```typescript
getCanvases() → GET /canvas
createCanvas(data: CreateCanvasInput) → POST /canvas
getCanvas(canvasId) → GET /canvas/{id}
updateCanvas(canvasId, data) → PUT /canvas/{id}
deleteCanvas(canvasId) → DELETE /canvas/{id}
```

#### Trash (115-123)
```typescript
getTrash() → GET /canvas/trash
restoreCanvas(canvasId) → POST /canvas/{id}/restore
permanentDeleteCanvas(canvasId) → DELETE /canvas/{id}/permanent
```

#### Transcripts (125-133)
```typescript
addTranscript(canvasId, data: CreateTranscriptInput) → POST /canvas/{id}/transcripts
updateTranscript(canvasId, tid, data: UpdateTranscriptInput) → PUT /canvas/{id}/transcripts/{tid}
deleteTranscript(canvasId, tid) → DELETE /canvas/{id}/transcripts/{tid}
```

#### Questions (135-143)
```typescript
addQuestion(canvasId, data: CreateQuestionInput) → POST /canvas/{id}/questions
updateQuestion(canvasId, qid, data: UpdateQuestionInput) → PUT /canvas/{id}/questions/{qid}
deleteQuestion(canvasId, qid) → DELETE /canvas/{id}/questions/{qid}
```

#### Memos (145-153)
```typescript
addMemo(canvasId, data: CreateMemoInput) → POST /canvas/{id}/memos
updateMemo(canvasId, mid, data: UpdateMemoInput) → PUT /canvas/{id}/memos/{mid}
deleteMemo(canvasId, mid) → DELETE /canvas/{id}/memos/{mid}
```

#### Codings (155-166)
```typescript
createCoding(canvasId, data: CreateCodingInput) → POST /canvas/{id}/codings
deleteCoding(canvasId, codingId) → DELETE /canvas/{id}/codings/{codingId}
reassignCoding(canvasId, codingId, newQuestionId) → PUT /canvas/{id}/codings/{codingId}/reassign
updateCoding(canvasId, codingId, data: UpdateCodingInput) → PUT /canvas/{id}/codings/{codingId}
```

#### Layout (168-170)
```typescript
saveLayout(canvasId, data: SaveLayoutInput) → PUT /canvas/{id}/layout
  data: { positions: { nodeId, nodeType, x, y, width, height, collapsed }[] }
```

#### Cases (172-180)
```typescript
createCase(canvasId, data: CreateCaseInput) → POST /canvas/{id}/cases
updateCase(canvasId, caseId, data: UpdateCaseInput) → PUT /canvas/{id}/cases/{caseId}
deleteCase(canvasId, caseId) → DELETE /canvas/{id}/cases/{caseId}
```

#### Relations (182-190)
```typescript
createRelation(canvasId, data: CreateRelationInput) → POST /canvas/{id}/relations
updateRelation(canvasId, relId, data: { label }) → PUT /canvas/{id}/relations/{relId}
deleteRelation(canvasId, relId) → DELETE /canvas/{id}/relations/{relId}
```

#### Computed Nodes (192-203)
```typescript
createComputedNode(canvasId, data: CreateComputedNodeInput) → POST /canvas/{id}/computed
updateComputedNode(canvasId, nodeId, data: UpdateComputedNodeInput) → PUT /canvas/{id}/computed/{nodeId}
deleteComputedNode(canvasId, nodeId) → DELETE /canvas/{id}/computed/{nodeId}
runComputedNode(canvasId, nodeId) → POST /canvas/{id}/computed/{nodeId}/run
```

#### Auto-Code (205-207)
```typescript
autoCode(canvasId, data: AutoCodeInput) → POST /canvas/{id}/auto-code
  data: { questionId, pattern, mode: 'keyword' | 'regex', transcriptIds?: [] }
```

#### Merging & Import (209-219)
```typescript
mergeQuestions(canvasId, sourceId, targetId) → POST /canvas/{id}/questions/merge
importNarratives(canvasId, data: { narratives: [] }) → POST /canvas/{id}/import-narratives
importFromCanvas(canvasId, data: { sourceCanvasId, transcriptIds[] }) → POST /canvas/{id}/import-from-canvas
```

#### Sharing (221-235)
```typescript
shareCanvas(canvasId) → POST /canvas/{id}/share
getShares(canvasId) → GET /canvas/{id}/shares
revokeShare(canvasId, shareId) → DELETE /canvas/{id}/share/{shareId}
cloneCanvas(shareCode) → POST /canvas/clone/{shareCode}
getSharedCanvas(shareCode) → GET /canvas/shared/{shareCode}
```

#### AI (237-264)
```typescript
aiSuggestCodes(canvasId, data: SuggestCodesInput) → POST /canvas/{id}/ai/suggest-codes
aiAutoCodeTranscript(canvasId, data: AutoCodeTranscriptInput) → POST /canvas/{id}/ai/auto-code-transcript
getAiSuggestions(canvasId, params?: { status?, transcriptId? }) → GET /canvas/{id}/ai/suggestions
updateAiSuggestion(canvasId, suggestionId, data: { status: 'accepted' | 'rejected' }) → PUT /canvas/{id}/ai/suggestions/{suggestionId}
bulkActionAiSuggestions(canvasId, data: { suggestionIds[], action }) → POST /canvas/{id}/ai/suggestions/bulk-action
embedCanvasData(canvasId) → POST /canvas/{id}/ai/embed
chatQuery(canvasId, message) → POST /canvas/{id}/ai/chat
getChatHistory(canvasId) → GET /canvas/{id}/ai/chat/history
generateSummary(canvasId, data: { sourceType, sourceId?, summaryType? }) → POST /canvas/{id}/ai/summarize
getSummaries(canvasId, params?: { sourceType?, sourceId? }) → GET /canvas/{id}/summaries
updateSummary(canvasId, sid, data: { summaryText }) → PUT /canvas/{id}/summaries/{sid}
```

#### File Upload & Transcription (272-294)
```typescript
getPresignedUploadUrl(canvasId, data: { fileName, contentType }) → POST /canvas/{id}/upload/presigned
confirmUpload(canvasId, data: { storageKey, originalName, mimeType, sizeBytes }) → POST /canvas/{id}/upload/confirm
uploadFileDirect(canvasId, formData: FormData, onProgress?) → POST /canvas/{id}/upload/direct
  onProgress: (pct: number) => void (0-100)
startTranscription(canvasId, data: { fileUploadId, language? }) → POST /canvas/{id}/transcribe
getTranscriptionJob(canvasId, jobId) → GET /canvas/{id}/transcribe/{jobId}
acceptTranscription(canvasId, jobId, title?) → POST /canvas/{id}/transcribe/{jobId}/accept
```

#### Intercoder Reliability (296-298)
```typescript
computeIntercoder(canvasId, data: { userId, transcriptId }) → POST /canvas/{id}/intercoder
```

#### Collaboration (300-308)
```typescript
getCollaborators(canvasId) → GET /canvas/{id}/collaborators
addCollaborator(canvasId, data: { userId, role? }) → POST /canvas/{id}/collaborators
removeCollaborator(canvasId, userId) → DELETE /canvas/{id}/collaborators/{userId}
```

#### Documents & Region Coding (310-327)
```typescript
createDocument(canvasId, data: { fileUploadId, title, docType, pageCount?, metadata? }) → POST /canvas/{id}/documents
getDocuments(canvasId) → GET /canvas/{id}/documents
deleteDocument(canvasId, docId) → DELETE /canvas/{id}/documents/{docId}
createRegionCoding(canvasId, docId, data: { questionId, pageNumber?, x, y, width, height, note? }) → POST /canvas/{id}/documents/{docId}/regions
getRegionCodings(canvasId, docId) → GET /canvas/{id}/documents/{docId}/regions
deleteRegionCoding(canvasId, docId, regionId) → DELETE /canvas/{id}/documents/{docId}/regions/{regionId}
```

#### Training Center (329-346)
```typescript
createTrainingDocument(canvasId, data: { transcriptId, name, instructions?, goldCodings, passThreshold? }) → POST /canvas/{id}/training
getTrainingDocuments(canvasId) → GET /canvas/{id}/training
getTrainingDocument(canvasId, docId) → GET /canvas/{id}/training/{docId}
deleteTrainingDocument(canvasId, docId) → DELETE /canvas/{id}/training/{docId}
submitTrainingAttempt(canvasId, docId, data: { codings }) → POST /canvas/{id}/training/{docId}/attempt
getTrainingAttempts(canvasId, docId) → GET /canvas/{id}/training/{docId}/attempts
```

#### QDPX Import/Export (348-355)
```typescript
exportQdpx(canvasId) → GET /canvas/{id}/export/qdpx (arraybuffer response)
importQdpx(canvasId, formData: FormData) → POST /canvas/{id}/import/qdpx
```

#### Repository & Insights (357-374)
```typescript
getRepositories() → GET /repositories
createRepository(data: { name, description?, canvasIds? }) → POST /repositories
deleteRepository(repoId) → DELETE /repositories/{repoId}
getInsights(repoId) → GET /repositories/{repoId}/insights
createInsight(repoId, data: { title, content, type? }) → POST /repositories/{repoId}/insights
deleteInsight(repoId, insightId) → DELETE /repositories/{repoId}/insights/{insightId}
```

#### Integrations (376-384)
```typescript
getIntegrations() → GET /integrations
connectIntegration(data: { provider, accessToken, refreshToken?, metadata?, expiresAt? }) → POST /integrations/connect
disconnectIntegration(integrationId) → DELETE /integrations/{integrationId}
```

### Auth API (`authApi` object, 389-433)

#### Legacy Access-Code Auth
```typescript
login(dashboardCode) → POST /auth
register(name, role?) → POST /auth/register
```

#### Email Auth
```typescript
emailSignup(email, password, name) → POST /auth/signup
emailLogin(email, password) → POST /auth/email-login
googleLogin(credential) → POST /auth/google
```

#### Password & Verification
```typescript
forgotPassword(email) → POST /auth/forgot-password
resetPassword(email, token, newPassword) → POST /auth/reset-password
verifyEmail(email, token) → POST /auth/verify-email
resendVerification() → POST /auth/resend-verification
```

#### Account Management
```typescript
getMe() → GET /auth/me
linkAccount(email, password, name?) → POST /auth/link-account
updateProfile(data: { name?, email? }) → PUT /auth/profile
changePassword(currentPassword, newPassword) → PUT /auth/change-password
deleteAccount(password) → DELETE /auth/account
```

### AI Settings API (`aiSettingsApi`, 437-446)
```typescript
getSettings() → GET /ai-settings
updateSettings(data: { provider, apiKey, model?, embeddingModel? }) → PUT /ai-settings
deleteSettings() → DELETE /ai-settings
```

### Team API (`teamApi`, 450-468)
```typescript
list() → GET /teams
create(name) → POST /teams
get(teamId) → GET /teams/{teamId}
invite(teamId, email) → POST /teams/{teamId}/members
removeMember(teamId, userId) → DELETE /teams/{teamId}/members/{userId}
deleteTeam(teamId) → DELETE /teams/{teamId}
```

### Billing API (`billingApi`, 472-481)
```typescript
createCheckout(priceId, plan) → POST /billing/create-checkout
createPortal() → POST /billing/create-portal
getSubscription() → GET /billing/subscription
```

### WISEShift Bridge (`createWiseShiftBridge`, 485-502)
Separate axios client for importing from WISEShift:
```typescript
function createWiseShiftBridge(baseUrl: string, dashboardCode: string)
  → Returns client with:
    getNarratives(params: { ids?, assessmentId? }) → GET /api/v1/research/narratives
    getAssessments() → GET /api/v1/research/assessments
```

---

## 5. CANVAS NODE TYPES

**Path:** `apps/frontend/src/components/canvas/nodes/`

### Base Node Types (8 types, no error boundary):

1. **TranscriptNode** (`TranscriptNode.tsx`)
   - **Props:** `TranscriptNodeData`
   - **Renders:** Scrollable text with overlaid color-coded coding highlights
   - **Features:**
     - Overlapping segment computation for multi-code coverage
     - CodingStripesOverlay (density visualization)
     - QuickCodePopover (select text → assign code)
     - Context menu: duplicate, delete, case assignment
     - Zoom tiers: full, reduced, minimal (detail levels)
   - **Events:** Selection for coding, right-click context menu
   - **Handles:** 4 directional (top, bottom, left, right)

2. **QuestionNode** (`QuestionNode.tsx`)
   - **Props:** `QuestionNodeData` (questionId, text, color, collapsed)
   - **Renders:** Colored card with question text, coding count, parent/child indicators
   - **Features:**
     - Editable text (double-click or button)
     - Color picker
     - Hierarchy support (parent/children questions)
     - Delete with confirmation
     - Click to select in detail panel
   - **Handles:** 4 directional
   - **Resize:** min 200x80 (collapsed: 44px height)

3. **MemoNode** (`MemoNode.tsx`)
   - **Props:** `MemoNodeData` (memoId, title, content, color, collapsed)
   - **Renders:** Sticky-note style card
   - **Features:** Editable title/content, color, delete
   - **Handles:** 4 directional

4. **CaseNode** (`CaseNode.tsx`)
   - **Props:** `CaseNodeData` (caseId, name, attributes)
   - **Renders:** Case identifier, attribute list
   - **Features:** Edit attributes, delete
   - **Handles:** 4 directional

5. **GroupNode** (`GroupNode.tsx`)
   - **Props:** Visual grouping/theming for related nodes
   - **Renders:** Transparent container
   - **Features:** Collapse/expand, member selection
   - **Handles:** 4 directional

6. **StickyNoteNode** (`StickyNoteNode.tsx`)
   - **Props:** `StickyNoteNodeData` (id, text, color)
   - **Renders:** Small sticky note
   - **Features:** Quick text, color, delete
   - **Handles:** Minimal (4 directional)

7. **RerouteNode** (`RerouteNode.tsx`)
   - **Props:** Waypoint for edge routing
   - **Renders:** Small circular node
   - **Features:** Draggable for edge control
   - **Handles:** 4 directional

8. **SearchResultNode** (`SearchResultNode.tsx`)
   - **Props:** Search results display
   - **Renders:** List of matching items
   - **Features:** Highlight, click to focus
   - **Handles:** 4 directional

### Computed Node Types (10 types, wrapped with error boundary):

1. **StatsNode** (`StatsNode.tsx`)
   - **Config:** `{ groupBy: 'question' | 'transcript' }`
   - **Result:** `StatsResult { items: { label, count }[] }`
   - **Renders:** Bar/pie chart (recharts)
   - **Features:** Chart type toggle, groupBy config
   - **Run:** Computes code frequency statistics

2. **WordCloudNode** (`WordCloudNode.tsx`)
   - **Result:** Word frequencies from codings
   - **Renders:** Word cloud visualization (@visx/wordcloud)

3. **CooccurrenceNode** (`CooccurrenceNode.tsx`)
   - **Result:** Code co-occurrence matrix
   - **Renders:** Heatmap showing how codes appear together

4. **MatrixNode** (`MatrixNode.tsx`)
   - **Result:** Question × Transcript matrix of coding counts
   - **Renders:** Table/heatmap

5. **ComparisonNode** (`ComparisonNode.tsx`)
   - **Result:** Side-by-side question comparison
   - **Renders:** Multi-bar chart

6. **ClusterNode** (`ClusterNode.tsx`)
   - **Result:** Hierarchical clustering of codes
   - **Renders:** Dendrogram

7. **CodingQueryNode** (`CodingQueryNode.tsx`)
   - **Config:** Query syntax (AND, OR, NOT)
   - **Result:** Codings matching query
   - **Renders:** Filtered coding list

8. **SentimentNode** (`SentimentNode.tsx`)
   - **Result:** Sentiment scores from text analysis
   - **Renders:** Sentiment distribution chart

9. **TimelineNode** (`TimelineNode.tsx`)
   - **Result:** Codings over time
   - **Renders:** Timeline chart

10. **GeoMapNode** (`GeoMapNode.tsx`)
    - **Result:** Geographic data from locations
    - **Renders:** Map visualization

**Additional Nodes:**

11. **DocumentNode** (`DocumentNode.tsx`)
    - **Props:** Document metadata, page preview
    - **Features:** Region coding overlay, page navigation

12. **DocumentPortraitNode** (`DocumentPortraitNode.tsx`)
    - **Props:** Document visualization
    - **Renders:** Multi-page document preview

All computed nodes wrapped in error boundary:
```typescript
function withErrorBoundary(NodeComponent) {
  const WrappedNode = (props) => (
    <ErrorBoundary>
      <NodeComponent {...props} />
    </ErrorBoundary>
  );
  return WrappedNode;
}
```

---

## 6. CANVAS PANELS & MODALS

**Path:** `apps/frontend/src/components/canvas/panels/`

### Key Panels:

1. **CodeNavigator** (`CodeNavigator.tsx`)
   - **Layout:** Left sidebar, collapsible
   - **Displays:** Hierarchical question tree
   - **Features:**
     - Sort by count or name
     - Filter by search
     - Favorites/bookmarking
     - Click to select question → opens detail panel
   - **Tabs:** Codes, Sources (transcripts), Cases

2. **CanvasToolbar** (`CanvasToolbar.tsx`)
   - **Layout:** Top bar
   - **Buttons:** Add Transcript, Code, Memo, Auto-Code, etc.
   - **Features:** Quick-add menu

3. **CodingDetailPanel** (`CodingDetailPanel.tsx`)
   - **Layout:** Right sidebar
   - **Displays:** Codings for selected question
   - **Features:**
     - Filter by transcript
     - Annotate individual codings
     - Reassign to different code
     - Delete coding
   - **Opens when:** User clicks question node

4. **CanvasContextMenu** (`CanvasContextMenu.tsx`)
   - **Trigger:** Right-click on canvas background
   - **Actions:** Add transcript, code, memo, group, etc.
   - **Position:** Absolute at cursor

5. **NodeContextMenu** (`NodeContextMenu.tsx`)
   - **Trigger:** Right-click on node
   - **Actions:** Edit, delete, duplicate, duplicate with Alt+drag
   - **Position:** Absolute at cursor

6. **EdgeContextMenu** (`EdgeContextMenu.tsx`)
   - **Trigger:** Right-click on edge
   - **Actions:** Edit label, delete

7. **QuickAddMenu** (`QuickAddMenu.tsx`)
   - **Trigger:** Canvas double-click or toolbar button
   - **Options:** Select node type to add
   - **Position:** Popup at click location

8. **CanvasSearchOverlay** (`CanvasSearchOverlay.tsx`)
   - **Trigger:** Ctrl+F or toolbar search
   - **Features:**
     - Search codes, transcripts, memos
     - Highlight matching nodes
     - Navigate matches
   - **Overlay:** Full-canvas search bar

9. **CommandPalette** (`CommandPalette.tsx`)
   - **Trigger:** Ctrl+K
   - **Features:**
     - Action search (create node, run analysis, etc.)
     - Recent actions
     - Keyboard navigation

10. **KeyboardShortcutsModal** (`KeyboardShortcutsModal.tsx`)
    - **Trigger:** ? key
    - **Displays:** All available shortcuts
    - **Features:** Customizable shortcuts with modal UI

11. **OnboardingTour** (`OnboardingTour.tsx`)
    - **Tour:** First-time user walkthrough
    - **Data attributes:** `data-tour="canvas-main"`, etc.
    - **State:** `onboardingComplete` in uiStore

12. **Lazy-Loaded Modals** (imported with React.lazy):
    - **ExcerptBrowserModal** - Browse all coded text segments
    - **RichExportModal** - Export canvas with formatting
    - **IntercoderReliabilityModal** - Calculate Kappa between coders
    - **CodeWeightingPanel** - Weight codes for analysis
    - **CrossCaseAnalysisModal** - Compare cases
    - **PresentationMode** - Full-screen presentation
    - **AiAutoCodeModal** - Configure AI auto-coding
    - **IntercoderPanel** - Manage intercoder reliability

13. **Additional Panels:**
    - **PresenceAvatars** - Show active collaborators
    - **CollabCursors** - Show remote cursor positions
    - **CanvasTabBar** - Multi-canvas tab switching
    - **SelectionToolbar** - Multi-node alignment/distribution
    - **AiSuggestPanel** - AI coding suggestions panel
    - **AiSetupGuide** - Configure AI API keys

### Key Panel Features:

**Popover Components:**
- **QuickCodePopover** (`QuickCodePopover.tsx`)
  - Appears when text selected in transcript
  - Shows available codes to assign
  - Click code → create coding with selected text

- **CodingSegmentPopover** (`CodingSegmentPopover.tsx`)
  - Shows on hover over coded segment
  - Displays code name, transcript snippet
  - Action buttons: annotate, reassign, delete

- **AnnotationPopover** (`AnnotationPopover.tsx`)
  - Inline annotation editor for codings
  - Rich text or plain text notes

---

## 7. OFFLINE SUPPORT

### IndexedDB Caching (`offlineStorage.ts`, 37 lines)

**Database:** `qualcanvas-offline`
**Object Store:** `canvases` (keyed by canvas id)

```typescript
async function cacheCanvas(canvas: CanvasDetail): Promise<void>
  → IDBTransaction with objectStore.put(canvas)
  → Called after openCanvas success (canvasStore.ts line 169)

async function getCachedCanvas(id: string): Promise<CanvasDetail | null>
  → IDBTransaction with objectStore.get(id)
  → Used as fallback if API fails (canvasStore.ts line 172)
  → Shows toast: "Loaded from offline cache"

async function clearCachedCanvas(id: string): Promise<void>
  → IDBTransaction with objectStore.delete(id)
```

### Offline Queue (`offlineQueue.ts`, 44 lines)

**Storage Key:** `qualcanvas-offline-queue`

```typescript
interface QueuedOperation {
  id: string (UUID)
  method: string
  url: string
  body?: unknown
  timestamp: number
}

queueOperation(op: Omit<QueuedOperation, 'id' | 'timestamp'>) → void
  → Generates uuid and timestamp
  → Appends to queue in localStorage

getQueue(): QueuedOperation[] → Parses localStorage, fallback []

clearQueue(): void → Removes localStorage key

async function replayQueue(apiBase: string): Promise<void>
  → Iterates queue
  → Fetches each operation with method, body
  → Stops on first failure (remaining ops stay queued)
  → Clears queue on success
```

**Usage:** Would integrate with offline detection middleware (not currently active in frontend).

---

## 8. INTERNATIONALIZATION (i18n)

**Path:** `apps/frontend/src/i18n/`

### Setup (`index.ts`, 22 lines)

```typescript
i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en.json },
    es: { translation: es.json },
    fr: { translation: fr.json },
    de: { translation: de.json },
  },
  lng: 'en',
  fallbackLng: 'en',
  interpolation: { escapeValue: false },
});
```

**Library:** i18next + react-i18next

### Translation Keys (en.json structure):

**Namespace:** `translation` (single flat structure)

**Key Categories:**
- `common.*` - Save, Cancel, Delete, Create, Close, Search, Loading, etc.
- `canvas.*` - Coding Canvases, New Canvas, Transcript, Code, Memo, Workspaces
- `auth.*` - Sign In, Sign Up, Sign Out, Email, Password, Forgot Password, etc.
- `toolbar.*` - Transcript, Code, Memo, Survey, AutoCode, Arrange, Share, Ethics
- `pricing.*` - Title, Subtitle, Plans, Features, Pricing comparison
- `account.*` - Profile, Plan & Usage, Billing settings
- ... (more namespaces in en.json)

### Language Switching

**Mechanism:** i18next doesn't expose language selection UI in frontend directly visible yet. Would use:
```typescript
import { useTranslation } from 'react-i18next';

const { i18n } = useTranslation();
i18n.changeLanguage('es'); // Switch to Spanish
```

**Supported Languages:** en, es, fr, de (4 languages)

---

## 9. PWA & SERVICE WORKER

**Config:** `vite.config.ts`, lines 9-33

```typescript
VitePWA({
  registerType: 'autoUpdate',
  manifest: {
    name: 'QualCanvas - Qualitative Coding',
    short_name: 'QualCanvas',
    theme_color: '#3B82F6',
    background_color: '#ffffff',
    display: 'standalone',
    start_url: '/',
    icons: [{ src: '/favicon.svg', sizes: 'any', type: 'image/svg+xml' }],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff,woff2}'],
    runtimeCaching: [
      {
        urlPattern: /^https?:\/\/localhost:\d+\/api\//,
        handler: 'NetworkFirst',
        options: {
          cacheName: 'api-cache',
          expiration: { maxEntries: 50, maxAgeSeconds: 300 },
        },
      },
    ],
  },
});
```

**Features:**
- **Auto-update:** SW checks for updates on page load
- **Display:** Standalone (app-like, no address bar)
- **Static caching:** `globPatterns` — JS, CSS, HTML, images, fonts
- **API caching:**
  - Pattern: `/api/*` routes
  - Strategy: `NetworkFirst` (try network, fallback to cache)
  - Cache name: `api-cache`
  - Max 50 entries, expire after 300s (5 minutes)

**Manifest:** `public/manifest.json` (18 lines)
- Same name/short_name/theme_color
- Orientation: any
- Categories: productivity, education

---

## 10. KEY COMPONENT INTERACTIONS

### 10.1 How CanvasWorkspace Orchestrates Everything

**File:** `CanvasWorkspace.tsx`, ~1256 lines

**Entry Flow:**
```
CanvasPage (router)
  → CanvasWorkspace (main component)
    → Initializes all hooks
    → Renders ReactFlow with nodes, edges, panels
```

**Initialization (lines 159-320):**

1. **Granular Store Selectors** (160-177)
   - `useActiveCanvas()` - Gets current canvas data
   - `useSelectedQuestionId()` - Detail panel focus
   - `useUIStore()` - Dark mode, edge style, scroll mode
   - `useCanvasStore()` - All actions

2. **Session Management** (196)
   - `useSessionTimeout()` - 30-min warning, 35-min logout

3. **Real-time Collaboration** (199)
   - `useCollaboration({ canvasId })` - Socket events, cursor sync
   - Only for email-authenticated users

4. **AI Features** (201-217)
   - `useAiConfigStore()` - Check if AI configured
   - `useAiSuggestions()` - Get/accept suggestions
   - Guard: `requireAiConfig()` - Prompts setup if unconfigured

5. **ReactFlow State** (219-220)
   - `useNodesState(initialNodes)` → setNodes, onNodesChange
   - `useEdgesState(initialEdges)` → setEdges, onEdgesChange

6. **UI Toggles** (228-243)
   - Navigator, shortcuts, search, command palette
   - Context menus, quick add menu
   - All set via useState, closed on Escape

7. **Canvas Utilities** (251-303)
   - Snap to grid, muted nodes, drag-drop files
   - Clipboard for copy/paste
   - Tab management (localStorage `canvas-open-tabs`)
   - Viewport bookmarks, visual groups, sticky notes
   - Undo/redo history, node colors, reroute nodes
   - Focus/presentation modes

**Node Building (342-350+):**
```typescript
buildNodes(): Node[] {
  if (!activeCanvas) return [];
  
  // For each entity type: transcripts, questions, memos, cases, computed nodes
  // Create ReactFlow node with:
  // - id: `{type}-{entityId}`
  // - type: node type from nodeTypes map
  // - position: from posMap (persisted layout) or default
  // - data: entity data + callbacks
  // - selected/hidden/style based on UI state
  
  // Filter/highlight based on search results
  return result;
}
```

**Edge Building:**
```typescript
// Coding edges: question → transcript (invisible, highlight text)
// Relation edges: case ↔ case, question ↔ question
// Both edge types: CodingEdge, RelationEdge
```

**Keyboard Handling (useCanvasKeyboard):**
- Passed `CanvasKeyboardOptions` with all state/callbacks
- Handles shortcuts from `useShortcutStore`
- Escape dismisses modals
- Copy/paste uses clipboard ref
- Undo/redo with history hook

**Layout Saving:**
```typescript
saveTimeoutRef.debounced(() => {
  saveLayout(nodes.map(n => ({
    nodeId: n.id,
    nodeType: n.type,
    x: n.position.x,
    y: n.position.y,
    width: n.measured?.width || 280,
    height: n.measured?.height || 200,
    collapsed: n.data?.collapsed,
  })))
})
```

**Render Structure:**
```jsx
<ErrorBoundary>
  <div ref={workspaceRef} className="canvas-workspace">
    <ReactFlow
      nodes={nodes}
      edges={edges}
      nodeTypes={nodeTypes} // 18 types
      edgeTypes={edgeTypes} // CodingEdge, RelationEdge
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={handleConnect}
      onSelectionChange={handleSelectionChange}
      onContextMenu={handleCanvasContextMenu}
      rfInstanceRef={rfInstanceRef}
    >
      <Background variant={BackgroundVariant.Dots} />
      <Controls />
      <MiniMap />
    </ReactFlow>
    
    <CodeNavigator />
    <CanvasToolbar />
    <CodingDetailPanel /> {/* if selectedQuestionId */}
    <KeyboardShortcutsModal />
    <CanvasSearchOverlay />
    <CommandPalette />
    <OnboardingTour />
    <CanvasContextMenu />
    <NodeContextMenu />
    <EdgeContextMenu />
    <SelectionToolbar />
    <QuickAddMenu />
    <CanvasTabBar />
    <AiSuggestPanel />
    <AiSetupGuide />
    <PresenceAvatars />
    <CollabCursors />
    <ConfirmDialog />
    
    {/* Lazy-loaded modals */}
    <Suspense fallback={null}>
      {showExcerpts && <ExcerptBrowserModal />}
      {showRichExport && <RichExportModal />}
      {showIntercoder && <IntercoderReliabilityModal />}
      {showWeighting && <CodeWeightingPanel />}
      {showCrossCase && <CrossCaseAnalysisModal />}
      {showAiAutoCode && <AiAutoCodeModal />}
      {presentationMode && <PresentationMode />}
    </Suspense>
  </div>
</ErrorBoundary>
```

---

### 10.2 Coding Workflow: Select Text → Assign Code → Edge Appears

**User Action Sequence:**

1. **User selects text in TranscriptNode**
   ```
   Selection event in transcript content
   → onSelectText handler fires
   → Computes startOffset, endOffset
   → setPendingSelection({ transcriptId, startOffset, endOffset, codedText })
   → QuickCodePopover shows available codes
   ```

2. **User clicks code in popover**
   ```
   Click on code option
   → handleAssignCode(questionId)
   → createCoding(transcriptId, questionId, startOffset, endOffset, codedText)
   → API: POST /canvas/{id}/codings
   ```

3. **Backend response:**
   ```
   Returns: CanvasTextCoding {
     id, canvasId, questionId, transcriptId,
     startOffset, endOffset, codedText,
     annotation, createdAt
   }
   ```

4. **Frontend updates:**
   ```
   canvasStore.activeCanvas.codings = [...codings, newCoding]
   setPendingSelection(null) // Clear selection
   emitSocketEvent('canvas:coding-added', ...)
   ```

5. **UI reflects change:**
   ```
   Transcript re-renders with new highlights
   CodingStripesOverlay updates density
   DetailPanel refreshes coding count for question
   No edge added yet — codings are text highlights, not graph edges
   ```

**Note:** Codings create visual highlights in transcripts, not traditional edges. Relations (case ↔ case, question ↔ question) create visible edges with labels.

---

### 10.3 Real-Time Collaboration Sync

**Socket.io Integration (`socket.ts`, 63 lines):**

```typescript
const SOCKET_URL = import.meta.env.VITE_WS_URL || origin
socket = io(SOCKET_URL, {
  auth: { token: jwt },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 10,
  reconnectionDelay: 1000,
})
```

**Collaboration Events (`useCollaboration.ts`):**

**Emitted (from local user):**
- `canvas:join { canvasId }` - Enter canvas room
- `canvas:cursor-moved { x, y }` - Throttled 50ms
- `canvas:node-moved { nodeId, position }` - Throttled 100ms
- `canvas:node-added { canvasId, data: { type, id } }` - Socket event from canvasStore
- `canvas:coding-added { canvasId, coding }` - Socket event from canvasStore
- `canvas:coding-deleted { canvasId, codingId }` - Socket event
- `canvas:transcript-updated { canvasId, transcriptId }` - Socket event
- `canvas:node-deleted { canvasId, nodeId, nodeType }` - Socket event

**Listened (from other users):**
- `presence:updated { canvasId, users: CollaboratorPresence[] }` - Active users list
- `presence:current { canvasId, users, self }` - Initial presence
- `cursor:moved { userId, userName, x, y }` - Remote cursor
- `canvas:node-added` - Skip if from self (state already updated), refresh if from other
- `canvas:coding-added` - Refresh canvas
- `canvas:transcript-updated` - Refresh canvas
- `canvas:node-deleted` - Refresh canvas

**CollaboratorPresence:**
```typescript
{ userId, name, color, cursor?: { x, y } }
```

**Cursors Map:**
```typescript
Map<userId, { x, y, name, color }>
```

**Refresh Strategy:**
- Local actions update state optimistically
- Socket events from others trigger `refreshCanvas()` to sync
- Prevents double-updates by checking `eventData.userId === localUserId`

---

## 11. KEY TECHNICAL DETAILS

### Build Configuration (vite.config.ts)

**Port:** 5174 (dev server)
**Proxy:** `/api` → `http://localhost:3007` (backend)

**Manual Chunks:**
```typescript
'react-vendor': ['react', 'react-dom', 'react-router-dom']
'viz-vendor': ['@xyflow/react', 'dagre', 'recharts']
'visx-vendor': ['@visx/wordcloud', '@visx/text']
```

**Alias:** `@` → `./src`

### Dark Mode Implementation

**Storage:** `qualcanvas-ui` store, `darkMode` flag
**DOM:** `.dark` class on `document.documentElement`
**Initial:** System preference detection via `window.matchMedia('(prefers-color-scheme: dark)')`
**Styling:** Tailwind dark mode with `dark:` prefix, e.g. `dark:bg-gray-800`

### Error Handling

**Global:**
- ErrorBoundary at app level (App.tsx)
- Catches render errors, shows error UI with "Try again"
- Optional `onError` callback to Sentry

**Component Level:**
- ErrorBoundary wraps computed nodes (error isolation)
- API errors show toast notifications
- 401 triggers logout redirect
- 403 PLAN_LIMIT_EXCEEDED fires custom event

### Key Dependencies

| Package | Version | Purpose |
|---------|---------|---------|
| react | 18.3.1 | UI framework |
| @xyflow/react | 12.10.1 | Canvas graph library |
| zustand | 5.0.3 | State management |
| axios | 1.7.9 | HTTP client |
| socket.io-client | 4.8.3 | Real-time collaboration |
| i18next | 25.10.4 | Internationalization |
| recharts | 2.15.0 | Data visualization (bar, pie charts) |
| @visx/wordcloud | 3.12.0 | Word cloud visualization |
| dagre | 0.8.5 | Graph layout algorithm |
| tailwindcss | 3.4.17 | CSS framework |
| react-hot-toast | 2.4.1 | Toast notifications |

---

This concludes the comprehensive technical documentation of the QualCanvas frontend. All major areas have been covered with exact details, types, line references, and behavioral specifications.