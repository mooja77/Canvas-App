# Seat billing

Decided by John on 27 Sep 2026 ("pay for seat, get screens"): people who work with an owner's paid features pay for a seat. Revised by John on 28 Sep 2026: **Pro is a one-person plan; Team is for groups, per seat.** (Per-seat Pro made Team pointless: three coders cost $45 on Pro and $117 on Team.) This page is the design. The code is `apps/backend/src/utils/seats.ts` and `routes/seatRoutes.ts`.

## What a seat is

- **The owner** holds seat 1.
- **Each coder** holds one more seat. A coder is an _editor_ collaborator on any canvas the owner owns (including canvases in the trash, because they come back on restore) or a non-owner member of a team the owner owns.
- **A person counts once**, however many canvases or teams they are on.
- **Viewers are free.** A viewer can open and export what is there, but cannot write, run AI or transcribe; the write guard already blocks them. This is common practice (Figma, Notion, Dovetail).

## Plans

| Owner (seat mode)                                                  | Coders                                                 | Why                                                                                                                                                                                                             |
| ------------------------------------------------------------------ | ------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Team on a Stripe subscription, active/trialing/past due (`billed`) | One paid seat each, $39/seat/mo or $32 annual          | Published per-seat price.                                                                                                                                                                                       |
| Pro, with or without a subscription (`solo`)                       | **None besides the owner**; viewers free and unlimited | One-person plan. A second coder needs Team (below). `PLAN_LIMITS.pro.maxCoders = 0`, `maxCollaborators = Infinity`.                                                                                             |
| Free user in the 14-day Pro trial (`trial`)                        | None; viewers free                                     | Same rule as Pro. There is no subscription to switch, so the prompt points at Team checkout.                                                                                                                    |
| Team with a complimentary row that Stripe has never seen (`comp`)  | Unlimited, not billed                                  | Production holds hand-written `comp_…` subscription rows (read-only check, 28 Sep 2026). Before this change they counted as billed, so a comped team's coders would have been put in grace and then locked out. |
| Grandfathered Team without a subscription (`grandfathered`)        | Unlimited, not billed                                  | Closed cohort with nothing to bill.                                                                                                                                                                             |
| Student, Free (`none`)                                             | No collaborators                                       | `maxCollaborators = 0`.                                                                                                                                                                                         |

Prices: the live Stripe prices were read (read-only, 27 and 28 Sep 2026). The tagged QualCanvas prices are per-unit licensed prices: Student $5/$48, Pro $15/$144, Team $39/$384. Untagged older prices ($12/$115, $29/$278) also exist. **No new Stripe products or prices are needed.** Every figure on /pricing, the guide, the Seats panel and the upgrade dialog comes from `shared/types/pricing.ts` (`PUBLISHED_PRICES_USD`, the numbers those Stripe prices were created with) or from Stripe's own invoice preview; the Team price used for an upgrade is looked up in Stripe by its tags, preferring the one at the published amount.

## A Pro owner adds a second coder

1. The owner invites a coder (Share dialog). Adding a viewer is free and is never refused on Pro.
2. The API answers **402 `TEAM_REQUIRED`** with `upgrade`, `seatsNeeded` (owner + every coder, including this one) and `preview`:
   - `upgrade: 'in_place'` (a Stripe Pro subscription): `preview` is Stripe's invoice preview of switching the subscription item to the Team price for the same interval with `seatsNeeded` seats, `proration_behavior=always_invoice`: the unused Pro time is credited and the Team seats for the rest of the period charged, on one invoice. It carries `dueNow` (charged today), `nextRenewal` (Team price × seats per interval), both prices, and `prorationDate`.
   - `upgrade: 'checkout'` (trial, legacy Pro, no Stripe subscription): `preview: null`; the dialog shows the published Team price and links to /pricing, and nothing can be charged from it.
3. The dialog (`TeamUpgradeDialog`) offers **Upgrade to Team**, **Add as viewer (free)** and Cancel. Nothing changes while it is open.
4. **Upgrade** repeats the request with `confirmTeamUpgrade: true` and the quote's `prorationDate`. This is a separate flag from `confirmSeatCharge`, so a seat confirmation can never switch anyone's plan. The server updates the item's price and quantity with `always_invoice` and `payment_behavior=pending_if_incomplete`, so Stripe switches the plan **only if the payment succeeds**; on a decline the invoice is voided, the answer is `SEAT_PAYMENT_FAILED`, and the owner stays on Pro with nobody added. After Stripe accepts, the plan is `team`, the quantity mirrors Stripe, and the coder is added.
5. **Add as viewer** repeats the request with `role: 'viewer'`: added at once, no charge.
6. Team members (Team page) follow the same rule; there is no viewer option there, because team members code.

