# Lifecycle Email System

QualCanvas has a database-backed email engagement system for onboarding, training, inactivity nudges, and product updates.

## What Sends

- Welcome email: eligible only after an opted-in email signup verifies its address.
- Training tip: available at day 3 of a new, explicitly opted-in lifecycle cohort.
- Onboarding follow-up: available at day 7 of that cohort.
- Inactivity nudge: available in the scheduler after 14 days without activity.
- Product updates: created and sent manually from the Admin `Emails` tab.

## Safety Controls

- Every delivery is logged in `EmailDelivery`.
- Per-user `eventKey` uniqueness prevents repeated accepted deliveries for the same lifecycle event or campaign.
- Claims and transient failures retry at most three times; permanent failures do not retry.
- Provider acceptance is stored as `accepted`, never presented as provider-confirmed delivery.
- Every user has `EmailPreference` toggles for lifecycle, training, inactivity, and product update emails.
- Email footers include account preferences plus a public confirmation link and RFC 8058 one-click POST unsubscribe.
- Scheduler sends are capped by `LIFECYCLE_EMAIL_BATCH_LIMIT`, default `50`.
- A sweep selects at most one timed message per user.
- Timed activation mail rechecks the durable first-value marker immediately before claim and stops after a genuine, non-sample coding is saved.
- Existing accounts have no cohort date. New verified opt-ins and later explicit opt-ins start a cohort at that moment, so automation has no historical backlog.
- Inactivity mail requires a real, old activity record; a missing activity signal is treated as unknown and is not emailed.
- Delayed lifecycle automation is off unless `LIFECYCLE_EMAIL_AUTOMATION_ENABLED=true`.
- All nonessential delivery is off unless the separate `LIFECYCLE_EMAIL_SEND_ENABLED=true` brake is set.
- Delivery requires a configured provider, a `qualcanvas.com` sender identity, and a signed outcome webhook when Resend is used.

## Admin Workflow

1. Open `/admin`.
2. Go to `Emails`.
3. Create a product update draft with subject, body HTML, optional CTA, and audience.
4. Review carefully.
5. Click `Send`; sent campaigns cannot be sent again.

## Environment

Use Resend or SMTP:

```bash
RESEND_API_KEY=re_...
SMTP_FROM="QualCanvas <noreply@qualcanvas.com>"
APP_URL=https://qualcanvas.pages.dev
```

Enable delayed automated lifecycle emails after verifying the sender and provider outcome webhook:

```bash
LIFECYCLE_EMAIL_SEND_ENABLED=true
LIFECYCLE_EMAIL_AUTOMATION_ENABLED=true
LIFECYCLE_EMAIL_BATCH_LIMIT=50
```

An exact-template internal canary is a release check, not an artificial recipient allowlist. Objective consent, address verification, deduplication, provider suppression, bounce, complaint and unsubscribe rules remain mandatory for every recipient.

The admin `Accepted` count is provider acceptance only. `Delivered` remains zero unless a provider webhook has supplied delivery evidence; this implementation does not infer delivery from acceptance.
