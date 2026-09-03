# Sprint F — 85-Second Onboarding

## Goal

Replace the 22-step guided tour (skipped every time) with a 5-screen, 85-second flow that gets new users from signup to first coded excerpt in <90 seconds. Target: median time-to-first-coded-excerpt <90s, completion rate >70%.

## Scope

- 5-screen onboarding flow (personalization → template → ingest → AI codes → first manual code)
- 5 starter templates with sample transcripts
- Persistent dismissable checklist (Asana-style, bottom-right)
- 4 just-in-time tooltips
- Move existing 22-step tour to `Help → Take the full product tour`
- Telemetry: `onboarding_started`, `onboarding_step_completed`, `onboarding_skipped`, `first_excerpt_coded`, `onboarding_completed_seconds`

## Out of scope

- Custom template upload (Pro+ feature, later sprint)
- Onboarding for returning users (just skip back to canvas)
- Localized templates beyond English

## Timing budget

| Step                          | Time | Cumulative |
| ----------------------------- | ---- | ---------- |
| Login → personalization       | 15s  | 15s        |
| Template select               | 10s  | 25s        |
| Transcript paste/upload       | 20s  | 45s        |
| AI-suggested codes appear     | 5s   | 50s        |
| Accept/edit one code          | 15s  | 65s        |
| Highlight excerpt, apply code | 20s  | 85s        |

## Component tree

```
apps/frontend/src/components/onboarding/
├── OnboardingFlow.tsx              # top-level conditional render
├── Screen1_Personalization.tsx     # 3-question modal (15s)
├── Screen2_TemplateGallery.tsx     # 4-card grid (10s)
├── Screen3_TranscriptIngest.tsx    # paste/upload tabs (20s)
├── Screen4_AiCodeReview.tsx        # suggestions panel (15s)
├── Screen5_FirstManualCode.tsx     # text-select + code popup (20s)
├── OnboardingChecklist.tsx         # persistent bottom-right widget
├── JustInTimeTooltip.tsx           # 4 tooltips fire on first hover
└── utils/onboardingState.ts        # JSON state persistence helper
```

## Database changes

**`C:\JM Programs\QualCanvas\apps\backend\prisma\schema.prisma`** User model:

```diff
 model User {
   ...
+  onboardingState     String?  @default("{}")  // JSON: { step, completedAt, dismissedTooltips: [] }
+  onboardingCompletedAt DateTime?
   ...
 }

+model CanvasTemplate {
+  id              String   @id @default(cuid())
+  name            String
+  description     String?
+  category        String   @default("methodology")
+  method          String?  // 'interviews' | 'focus_groups' | 'field_notes' | 'open_ended_survey'
+  sampleQuestions String   // JSON: [{text, color}]
+  sampleTranscript String  // text content
+  sampleMemos     String?  // JSON: [{title, content}]
+  isPublic        Boolean  @default(true)
+  createdBy       String?
+  createdAt       DateTime @default(now())
+  updatedAt       DateTime @updatedAt
+  creator         User?    @relation(fields: [createdBy], references: [id], onDelete: SetNull)
+
+  @@unique([name, createdBy])
+  @@index([isPublic, category])
+}
```

Migration: `npx prisma migrate dev --name onboarding_and_templates`

## Templates to seed

**`C:\JM Programs\QualCanvas\apps\backend\prisma\seed.ts`** (extend existing seed):

```typescript
const TEMPLATES = [
  {
    name: 'Thematic Analysis (Braun & Clarke)',
    description: 'Reflexive 6-phase thematic analysis. Pre-seeded with starter codes and reflexive memo prompts.',
    category: 'methodology',
    method: 'interviews',
    sampleQuestions: JSON.stringify([
      { text: 'Pain Point', color: '#EF4444' },
      { text: 'Strategy/Workaround', color: '#F59E0B' },
      { text: 'Emotional Reaction', color: '#8B5CF6' },
      { text: 'Surprise / Aha', color: '#10B981' },
      { text: 'Question / Confusion', color: '#3B82F6' },
    ]),
    sampleTranscript: `Interviewer: Tell me about the last time you felt frustrated using your team's research tools.

Participant: Oh, that was just yesterday. I was trying to share a coding scheme with my advisor and I couldn't figure out how to export it in a way she could open. So I just took screenshots and emailed them. Which is, like, 2010 behavior, you know?

[... 600 more words of sample interview content ...]`,
    sampleMemos: JSON.stringify([
      {
        title: 'Reflexive memo prompt',
        content: 'What assumptions did you bring to this transcript? What expectations were confirmed or disconfirmed?',
      },
    ]),
  },
  {
    name: 'Grounded Theory',
    description: 'Open / axial / selective coding workflow with constant comparison memos.',
    method: 'interviews',
    sampleQuestions: JSON.stringify([
      { text: 'Open code', color: '#3B82F6' },
      { text: 'Axial category', color: '#8B5CF6' },
      { text: 'Selective theme', color: '#EF4444' },
      { text: 'In vivo quote', color: '#10B981' },
    ]),
    // ...
  },
  {
    name: 'UXR Pain-Points',
    description: 'User research interviews focused on usability and emotional response.',
    method: 'interviews',
    sampleQuestions: JSON.stringify([
      { text: 'Pain Point', color: '#EF4444' },
      { text: 'Goal', color: '#10B981' },
      { text: 'Quote', color: '#3B82F6' },
      { text: 'Surprise', color: '#F59E0B' },
      { text: 'Question', color: '#8B5CF6' },
    ]),
    // ...
  },
  {
    name: 'Support-Ticket Mining',
    method: 'open_ended_survey',
    // ...
  },
  {
    name: 'NPS Theme Extraction',
    method: 'open_ended_survey',
    // ...
  },
];

for (const tmpl of TEMPLATES) {
  await prisma.canvasTemplate.upsert({
    where: { name_createdBy: { name: tmpl.name, createdBy: null } },
    create: { ...tmpl, isPublic: true },
    update: tmpl,
  });
}
```

