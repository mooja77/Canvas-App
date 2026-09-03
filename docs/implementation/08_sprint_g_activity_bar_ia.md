# Sprint G — VS Code Activity Bar IA + Cmd+K Coverage

## Goal

Solve the "16 features hidden in 2 dropdowns" problem by adopting a VS Code-style activity bar that swaps sidebar panels per activity, plus completing Cmd+K coverage so every feature is findable via fuzzy search.

## Scope

- Activity bar (left rail, 48px, 8 icons)
- Sidebar panels (240px, swap by activity): Canvases / Codebook / Cases / Analysis / AI / Collaborate / Quality / Schedule
- Right Inspector panel (280px, contextual to selection)
- Canvas tab strip (Canvas / Codebook / Cases / Analysis / AI lenses)
- Status bar at bottom
- Remove Tools + AI dropdowns from toolbar
- Register every Tools/AI feature in `shortcutStore.ts` so Cmd+K finds them
- Mobile responsive (390/768 breakpoints)

## Out of scope

- Workspace presets (After Effects pattern) — defer
- Tear-off panels — defer
- Custom Inspector pinning — defer

## Layout

```
┌──┬─────────────────────┬─────────────────────────────────┬──────────────┐
│ A│ SIDEBAR (B)         │ CANVAS / EDITOR (C)             │ INSPECTOR(D) │
│ c│ (swaps by activity) │                                 │ (contextual) │
│ t│                     │ Breadcrumb: Project › Canvas    │              │
│ i│ [+ New]             │ Tabs: Canvas | Codebook | Cases │              │
│ v│ ─ Recent            │       | Analysis | AI           │              │
│ i│ ─ Pinned            │                                 │              │
│ t│ ─ All canvases      │ [React Flow workspace]          │              │
│ y│ ─ Shared with me    │                                 │              │
└──┴─────────────────────┴─────────────────────────────────┴──────────────┘
│ STATUS: words 12,847/50,000 | codes 34 | plan: Pro | ws: ok | ?         │
```

## Activity bar (8 icons)

```
📋 Canvases       ← Default landing (canvas list)
📚 Codebook       ← Codebook table + hierarchy
👥 Cases          ← Cases list + Cross-Case
📊 Analyze        ← 10 analysis tools
✨ AI             ← Auto-Code, AI Chat, Summarize, history
🤝 Collaborate    ← Share, comments, intercoder
🛡️ Quality        ← Kappa, Krippendorff α, Weights, Ethics, Audit log
📅 Schedule       ← Research Calendar
──────────────────
⚙️ Settings        ← Bottom; account, AI keys, billing
```

## Component tree

```
apps/frontend/src/components/canvas/
├── ActivityBar.tsx                    # 48px left rail
├── Sidebar.tsx                        # 240px, lazy-loads sub-panels
├── Inspector.tsx                      # 280px right, contextual
├── StatusBar.tsx                      # 24px bottom
├── CanvasTabBar.tsx                   # exists, expand to 5 tabs
└── panels/
    ├── CanvasesPanel.tsx              # Recent / Pinned / All / Shared
    ├── CodebookPanel.tsx              # Code list + hierarchy
    ├── CasesPanel.tsx                 # Cases list
    ├── AnalysisPanel.tsx              # 10 tools + saved runs
    ├── AiPanel.tsx                    # AI sessions + history
    ├── CollaboratePanel.tsx           # Share, comments, team
    ├── QualityPanel.tsx               # Kappa, α, Weights, Ethics, Audit
    └── SchedulePanel.tsx              # Research Calendar
```

## Where each previously-hidden feature lives

| Current location          | New home                                           |
| ------------------------- | -------------------------------------------------- |
| Tools → Codebook          | Codebook activity panel + canvas Codebook tab      |
| Tools → Cases             | Cases activity panel + canvas Cases tab            |
| Tools → Cross-Case        | Cases panel (button "Compare cases")               |
| Tools → Hierarchy         | Codebook panel (toggle view)                       |
| Tools → Kappa             | Quality panel ("Compute reliability")              |
| Tools → Weights           | Quality panel ("Code weights")                     |
| Tools → Coding Stripes    | Inspector when transcript selected (toggle)        |
| Tools → Dashboard         | Canvas Analysis tab                                |
| Tools → Ethics            | Quality panel ("Ethics & consent")                 |
| Tools → Excerpts          | Inspector when code selected ("View all excerpts") |
| Tools → Research Calendar | Schedule activity panel                            |
| Tools → Edges             | Inspector when edge selected                       |
| AI → Auto-Code            | AI activity panel ("Run auto-code") + Cmd+K        |
| AI → AI Code              | Inline on text selection (Sprint H) + AI panel     |
| AI → AI Chat              | Global Cmd+J shortcut + AI panel                   |
| AI → Summarize            | AI panel ("Summarize canvas/transcript/codings")   |

