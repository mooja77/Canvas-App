# Seat billing

Decided by John on 27 Sep 2026 ("pay for seat, get screens"): people who work with an owner's paid features pay for a seat. This page is the design. The code is `apps/backend/src/utils/seats.ts`, `routes/seatRoutes.ts`.

## What a seat is

- **The owner** holds seat 1.
- **Each coder** holds one more seat. A coder is an _editor_ collaborator on any canvas the owner owns (including canvases in the trash, because they come back on restore) or a non-owner member of a team the owner owns.
- **A person counts once**, however many canvases or teams they are on.
- **Viewers are free.** A viewer can open and export what is there, but cannot write, run AI or transcribe; the write guard already blocks them. This is common practice (Figma, Notion, Dovetail).

## Which plans are billed per seat

| Owner                                          | Seats billed?                  | Why                                                                                                                               |
| ---------------------------------------------- | ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| Team subscription (active, trialing, past due) | Yes, $39/seat/mo or $32 annual | Published per-seat price.                                                                                                         |
| Pro subscription                               | Yes, $15/seat/mo or $12 annual | Pro allowed 3 collaborators, who got Pro features without paying. Billing them at the Pro price is the least disruptive fair fix. |
| Student                                        | No                             | No collaborators on Student.                                                                                                      |
| Free-plan 14-day trial                         | No                             | Nothing to bill. The plan's collaborator cap still applies.                                                                       |
| Grandfathered legacy Pro (no subscription)     | No                             | Closed pre-2026 cohort with no Stripe subscription to bill.                                                                       |

The live Stripe prices were read (read-only, 27 Sep 2026). The tagged QualCanvas prices are per-unit licensed prices, so quantity works as is: Student $5/$48, Pro $15/$144, Team $39/$384. Untagged older prices ($12/$115, $29/$278) also exist. There were 0 live QualCanvas subscriptions. **No new Stripe products or prices are needed.**

## Adding a coder

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

## Existing teams: grace, never a lock-out

A shortfall (more coders than paid seats) can arise in three ways:

- coders were added during a free trial, then the owner bought fewer seats at checkout;
- the owner reduced seats in the Stripe portal (not possible with today's portal configuration, see below);
- data from before seat billing.

What happens:

- The first time a shortfall is seen, the owner gets a **30-day grace period** (`User.seatGraceEndsAt`).
- During grace every coder keeps editing.
- The owner sees a banner on the canvas list ("2 coders don't have a paid seat. They can keep editing until 27 Oct…") and a prompt under Account → Seats: **Add 2 seats** (quoted and confirmed as above) or **Make viewer**.
- After grace, unseated coders become **read-only**. They keep read access and their coding; nothing is deleted. They see "the owner of this canvas needs to add a paid seat for you".
- Seats go to the longest-standing coders first.
- The grace period is granted **once per owner**, so lowering seats in the portal cannot restart it.
- **No emails are sent.** The prompt is in-app only.

**Checkout** proposes one seat per person already coding with the owner, and the quantity is adjustable on the Stripe page.

## Webhooks

- **Ordering.** `customer.subscription.updated` (and `customer.subscription.pending_update_applied`) re-read the subscription from Stripe and apply its current state, not the event snapshot. A late, older snapshot (for example quantity 3 after a change to 2) can't win. A cancelled subscription can't be re-activated.
- **Quantity.** It is mirrored from Stripe on checkout completion, subscription updates and invoice payment, and weekly by reconciliation. It is never written ahead of Stripe.
- **Duplicates.** Processed event ids are recorded (existing behaviour).
- **Other products on the shared account.** The signature is verified first. An event for a subscription or customer that isn't QualCanvas's is acknowledged with 200 and changes nothing.

## Transcription (no pool since 28 Sep 2026)

The pooled allowance (plan minutes × paid seats) was removed on 28 Sep 2026. John decided JMS Dev Lab will never hold a paid AI key for QualCanvas, so no plan includes transcription minutes. Every recording is transcribed on a customer's own OpenAI key; seats are billed exactly as above and have nothing to do with AI usage. Whose key pays, including the collaborator rule, is documented at the top of `apps/backend/src/utils/aiKeys.ts`.

## API

| Endpoint                                                            | Purpose                                                                        |
| ------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `GET /api/billing/seats`                                            | Mode, seats paid and used, who holds a seat, unseated count, grace date, price |
| `POST /api/billing/seats/preview {quantity}`                        | Quote only                                                                     |
| `POST /api/billing/seats {quantity, confirmSeatCharge}`             | Add seats for unseated coders (402 quote first), or drop seats nobody holds    |
| `POST /api/billing/seats/holders/:userId/release`                   | Make that person a viewer everywhere and remove them from your teams           |
| `POST /api/canvas/:id/collaborators`, `POST /api/teams/:id/members` | Answer 402 `SEAT_REQUIRED` / `SEAT_PAYMENT_FAILED` as above                    |

## Proof and limits

- **Tests.** `e2e/fullstack/10-seats.spec.ts` (API and browser, including axe), `apps/backend/src/utils/seats.test.ts`, and `SeatsPanel.test.tsx` / `ShareCanvasModal.test.tsx`. The 12-month simulation seat scenarios are in `SIMULATION.md`.
- **UNPROVEN against real Stripe.** Everything above ran against the local Stripe double, which follows Stripe's documented proration and pending-update rules. It was not run against Stripe test mode: the machine's Stripe CLI has no test-mode key. The exact `createPreview` line shape in the account's API version (`2026-02-25.clover`) is handled for both the old `line.proration` and the new `parent.subscription_item_details.proration` fields, but only the double's shape has been exercised.
- **Stripe portal.** The live default portal configuration (read-only check, 27 Sep 2026) allows `price` updates only, not `quantity`, so customers cannot change seats there; seats change only through QualCanvas. If quantity updates are ever enabled in the portal, a reduction creates a shortfall and the grace rules above apply (covered by `10-seats` "quantity mirrors Stripe").