## File-level changes (key components)

### `Screen1_Personalization.tsx`

3 questions, auto-advance, no "Next" button:

- Q1: "What are you researching?" (free-text, 80 char)
- Q2: "Method?" (pill buttons: Interviews / Focus groups / Field notes / Open-ended survey / Other)
- Q3: "Just you, or a team?" (binary Solo / Team)

Skip link: "Skip — I'll set up later"

### `Screen2_TemplateGallery.tsx`

4 cards filtered by Q2 answer + Blank canvas option.

- Each card shows mini-preview thumbnail
- "Use sample data" toggle (default ON)

### `Screen3_TranscriptIngest.tsx`

Two tabs: **Paste** (focused) + **Upload**. Min 100 chars. Sample interview fallback link.

### `Screen4_AiCodeReview.tsx`

Right panel slides in with 5 AI suggestions + 2 pre-applied yellow highlights in transcript.
Coachmark: "We pre-coded these two. Try highlighting another."

### `Screen5_FirstManualCode.tsx`

User selects text → floating action bar (Notion-style): `Apply code ▾` / `New code` / `Add memo` / `Link to node`. 200ms confetti on first code. Toast "First coded excerpt! View it on the canvas →".

### `OnboardingChecklist.tsx`

Bottom-right widget, collapsed after first task:

- ☑ Code your first excerpt
- ☐ Create a theme (group 2+ codes)
- ☐ Run an analysis
- ☐ Export to CSV
- ☐ Invite a collaborator (Solo: "Upgrade for sharing")

### `JustInTimeTooltip.tsx`

4 tooltips fire on first hover (dismissed permanently after):

1. Codebook panel: "Drag a code onto an excerpt, or use Ctrl+E."
2. Analysis menu: "Word cloud, frequency, co-occurrence — all run on your codes."
3. Ctrl+K first press: "Command palette — search anything."
4. Second canvas: "Tip: canvases share your codebook."

## Move existing tour

```bash
git mv apps/frontend/src/components/canvas/panels/OnboardingTour.tsx \
       apps/frontend/src/components/help/FullProductTour.tsx
```

Update Help menu to add: "Take the full product tour" → opens `FullProductTour` modal. Don't auto-fire.

## API endpoint

**`POST /api/v1/canvas/templates/:templateId/instantiate`** (new):
Creates a new canvas from a template — seeds codes + sample transcript + sample memo.

## Tests

- E2E: complete the 5-screen flow → assert `onboardingCompletedAt` is set + `first_excerpt_coded` event fires
- E2E: Skip personalization → land on Screen 2 with Interview template defaulted
- Backend: template instantiation creates canvas with pre-seeded codes
- Performance: full flow completes in <120s in CI (allowing slack vs 90s target)

## Acceptance criteria

- [ ] All 5 screens implemented
- [ ] 5 templates seeded and instantiable
- [ ] Onboarding state persisted in `User.onboardingState`
- [ ] AI suggest-codes endpoint integrated for Screen 4
- [ ] Checklist widget visible until all 5 tasks complete
- [ ] 4 just-in-time tooltips fire correctly
- [ ] 22-step tour moved to /help, not auto-fired
- [ ] Telemetry: 5 events firing with correct payloads
- [ ] Median time-to-first-coded-excerpt in CI = <120s

## Rollback

- Feature flag: `ONBOARDING_V2_ENABLED` env var
- If disabled, old 22-step tour fires
- Templates stay in DB (no-op if unused)

## Telemetry

- `onboarding_started` { step: 1 }
- `onboarding_step_completed` { step: 1-5, seconds_elapsed }
- `onboarding_skipped` { at_step }
- `first_excerpt_coded` { canvas_id, code_text, seconds_since_signup }
- `onboarding_completed_seconds` { total_seconds }
- `template_selected` { template_name, method }

Target metrics (measure after 30 days):

- Median time-to-first-coded-excerpt: <90s (vs current "minutes")
- Completion rate: >70% (vs estimated <30% for 22-step tour)
- Sample-data usage: >80% of templates instantiated with sample-data toggle

## Effort

**3-4 days.** Components 2 days. Backend templates + seed 1 day. Tests + polish 1 day.

## Owner

TBD

## Commit message

```
feat(onboarding): 85-second flow with templates and AI pre-coding

- 5-screen flow: personalization → template → ingest → AI codes → first manual code
- 5 starter templates seeded (Braun & Clarke, Grounded Theory, UXR Pain-Points, Support Tickets, NPS)
- Persistent dismissable checklist (Asana-style)
- 4 just-in-time tooltips on first hover
- Old 22-step tour moved to Help → "Take the full product tour" (not auto-fired)
- New telemetry: onboarding_started, _step_completed, _skipped, first_excerpt_coded, _completed_seconds
- Migration: add User.onboardingState + CanvasTemplate model

Target: median TTF-coded-excerpt <90s, completion >70%.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
