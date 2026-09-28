# QualCanvas 12-month fast-forward simulation

Estate Test Programme, Wave 4 (27 Sep 2026). The code is in `e2e/fullstack/simulation/`.

```
docker run -d --name qc-estate-pg -e POSTGRES_USER=qualcanvas -e POSTGRES_PASSWORD=qualcanvas \
  -p 127.0.0.1:4919:5432 postgres:16
node e2e/fullstack/simulation/fast-forward.mjs --months 12 --seed 42 --label current
```

## What it does

**One process.** A single Node process hosts:

- the **real backend**, imported from `apps/backend/src/index.ts` and served over HTTP on loopback;
- the **Stripe double**;
- the **scheduled jobs**.

They all share one clock, so moving the clock moves the whole application.

**Isolation.**

- The preload `e2e/fullstack/support/preload.mjs` refuses every non-loopback socket.
- It answers Resend, the JMS event ingest and the AI providers from in-process stubs, and records what was sent.
- The simulation database (`qualcanvas_sim`) is recreated at the start of every run by `support/reset-db.mjs`, which only accepts a loopback `qualcanvas_sim*` name.

**Time.**

- The simulation moves one day at a time from 2026-10-01 for 365 days.
- Postgres stamps some timestamps itself (`@default(now())`): audit-log rows, `createdAt` on users, canvases, transcripts, codings and webhook events. After each day those rows are **re-stamped** to the simulated instant, because the jobs read them.

**The cast.**
Each account is driven over HTTP exactly as the web app does it: cookie session, Origin header, a fresh sign-in when the 24h session lapses.

| Account                 | Life over the year                                                                                                         |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------- |
| `free-unverified`       | Never verifies its email. Free for the whole year and runs into every Free cap.                                            |
| `trial-lapses`          | Verifies (14-day Pro trial), works heavily, and falls back to Free with more than 2 canvases. Opted in to lifecycle email. |
| `pro-monthly`           | Buys Pro on day 3. Renews monthly. Card fails on day 120 and recovers on day 123.                                          |
| `pro-annual`            | Buys Pro annual on day 10.                                                                                                 |
| `team-owner` + 2 coders | Team from day 1. Two editor collaborators code on a shared canvas. Switches Team → Pro on day 180.                         |
| `student`               | Academic email, Student from day 5. Sets cancel-at-period-end on day 140 and is cancelled at the next renewal.             |
| `card-dies`             | Pro from day 15. Card fails on day 200. Stripe cancels on day 214.                                                         |
| `buys-in-trial`         | Buys Pro during the trial, cancels on day 250, re-subscribes to Team annual on day 290.                                    |
| `legacy`                | Pre-2026 access-code researcher who links an email (grandfathered Pro). Buys Team on day 30, cancels on day 240.           |

**Daily work** (seeded random).

- Create canvases.
- Add interview transcripts. Names include Úna, José, Seán and Tomás.
- Add codes and code passages.
- Delete codings.
- Anonymise (paid plans).
- Trash and restore canvases.

**Webhooks** are delivered the way Stripe delivers them:

- **10%** are delivered twice.
- **8%** of subscription updates arrive 1–3 days late, so out of order.
- Every cancellation is followed the next day by a stale `customer.subscription.updated(active)` snapshot.

**Jobs.** Trash retention, audit retention and lifecycle email run every simulated day; Stripe reconciliation runs weekly.

- There is a **5-day outage** (days 70–74) with no jobs, then catch-up.
- **15%** of runs are immediately **replayed**.

**Checks.**

- Weekly: every account is checked against the ledger.
- Fortnightly: a Statistics node is compared with the ledger.
- Monthly: a QDPX export is imported back and compared.

## The independent ledger

The ledger does not import any app code. Its rules come from the published pricing page and the documented billing rules:

- **Stored plan:**
  - If the subscription is `active`, `trialing` or `past_due` (Stripe is still retrying the card; decision D1, 27 Sep 2026), the plan comes from the price.
  - If it is anything else, the plan is Pro for grandfathered legacy users and Free for everyone else.
- **Effective plan:** Pro while a verified Free user's 14-day trial runs; otherwise the stored plan.
- **Caps** (from the pricing page):
  - Free: 2 canvases, 5 transcripts per canvas, 10 codes per canvas.
  - Student: 5 canvases.
  - Pro and Team: unlimited.
- **Anonymisation:** the expected text comes from an independent Unicode whole-word replacement. Coding offsets move with the text.
- **Trash:** a canvas trashed more than 30 days ago must be gone; one trashed less than 30 days ago must still be restorable.