## Cmd+K coverage

**`C:\JM Programs\QualCanvas\apps\frontend\src\stores\shortcutStore.ts`**

Add every action to the registry (currently has Add Code, Add Memo, Fit View, Toggle Snap, Toggle Navigator, Switch Dark Mode, Toggle Coding Stripes only):

```typescript
const actions: ActionEntry[] = [
  // Existing — keep
  { id: 'add_code', label: 'Add new code', shortcut: 'Cmd+Shift+C', category: 'Create' },
  { id: 'add_memo', label: 'Add memo', category: 'Create' },
  { id: 'fit_view', label: 'Fit view', shortcut: 'F', category: 'View' },
  { id: 'toggle_snap', label: 'Toggle snap to grid', shortcut: 'G', category: 'View' },
  { id: 'toggle_navigator', label: 'Toggle navigator sidebar', category: 'View' },
  { id: 'toggle_dark', label: 'Switch to dark mode', category: 'View' },
  { id: 'toggle_stripes', label: 'Toggle coding stripes', category: 'View' },

  // NEW — Codebook
  { id: 'open_codebook', label: 'Open codebook', category: 'View', icon: '📚' },
  { id: 'view_hierarchy', label: 'View code hierarchy', category: 'View' },
  { id: 'export_codebook_csv', label: 'Export codebook to CSV', category: 'Export' },

  // NEW — Cases
  { id: 'open_cases', label: 'View cases', category: 'View', icon: '👥' },
  { id: 'cross_case_analysis', label: 'Run cross-case analysis', category: 'Analyze' },

  // NEW — Quality
  { id: 'compute_alpha', label: 'Compute Krippendorff α (intercoder reliability)', category: 'Quality', icon: '🛡️' },
  { id: 'compute_kappa', label: 'Compute Cohen κ (legacy)', category: 'Quality' },
  { id: 'compute_fleiss', label: 'Compute Fleiss κ (3+ coders)', category: 'Quality' },
  { id: 'view_weights', label: 'View code weights', category: 'Quality' },
  { id: 'view_ethics', label: 'Open ethics & consent panel', category: 'Quality' },
  { id: 'view_audit', label: 'View canvas audit trail', category: 'Quality' },

  // NEW — Excerpts / Dashboard / Calendar
  { id: 'view_excerpts', label: 'Browse excerpts', category: 'View' },
  { id: 'open_dashboard', label: 'Open canvas dashboard', category: 'View' },
  { id: 'open_research_calendar', label: 'Research calendar', category: 'View', icon: '📅' },

  // NEW — AI
  { id: 'auto_code', label: 'Run AI auto-code on transcript', category: 'AI', icon: '✨' },
  { id: 'ai_chat', label: 'Open AI chat (context-aware)', shortcut: 'Cmd+J', category: 'AI' },
  { id: 'summarize_canvas', label: 'Summarize canvas with AI', category: 'AI' },
  { id: 'summarize_transcript', label: 'Summarize transcript with AI', category: 'AI' },
  { id: 'ai_suggest_codes', label: 'AI suggest codes for selection', category: 'AI' },

  // NEW — Collaborate
  { id: 'share_canvas', label: 'Share canvas (generate share code)', category: 'Collaborate', icon: '🤝' },
  { id: 'invite_team', label: 'Invite team member', category: 'Collaborate' },

  // NEW — Export
  { id: 'export_csv', label: 'Export to CSV', category: 'Export' },
  { id: 'export_png', label: 'Export canvas as PNG', category: 'Export' },
  { id: 'export_html', label: 'Export to HTML report', category: 'Export' },
  { id: 'export_qdpx', label: 'Export to QDPX (for Atlas.ti / NVivo)', category: 'Export' },
];
```

## Toolbar slim-down

**`C:\JM Programs\QualCanvas\apps\frontend\src\components\canvas\panels\CanvasToolbar.tsx`**

```diff
- Back | Canvas title | Transcript ▾ | Survey | Code | Memo | AI ▾ | Tools ▾ | Upload | Share | More ▾ | Analyze ▾
+ Back | Canvas title | Transcript ▾ | Code | Memo | Upload | Share | Analyze ▾
```

