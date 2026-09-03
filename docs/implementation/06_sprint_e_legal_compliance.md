# Sprint E — Legal / Compliance Foundation

## Goal

Ship the 3 compliance artifacts that unblock ~70% of EU + enterprise + healthcare institutional deals: DPA + sub-processor list, Trust page, and audit-read events.

## Scope

- New `/trust` page with sub-processor table, encryption summary, audit log explainer
- DPA template PDF (signable via DocuSign/PandaDoc link)
- Audit-read events middleware (currently only mutations logged → HIPAA red flag)
- GDPR-grade Privacy Policy rewrite
- Cookie Policy page (currently referenced in `cookie-consent.js` but no page exists)
- User-facing audit trail endpoint (`GET /api/v1/canvas/:id/audit`)

## Out of scope

- SOC 2 Type II audit (separate $50-80K, 6-9 month engagement)
- HIPAA BAA tier (separate sprint, requires Railway/Stripe BAA negotiation)
- EU region deployment
- MFA / SSO / SAML
- Transcript encryption at rest (separate sprint, ~2-3 weeks)

## File-level changes

### 1. Trust page

**`C:\JM Programs\QualCanvas\apps\frontend\src\pages\TrustPage.tsx`** (new)
**`C:\JM Programs\QualCanvas\apps\frontend\src\App.tsx`** add route `/trust`

Sections:

1. **At a glance** — uptime, last incident, certification status
2. **Hosting & data residency** — Railway US (current), EU region Q2 2026
3. **Encryption** — TLS 1.3 in transit, AES-256-GCM at rest (BYOK + transcripts coming)
4. **Authentication** — Email/password, Google OAuth, MFA Q3 2026, SAML Q4 2026
5. **Sub-processors** — table (see below)
6. **Audit logging** — what's logged, retention 90 days, user-facing trail
7. **Compliance status** — In progress: SOC 2 Type I Q3 2026
8. **Vulnerability disclosure** — security@qualcanvas.com, 48h response

Sub-processor table:

```tsx
const SUB_PROCESSORS = [
  { vendor: 'Railway', purpose: 'App + DB hosting', location: 'US (East)', dpa: 'Signed' },
  { vendor: 'Cloudflare', purpose: 'CDN + edge + analytics', location: 'Global edge', dpa: 'Signed' },
  { vendor: 'Stripe', purpose: 'Payments', location: 'US', dpa: 'BAA-eligible' },
  { vendor: 'Resend', purpose: 'Transactional email', location: 'US', dpa: 'Signed' },
  { vendor: 'Google', purpose: 'OAuth identity', location: 'Global', dpa: 'OAuth only, no data sharing' },
  { vendor: 'OpenAI/Anthropic', purpose: 'LLM (BYO key)', location: 'US', dpa: 'BYO key — direct, no proxy' },
];
```

### 2. DPA template

**`C:\JM Programs\QualCanvas\apps\frontend\public\legal\dpa.pdf`** (new)

Engage Iubenda or Termly ($5-10K legal review). Template covers:

- GDPR Art. 28 (Data Processor obligations)
- Standard Contractual Clauses (SCCs) for international transfers
- Sub-processor change notification (30 days)
- Breach notification (72 hours)
- Audit rights
- Data return / destruction on termination

Signable via:

- Public PDF on `/trust` for self-service download
- DocuSign / PandaDoc link for "Sign DPA" button (institutional sales)

### 3. Audit-read events

**`C:\JM Programs\QualCanvas\apps\backend\src\middleware\auditLog.ts`**

```diff
 function determineAction(method: string, path: string): string | null {
   if (path.includes('/export')) return 'export';
+  // Log reads of PHI-eligible resources (transcripts, codings, memos)
+  const isPhiRead = method === 'GET' &&
+    /\/canvas\/[^/]+\/(transcripts|codings|memos)(\/|$)/.test(path);
+  if (isPhiRead) return 'read';
   if (method === 'GET') return null;
   if (method === 'DELETE') return 'delete';
   if (method === 'POST') return 'write';
   if (method === 'PUT' || method === 'PATCH') return 'update';
   return null;
 }
```

### 4. User-facing audit trail endpoint

**`C:\JM Programs\QualCanvas\apps\backend\src\routes\auditRoutes.ts`** (new)

