# Lifecycle Email System

QualCanvas has a database-backed email engagement system for onboarding, training, inactivity nudges, and product updates.

## What Sends

- Welcome email: eligible only after an opted-in email signup verifies its address.
- Training tip: available in the scheduler at 3 days after signup.
- Onboarding follow-up: available in the scheduler at 7 days after signup.
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
- Timed activation mail rechecks `first_canvas_created` immediately before claim and stops after first value.
- Day-3 and day-7 messages are not backfilled after their delivery windows, so enabling automation cannot dump an old sequence into established accounts.
- Inactivity mail requires a real, old activity record; a missing activity signal is treated as unknown and is not emailed.
- Delayed lifecycle automation is off unless `LIFECYCLE_EMAIL_AUTOMATION_ENABLED=true`.
- All nonessential delivery is off unless the separate `LIFECYCLE_EMAIL_SEND_ENABLED=true` brake is set.
- Automation also requires either an exact `LIFECYCLE_EMAIL_RECIPIENT_ALLOWLIST` or the separate, explicit `LIFECYCLE_EMAIL_ALLOW_ALL_RECIPIENTS=true` scale-up switch.

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

Enable delayed automated lifecycle emails only after reviewing copy and deliverability:

```bash
LIFECYCLE_EMAIL_SEND_ENABLED=true
LIFECYCLE_EMAIL_AUTOMATION_ENABLED=true
LIFECYCLE_EMAIL_BATCH_LIMIT=1
LIFECYCLE_EMAIL_RECIPIENT_ALLOWLIST=approved-canary@example.com
LIFECYCLE_EMAIL_ALLOW_ALL_RECIPIENTS=false
```

Do not set either send switch in production without John's exact R3 approval. Do not set `LIFECYCLE_EMAIL_ALLOW_ALL_RECIPIENTS=true` until the allowlisted canary has been reviewed against the delivery, bounce, complaint and unsubscribe stopping rules.

The admin `Accepted` count is provider acceptance only. `Delivered` remains zero unless a provider webhook has supplied delivery evidence; this implementation does not infer delivery from acceptance.