Remove Survey button (move to Sources sub-group), remove Tools dropdown entirely (now in activity bar), remove AI dropdown (Cmd+K + AI panel).

## Inspector contextual rendering

**`C:\JM Programs\QualCanvas\apps\frontend\src\components\canvas\Inspector.tsx`**

```typescript
function Inspector({ selectedNodes, selectedEdge }: Props) {
  if (selectedNodes.length === 0 && !selectedEdge) {
    return <CanvasStatsInspector />;  // word count, code count, plan usage
  }
  if (selectedNodes.length === 1) {
    const node = selectedNodes[0];
    switch (node.type) {
      case 'transcript': return <TranscriptInspector node={node} />;   // coding stripes toggle, AI suggest, word count
      case 'question':   return <CodeInspector node={node} />;          // rename, recolor, see codings, merge
      case 'memo':       return <MemoInspector node={node} />;          // edit, link to source
      case 'case':       return <CaseInspector node={node} />;          // attributes, transcripts in case
      case 'stats': /* etc */:  return <ComputedNodeInspector node={node} />;
    }
  }
  if (selectedNodes.length >= 2) {
    return <MultiSelectInspector nodes={selectedNodes} />;
    // Show: Group as theme (Cmd+G), align/distribute, recolor all, compute intercoder
  }
  if (selectedEdge) {
    return <EdgeInspector edge={selectedEdge} />;
  }
}
```

## Mobile responsive

Below 768px:

- Activity bar slides off-screen, hamburger button in header opens it
- Inspector hidden entirely
- Bottom command bar (4 icons): Add Code / Add Memo / Cmd+K Search / More
- Canvas takes full width

Below 480px:

- Sidebar also hidden entirely
- Canvas at 100% with bottom bar only

## Tests

- E2E: Click each activity icon → correct sidebar panel renders
- E2E: Cmd+K → type "cases" → result appears (FIX for known bug)
- E2E: Cmd+K → type "kappa" → "Compute Krippendorff α" appears as top result
- E2E: Cmd+K → type "ethics" → "Open ethics & consent panel" appears
- E2E: Select 2 nodes → MultiSelectInspector renders with "Group as theme" action
- Mobile: viewport 390 → hamburger opens activity bar, bottom bar visible
- Visual regression: full IA layout at default viewport

## Acceptance criteria

- [ ] Activity bar (8 icons) renders in left rail
- [ ] All 8 sidebar panels implemented and lazy-loaded
- [ ] Inspector renders contextually per selection type
- [ ] Status bar at bottom shows word/code count + plan usage
- [ ] Canvas tabs (Canvas / Codebook / Cases / Analysis / AI) work
- [ ] Tools + AI dropdowns removed from toolbar
- [ ] Cmd+K registry has all 35+ actions (verified by E2E search-each test)
- [ ] Mobile breakpoint at 768px (hamburger + bottom bar)
- [ ] Existing keyboard shortcuts still work (Ctrl+K, F, ?, etc.)
- [ ] Visual regression baselines updated

## Rollback

- Feature flag `ACTIVITY_BAR_V2_ENABLED`
- Old toolbar with Tools/AI dropdowns kept in git, can re-enable via flag

## Telemetry

- `activity_panel_opened` { panel_id }
- `cmdk_search_query` { query, result_count, selected_id }
- `cmdk_search_no_results` { query } // Track gaps in coverage
- `inspector_action_clicked` { action, context_type }

Track: are users finding features via Cmd+K? (Goal: 30%+ of feature interactions originate from Cmd+K within 60 days)

## Effort

**5 days.** ActivityBar + Sidebar shell (1 day). 8 panels (2 days). Inspector (1 day). Cmd+K registry expansion (4 hours). Mobile responsive (4 hours). Tests + polish (1 day).

## Owner

TBD

## Commit message

```
feat(canvas): VS Code activity bar IA + complete Cmd+K coverage

- Activity bar (8 icons): Canvases, Codebook, Cases, Analyze, AI, Collaborate, Quality, Schedule
- Sidebar panels swap per activity (lazy-loaded)
- Right Inspector renders contextually per selection
- Canvas tabs: Canvas | Codebook | Cases | Analysis | AI lenses
- Status bar bottom: word/code count, plan usage
- Removed Tools + AI dropdowns from toolbar
- Cmd+K registry: added 28 missing actions (Codebook, Cases, Kappa, Ethics, AI, Export)
- Mobile responsive (768px breakpoint)

Solves the "16 features hidden in 2 dropdowns" problem identified in V3 plan.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