## Results

Both runs use seed 42, 12 months (365 days), with the same cast and scripts. The old-code run predates two harness additions: the dormant opt-in accounts and a valid lifecycle sender. Those only add the email invariants and do not change the other actors.

- **Old code** (`origin/main` dd6b040): **12 of 34 invariants failing**; 149210 checks; runtime 1335s.
- **New code** (this PR): **0 of 34 failing**; 185226 checks; runtime 1530s; HTTP 16879, 5xx 0.

| Invariant           | What it checks                                                                  | Old (pass/fail) | New (pass/fail) |
| ------------------- | ------------------------------------------------------------------------------- | --------------- | --------------- |
| INV-ANON-OK         | anonymisation succeeds on a paid plan                                           | **0/1**         | —               |
| INV-ANON-TEXT       | anonymised text equals an independent whole-word replacement (accents included) | **21/3**        | 48/0            |
| INV-AUDIT-RETENTION | no audit-log row is older than 90 days after the retention job                  | 360/0           | 360/0           |
| INV-CANVAS-LIST     | live canvas list == ledger                                                      | 583/0           | 689/0           |
| INV-CANVAS-READ     | every live canvas is readable by its owner (also after a downgrade)             | 2699/0          | 3118/0          |
| INV-CAP-CANVAS      | canvas create is allowed exactly while live canvases < plan cap                 | **125/1**       | 123/0           |
| INV-CAP-CODE        | code create is allowed exactly while the canvas is under the plan cap           | **519/4**       | 484/0           |
| INV-CAP-RESTORE     | restore from trash obeys the live-canvas cap                                    | 21/0            | 27/0            |
| INV-CAP-TRANSCRIPT  | transcript add is allowed exactly while the canvas is under the plan cap        | **571/15**      | 587/0           |
| INV-CHECKOUT        | checkout session is created for a user without a live subscription              | 8/0             | 8/0             |
| INV-CODING-ALIGNED  | every coding's stored text == transcript.slice(start, end)                      | **66219/122**   | 83555/0         |
| INV-CODING-CREATE   | a valid coding (text matches offsets) is accepted                               | **3359/3**      | 3404/0          |
| INV-CODING-DELETE   | deleting an existing coding succeeds                                            | 74/0            | 75/0            |
| INV-CODING-LEDGER   | every coding's offsets == ledger                                                | **65980/361**   | 83555/0         |
| INV-COLLAB-ADD      | Team owner can add collaborators                                                | 2/0             | 2/0             |
| INV-CONTENT-COUNTS  | transcript/code/coding counts == ledger                                         | 2699/0          | 3118/0          |
| INV-EMAIL-CONSENT   | lifecycle emails only go to people who opted in                                 | —               | 4/0             |
| INV-EMAIL-ONCE      | each lifecycle email reaches a person at most once                              | 1/0             | 4/0             |
| INV-EXPORT-GATE     | QDPX export is available exactly on paid plans                                  | **113/5**       | 125/0           |
| INV-ISOLATION       | a user never reads another tenant's canvas                                      | 50/0            | 43/0            |
| INV-JOB-IDEMPOTENT  | a replayed trash-retention run purges nothing new                               | 49/0            | 52/0            |
| INV-LEGACY-LINK     | a legacy access-code user can link an email account                             | 1/0             | 1/0             |
| INV-LOGIN           | a known user can always sign in                                                 | 1938/0          | 2196/0          |
| INV-NO-5XX          | no request answered 5xx                                                         | 1/0             | 1/0             |
| INV-NO-EGRESS       | no outbound connection left the machine                                         | 1/0             | 1/0             |
| INV-PLAN            | effective plan (/auth/me) == ledger (subscription + legacy + trial rules)       | **562/21**      | 689/0           |
| INV-QDPX-ROUNDTRIP  | QDPX export → import preserves every coding and its text                        | **59/1**        | 65/0            |
| INV-STATS           | stats node count per code == ledger                                             | 1785/0          | 2016/0          |
| INV-STATS-RUN       | stats node runs                                                                 | 260/0           | 275/0           |
| INV-SUB-STATUS      | stored subscription status == Stripe status                                     | **361/3**       | 364/0           |
| INV-TRASH           | moving a canvas to the trash succeeds                                           | 35/0            | 37/0            |
| INV-TRASH-KEPT      | canvases trashed < 30 days ago are still restorable                             | 107/0           | 97/0            |
| INV-TRASH-PURGED    | canvases trashed > 30 days ago are purged by the retention job                  | 17/0            | 14/0            |
| INV-VERIFY          | verification link from the email verifies the account                           | 9/0             | 11/0            |
| INV-WEBHOOK-2XX     | every correctly signed webhook is acknowledged 200                              | 81/0            | 78/0            |