```typescript
// GET /api/v1/canvas/:id/audit
// Returns audit trail for a canvas, scoped to the requesting user's view
router.get('/canvas/:id/audit', requireAuth, async (req, res) => {
  const userId = req.userId;
  const canvasId = req.params.id;
  await getOwnedCanvas(canvasId, getAuthId(req), userId);

  const limit = Math.min(Number(req.query.limit) || 100, 500);
  const events = await prisma.auditLog.findMany({
    where: { resourceId: canvasId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });

  res.json({ success: true, data: events });
});
```

Frontend: surface via Help menu → "View audit trail for this canvas" (institutional flag).

### 5. Privacy Policy rewrite

**`C:\JM Programs\QualCanvas\apps\frontend\src\pages\PrivacyPage.tsx`**

Add sections (per GDPR Art. 13):

- **Lawful basis:** legitimate interest for academic research, contract for paid customers
- **Data subject rights:** access (Art. 15), rectification (Art. 16), erasure (Art. 17), portability (Art. 20), objection (Art. 21)
- **Sub-processors:** link to /trust
- **Data retention per category** (transcripts: until user deletes; logs: 90 days; payments: 7 years)
- **International transfers:** SCCs in place
- **DPO / EU rep contact**

### 6. Cookie Policy

**`C:\JM Programs\QualCanvas\apps\frontend\src\pages\CookiePolicyPage.tsx`** (new)
Route: `/cookies` (already referenced from cookie-consent banner)

Sections:

- What we use cookies for (essential, analytics, marketing)
- Specific cookies set (Cloudflare, GTM, Sentry session)
- How to opt out
- How to delete cookies

### 7. Index audit table

**`C:\JM Programs\QualCanvas\apps\backend\prisma\schema.prisma`** AuditLog model:

```diff
 model AuditLog {
   id         String    @id
   timestamp  DateTime  @default(now())
   action     String
   resource   String
   resourceId String?
   actorType  String
   actorId    String?
   ip         String?
   method     String?
   path       String?
   statusCode Int?
   meta       String?

   @@index([action])
   @@index([timestamp])
   @@index([actorId])
+  @@index([resourceId])
+  @@index([resource, action])
 }
```

Migration: `npx prisma migrate dev --name audit_log_indexes`

## Tests

- E2E: navigate to `/trust`, verify sub-processor table renders
- Backend: GET `/canvas/:id/transcripts/:tid` creates AuditLog with action='read'
- Backend: `GET /canvas/:id/audit` returns events for the user's canvas
- Privacy Policy: verify all 5 required GDPR sections present

## Acceptance criteria

- [ ] `/trust` page live with sub-processor table
- [ ] `/cookies` page live with all cookies enumerated
- [ ] `/privacy` rewritten to GDPR Art. 13 compliance
- [ ] DPA PDF live at `/legal/dpa.pdf`
- [ ] DocuSign link wired (or alternative signing flow)
- [ ] Audit middleware logs reads on transcript / coding / memo routes
- [ ] `GET /canvas/:id/audit` endpoint live
- [ ] New AuditLog indexes deployed
- [ ] Legal review complete (Iubenda / external lawyer sign-off)

## Rollback

- Page-level: remove `/trust`, `/cookies` routes; old privacy policy is in git history
- Audit middleware: feature-flag the read-logging if it floods the table; disable via env var

## Telemetry

- `trust_page_viewed` event
- `dpa_downloaded` event (track institutional buying signals)
- `audit_trail_viewed` event

## Effort

**3-4 weeks.** Pages 1 week. Legal review parallel ~2-3 weeks. Middleware + endpoint 2 days. Polish + testing 3 days.

## Owner

TBD + external legal counsel

## Commit message

```
feat(compliance): trust page + DPA + audit-read events + GDPR-grade privacy

- /trust page with sub-processor list, encryption summary, audit explainer
- DPA template signable via /legal/dpa.pdf
- /cookies page (was referenced but missing)
- Privacy Policy: full GDPR Art. 13 compliance
- Audit middleware: log reads of transcripts/codings/memos
- User-facing GET /canvas/:id/audit endpoint
- AuditLog indexes on (resourceId), (resource, action)

Unblocks ~70% of EU + enterprise institutional procurement.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
```
