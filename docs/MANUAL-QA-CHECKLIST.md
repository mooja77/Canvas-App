# QualCanvas Manual QA Checklist

Walk through this checklist before every major release. Takes ~30 minutes.
Mark each item: PASS / FAIL / SKIP (with reason).

---

## 1. Visual Coding Quality (10 checks)

- [ ] Select text in transcript → highlight appears with correct code color
- [ ] Select overlapping region (already coded) → second color blends correctly
- [ ] Click a coded segment → popover shows all applied codes
- [ ] Delete a coding from popover → highlight disappears immediately
- [ ] Create coding → edge drawn from transcript node to code node
- [ ] Edge color matches the code's color
- [ ] Code navigator count updates immediately after coding
- [ ] Status bar "X codings" and "Y% coded" update in real-time
- [ ] In-vivo coding (new code from selection) creates code + coding together
- [ ] Quick-code number shortcuts (1-9) assign to the correct code

## 2. Canvas Spatial Behavior (10 checks)

- [ ] Drag a node → smooth movement, no jitter or lag
- [ ] Drag node → edge follows without detaching visually
- [ ] Zoom to 100% → transcript shows full text, code shows name + count
- [ ] Zoom to ~30% → nodes simplify to reduced view (title only)
- [ ] Zoom to ~10% → nodes show minimal content (compact badges)
- [ ] Fit View (F key) → zooms to show all nodes with padding
- [ ] Auto-arrange (Ctrl+Shift+L) → nodes organize into clean layout
- [ ] Minimap reflects actual node positions and viewport rectangle
- [ ] Scroll wheel zoom → zooms toward cursor position
- [ ] Layout persists after page refresh (reload page, check positions)

## 3. Analysis Node Visuals (8 checks)

- [ ] Stats node → bar chart renders with colored bars per code
- [ ] Word Cloud node → words sized by frequency, no overlapping
- [ ] Sentiment node → positive/negative/neutral bars visible
- [ ] Co-occurrence node → matrix or list shows code pairs
- [ ] Treemap node → proportional rectangles with labels
- [ ] Each computed node has Run / Configure / Delete buttons
- [ ] "Click Run to..." message shows before first run
- [ ] After run, result replaces the placeholder message

## 4. Export Quality (7 checks)

- [ ] HTML export → opens in browser with proper CSS styling
- [ ] Markdown export → valid markdown (verify in viewer)
- [ ] Excel export → 3 sheets (Codebook, Codings, Case Matrix) with colors
- [ ] QDPX export → downloads .qdpx ZIP file
- [ ] PNG export → captures entire canvas accurately
- [ ] CSV codebook → correct columns (Code Name, Color, Frequency)
- [ ] Export modal shows format options based on plan tier

## 5. Responsive & Dark Mode (8 checks)

- [ ] Landing page at 375px → no horizontal scroll, hamburger menu works
- [ ] Login page at 375px → form fits, buttons full-width
- [ ] Pricing page at 375px → tier cards stack vertically
- [ ] Canvas workspace at 375px → toolbar collapses, canvas scrollable
- [ ] Toggle dark mode → ALL components switch (no white flash or broken contrast)
- [ ] Dark mode persists after page refresh
- [ ] Cookie consent banner doesn't overlap main content
- [ ] Pricing toggle (Monthly/Annual) works on mobile

## 6. Onboarding Tour (7 checks)

- [ ] Tour starts automatically on first canvas (new user)
- [ ] Each step highlights the correct UI element
- [ ] "Next" button advances to next step
- [ ] "Auto-play" runs through all 22 steps automatically
- [ ] "Skip tour" closes tour at any step
- [ ] Tour creates demo transcript and codes during walkthrough
- [ ] Re-run tour from Command Palette → works correctly

---

## How to Use

1. Open https://qualcanvas.com
2. Create a fresh account or use CANVAS-DEMO2025
3. Work through each section top-to-bottom
4. Mark PASS/FAIL/SKIP in a copy of this file
5. For any FAIL: note the exact steps and take a screenshot
6. File issues for all FAILs before release