### What the old-code failures were

| Invariant                              | Example from the run                                                                                                                        | Root cause (fixed)                                                                                                                                                       |
| -------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| INV-PLAN / INV-SUB-STATUS              | day 216 `card-dies`: app shows Pro + `active`, Stripe says `canceled`                                                                       | A stale `subscription.updated(active)` delivered after `.deleted` re-activated the row (F6).                                                                             |
| INV-PLAN (legacy)                      | day 251 `legacy`: app shows Free, ledger says grandfathered Pro                                                                             | The weekly reconciliation wrote `'free'` for ended subscriptions (F5). The legacy user then hit Free caps: INV-CAP-CANVAS/CODE/TRANSCRIPT, INV-EXPORT-GATE, INV-ANON-OK. |
| INV-CODING-ALIGNED / INV-CODING-LEDGER | `pro-monthly` coding stored "and we lost two experienced nu…" while the transcript at those offsets reads "the change, and we lost two ex…" | Anonymisation did not move coding offsets (F3). Knock-on INV-CODING-CREATE failures: new codings sliced from the ledger's text were refused.                             |
| INV-ANON-TEXT                          | "Úna" left in the transcript after anonymising "Úna"                                                                                        | ASCII-only `` (F3).                                                                                                                                                      |
| INV-QDPX-ROUNDTRIP                     | one 401                                                                                                                                     | A harness session lapse, since fixed in the harness. Not an app defect.                                                                                                  |

### Volumes (new-code run)

| metric               | value |
| -------------------- | ----- |
| actors               | 13    |
| canvasesCreated      | 98    |
| canvasCreatesRefused | 25    |
| transcripts          | 506   |
| transcriptRefused    | 81    |
| codes                | 459   |
| codeRefused          | 25    |
| codings              | 3404  |
| codingsDeleted       | 75    |
| trashed              | 37    |
| restored             | 20    |
| restoreRefused       | 7     |
| purgedByJob          | 14    |
| permanentDeletes     | 0     |
| anonymisations       | 48    |
| exports              | 67    |
| qdpxRoundTrips       | 65    |
| collaboratorsAdded   | 2     |
| webhooks             | 78    |
| webhookReplays       | 7     |
| webhooksDelayed      | 3     |
| renewals             | 48    |
| paymentFailures      | 2     |
| cancellations        | 4     |
| planSwitches         | 1     |
| jobRuns              | 1133  |
| jobReplays           | 52    |
| downtimeDaysSkipped  | 5     |
| http                 | 16879 |
| http5xx              | 0     |
| relogins             | 474   |

### Not covered by the simulation (UNPROVEN over time)

- Team seat quantity sync to Stripe (unit-tested only).
- Scheduled reports.
- Transcription on customers' own keys over time (covered by `e2e/fullstack/11-own-ai-key.spec.ts`, not simulated). There are no included minutes to meter since 28 Sep 2026.
- AI features beyond the stubbed provider responses.
- Google sign-in.
- Real Stripe behaviour. The double mimics documented Stripe objects, but prices, coupon IDs and the portal configuration in the live account were not read.

## Seat billing (27 Sep 2026, branch `feat/team-seats-20260927`)

The ledger now also models the published seat rules (docs/qa/SEAT-BILLING.md), independently of app code:

- **Seat count.** Owner + distinct coders; viewers are free.
- **Charges.** Adding a seat is invoiced now at Stripe's documented proration. That is unit × quantity × time left ÷ period, as a credit line for the old quantity and a debit line for the new one. The same invoice also sweeps credits already waiting and the credit balance.
- **Removals.** Removing a seat credits the unused time to the next invoice.
- **Grace.** An owner with more coders than seats gets 30 days' grace once. After that, unseated coders can read but not write.

The Stripe double implements the matching Stripe behaviour: `always_invoice`, `create_prorations`, `pending_if_incomplete` with a declining card, `invoices/create_preview` and void.

**New cast.**

