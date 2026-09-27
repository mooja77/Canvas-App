/**
 * Stripe subscription statuses that keep the paid tier.
 *
 * `past_due` is included: Stripe is still retrying the card (Smart Retries),
 * and the subscription only ends when Stripe gives up and moves it to
 * `canceled` or `unpaid` (whichever the account's dunning setting chooses).
 * Demoting on the first decline took paid features away from people whose card
 * had merely expired, and the code disagreed with itself about it:
 * invoice.payment_failed kept the plan while subscription.updated,
 * reconciliation and sign-in demoted.
 *
 * Everything else loses the tier: `canceled`, `unpaid`, `incomplete` (the first
 * payment never succeeded), `incomplete_expired` and `paused`.
 *
 * Every path that decides a plan from a status uses this set: the Stripe
 * webhook, the weekly reconciliation, sign-in and GET /auth/me.
 */
export const ENTITLED_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set(['active', 'trialing', 'past_due']);