## Adding a coder on Team

1. The owner invites a coder (Share dialog, or Team page).
2. If they need a new seat, the API answers **402 `SEAT_REQUIRED`** with a quote from Stripe's own invoice preview: seats before and after, price per seat, the prorated amount charged today and the next renewal amount.
3. The owner confirms. The client repeats the request with `confirmSeatCharge: true` and the quote's `prorationDate`, so the charge matches the quote to the cent. A quote older than 10 minutes is refused.
4. The server sets the Stripe quantity with `proration_behavior=always_invoice` and `payment_behavior=pending_if_incomplete`. The prorated charge is invoiced and paid now, and Stripe applies the new quantity **only if the payment succeeds**.
5. **Declined card:** Stripe leaves a pending update. We void that invoice and answer **402 `SEAT_PAYMENT_FAILED`**. Nobody is added and nothing is owed.
6. Only after Stripe has taken payment is the collaborator or team member written. A per-owner Postgres advisory lock serialises seat changes, so two invites at once can't both buy "seat N+1".

A spare paid seat is used without a new charge. When a coder is invited while others are unseated (see grace), the quote covers everyone who needs a seat, and the dialog says so.

## Removing a coder

Remove, make viewer, or leave a team: the seat is released **at once** with `proration_behavior=create_prorations`. The unused time becomes a credit on the next invoice; there is never a card charge.

**Why immediate, not at renewal.** Waiting for renewal would make an annual customer pay for up to 11 months for someone they removed. Immediate proration is what Stripe, Slack ("fair billing") and GitHub do. Replacing a person on the same day nets out to about zero.

Removing access never fails because of Stripe. If Stripe is unreachable, the access change still happens and the weekly reconciliation credits the seat later. Seat decreases are only ever made down to the number of seats in use; the API never adds seats without a confirmation.

## Existing accounts: grace, never a lock-out

A shortfall (more coders than seats) can arise in these ways:

- **a Pro owner already has coders**: data from before 28 Sep (Pro allowed 3 collaborators, then per-seat Pro in #213), or a Team owner who moves to Pro in the Stripe portal (the live portal allows price changes);
- a Team owner bought fewer seats at checkout than people coding with them;
- the owner reduced seats in the Stripe portal (not possible with today's portal configuration, see below).

What happens (the #213 mechanism, now also for Pro):

- The first time a shortfall is seen, the owner gets a **30-day grace period** (`User.seatGraceEndsAt`). On Pro every coder is over the limit, because Pro's one seat is the owner's.
- During grace every coder keeps editing.
- The owner sees a banner on the canvas list and a prompt under Account → Seats:
  - Pro: "Pro is a one-person plan: 2 coders need Team. They can keep editing until 27 Oct…", with **Upgrade to Team** (`POST /billing/seats/upgrade-to-team`, quoted and confirmed exactly like the invite above, with a seat for the owner and each coder; or a link to /pricing without a Stripe subscription) or **Make viewer** per coder.
  - Team: "2 coders don't have a paid seat…", with **Add 2 seats** or **Make viewer**.
- After grace, unseated coders become **read-only**. They keep read access and their coding; nothing is deleted. They see "the owner of this canvas needs to add a paid seat for you".
- On Team, seats go to the longest-standing coders first.
- The grace period is granted **once per owner**, so it cannot be restarted.
- **No emails are sent.** The prompt is in-app only.

**A Pro subscription with quantity > 1** (per-seat Pro from #213, or Team → Pro in the portal, which keeps the quantity) pays for seats that no longer let anyone edit. The next time seats are looked at (Account → Seats, the canvas banner, or the weekly reconciliation), `releaseUnusedSeats` sets the quantity to 1 with `create_prorations`: the unused time is credited to the next invoice; it is never a charge. The coders' grace is unaffected.

**Production, read-only check on 28 Sep 2026** (Stripe live API and the production database, no writes):

- Stripe: 0 subscriptions on any of the 10 prices of the three QualCanvas products, so no live Pro subscription has quantity > 1 and **no live subscription needs changing**.
- Database: 5 `Subscription` rows, none backed by Stripe. 2 are seeded Pro fixtures (`sub_test_*`/`sub_jamie`, fake price ids, `legacyPricing`, quantity 1, no coders); 3 are complimentary Team rows (`comp_…`, quantity 1), one of which has 1 coder. Before this change that comped owner counted as billed per seat with 1 seat, so their coder would have entered grace and been locked out 30 days later; `comp` mode fixes that. No `seatGraceEndsAt` was set yet.
- Pro owners with coders: 0. Users by plan: free 14 (8 legacy), pro 2 (both legacy fixtures), team 3.

**Checkout** for Team proposes one seat per person already coding with the owner, and the quantity is adjustable on the Stripe page. Pro checkout is always exactly one seat.

## Webhooks

- **Ordering.** `customer.subscription.updated` (and `customer.subscription.pending_update_applied`) re-read the subscription from Stripe and apply its current state, not the event snapshot. A late, older snapshot (for example quantity 3 after a change to 2) can't win. A cancelled subscription can't be re-activated.
- **Quantity and plan.** Both are mirrored from Stripe on checkout completion, subscription updates and invoice payment, and weekly by reconciliation; the plan is re-derived from the subscribed price, so a Pro -> Team switch (in QualCanvas or the portal) lands as Team with its seat count. Neither is written ahead of Stripe. A Pro subscription with quantity > 1 is mirrored as it is; its extra seats let nobody edit and are credited back as described above.
- **Duplicates.** Processed event ids are recorded (existing behaviour).
- **Other products on the shared account.** The signature is verified first. An event for a subscription or customer that isn't QualCanvas's is acknowledged with 200 and changes nothing.

## Transcription (no pool since 28 Sep 2026)

The pooled allowance (plan minutes × paid seats) was removed on 28 Sep 2026. John decided JMS Dev Lab will never hold a paid AI key for QualCanvas, so no plan includes transcription minutes. Every recording is transcribed on a customer's own OpenAI key; seats are billed exactly as above and have nothing to do with AI usage. Whose key pays, including the collaborator rule, is documented at the top of `apps/backend/src/utils/aiKeys.ts`.

## API

| Endpoint                                                                      | Purpose                                                                                                   |
| ----------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET /api/billing/seats`                                                      | Mode, seats paid and used, who holds a seat, unseated count, grace date, price                            |
| `POST /api/billing/seats/preview {quantity}`                                  | Quote only                                                                                                |
| `POST /api/billing/seats {quantity, confirmSeatCharge}`                       | Team: add seats for unseated coders (402 quote first), or drop seats nobody holds. Pro: 409 `PRO_IS_SOLO` |
| `POST /api/billing/seats/upgrade-to-team {confirmTeamUpgrade, prorationDate}` | Pro -> Team with a seat for the owner and each coder (402 `TEAM_REQUIRED` quote first)                    |
| `POST /api/billing/seats/holders/:userId/release`                             | Make that person a viewer everywhere and remove them from your teams                                      |
| `POST /api/canvas/:id/collaborators`, `POST /api/teams/:id/members`           | Answer 402 `SEAT_REQUIRED` (Team) / `TEAM_REQUIRED` (Pro, trial) / `SEAT_PAYMENT_FAILED` as above         |

## Proof and limits

- **Tests.** `e2e/fullstack/10-seats.spec.ts` (API and browser, including axe; the Pro owner adding a coder, the viewer alternative, the declined upgrade, the trial, grace and upgrade from Account → Seats), `apps/backend/src/utils/seats.test.ts`, `seats.proSolo.test.ts`, the webhook quantity cases in `__tests__/integration/billing.test.ts`, and `SeatsPanel.test.tsx` / `ShareCanvasModal.test.tsx` / `PricingPage.test.tsx`. The 12-month simulation seat scenarios are in `SIMULATION.md`.
- **UNPROVEN against real Stripe: the Pro -> Team price change with `payment_behavior=pending_if_incomplete`.** Stripe documents `items.price`, `items.quantity` and `proration_date` as supported in a pending update (docs.stripe.com/billing/subscriptions/pending-updates-reference, read 28 Sep 2026); only the double has exercised it.
- **UNPROVEN against real Stripe.** Everything above ran against the local Stripe double, which follows Stripe's documented proration and pending-update rules. It was not run against Stripe test mode: the machine's Stripe CLI has no test-mode key. The exact `createPreview` line shape in the account's API version (`2026-02-25.clover`) is handled for both the old `line.proration` and the new `parent.subscription_item_details.proration` fields, but only the double's shape has been exercised.
- **Stripe portal.** The live default portal configuration (read-only check, 27 Sep 2026) allows `price` updates only, not `quantity`, so customers cannot change seats there; seats change only through QualCanvas. If quantity updates are ever enabled in the portal, a reduction creates a shortfall and the grace rules above apply (covered by `10-seats` "quantity mirrors Stripe").