| Account                            | Seat life over the year                                                                                                                                                                                                                                                                                                                                                                      |
| ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `team-owner` + 3 coders + a viewer | **Day 2:** two coders, each quoted, confirmed and charged; a free viewer. **Day 45:** a coder is removed (credit), and Stripe's stale higher-quantity snapshot arrives a day late. **Day 60:** re-invited; the quote nets the waiting credit. **Day 90:** the card is declined while adding a third coder (nothing added); then it succeeds. **Day 180:** Team → Pro, seats and coders kept. |
| `grace-owner` + 2 coders           | Coders added free during the trial. On day 8 the owner buys Pro but lowers checkout to 1 seat. The coders keep editing for 30 days, are read-only from day 38, and edit again after the owner adds 2 seats on day 60.                                                                                                                                                                        |

**New invariants.**

| Invariant           | What it checks                                                                                      |
| ------------------- | --------------------------------------------------------------------------------------------------- |
| INV-CHECKOUT-SEATS  | Pro/Team checkout proposes one seat per person, adjustable                                          |
| INV-SEAT-QUOTE      | a coder needing a seat gets a 402 quote equal to the ledger's immediate charge                      |
| INV-SEAT-CHARGE     | a confirmed seat is charged exactly the quote, and Stripe then bills the new quantity               |
| INV-SEAT-DECLINE    | a declined card adds no seat and no coder, and leaves no open invoice                               |
| INV-SEAT-RELEASE    | removing a coder drops the quantity at once and credits the unused time, with no card charge        |
| INV-SEAT-STATUS     | seats paid (app) == Stripe quantity == ledger; seats used, unseated coders and grace date == ledger |
| INV-SEAT-GRACE      | an unseated coder can edit during the 30-day grace and not after it; a seated coder always can      |
| INV-SEAT-READ       | a coder never loses read access over seats                                                          |
| INV-SEAT-MODE       | only live Pro/Team subscriptions are billed per seat                                                |
| INV-VIEWER-FREE     | a viewer is added with no quote, no charge and no seat                                              |
| INV-VIEWER-READONLY | a viewer cannot write                                                                               |

**Results** (seed 42, 12 months).

- **Old code** (`origin/main` 17073c3 with the new harness): **13 of 44 invariants failing.** The seat ones:
  - INV-SEAT-QUOTE 0/5: coders were added free, with no quote.
  - INV-SEAT-STATUS 0/315: there is no seats API.
  - INV-CHECKOUT-SEATS 1/8: checkout is always quantity 1, not adjustable.
  - INV-SEAT-DECLINE 0/1: the coder was added with no charge.
  - INV-SEAT-RELEASE 0/1.
  - INV-SEAT-GRACE 38/396: unseated coders were never restricted.

  The rest are knock-on effects on content counts, plus one QDPX/stats mismatch from a coding-create 500 under load. That old-code run predates two harness fixes: paging canvases over 500 codings, and modelling waiting credits.

- **New code** (this branch, before its final rebase onto the screens PR):
  - **Final run: 0 of 45 failing**, 232,741 checks, HTTP 21,870, 5xx 0, runtime 2,207 s. All seat invariants pass.
  - An earlier run on the same code had 2 of 45 failing. Both were one miss on day 76 for `card-dies`: `/auth/me` returned no user. It is not seat-related and did not recur. Its cause was **not established**; the invariant now records the HTTP status if it happens again.

**Not covered.** Transcription over time. Pooled minutes were removed on 28 Sep 2026 (all AI runs on the customer's own key); the key rules are tested in `utils/aiKeys.test.ts` and `e2e/fullstack/11-own-ai-key.spec.ts`.

## Own AI key (28 Sep 2026, branch `feat/own-ai-key-wizard`)

The simulation makes no AI calls, so this branch only had to leave it green. Seed 42, 12 months:

- `origin/main` (75e3f72): **0 of 45 failing**, 221,591 checks, 5xx 0.
- This branch, first run: **1 of 45 failing**. `INV-QDPX-ROUNDTRIP` for `grace-owner` 5 times: the imported copy had one coding fewer than the ledger (for example app=318, ledger=319). 5xx 0.
- This branch, second run (same code, plus the diagnostic below): **0 of 45 failing**, 211,708 checks, 5xx 0.

The cause of the first-run miss was **not established**. The two runs of the same code differ in request count (21,927 vs 21,875), so runs are not fully deterministic. A candidate that is **unproven**: the app lets a coder save the same code on the same span twice, and the QDPX import drops the second copy as a duplicate (`utils/qdpxImport.ts`, `codingKeys`). The random `coderWrite` spans on the one-transcript grace canvas could collide. `INV-QDPX-ROUNDTRIP` now prints the import's own summary (skipped / "already on this canvas" codings), so the next miss will show whether that is the cause.
