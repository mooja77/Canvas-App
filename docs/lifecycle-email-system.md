# Lifecycle Email System

QualCanvas has a database-backed email engagement system for onboarding, training, inactivity nudges, and product updates.

## What Sends

- Welcome email: sent after email signup, Google signup, or legacy account linking.
- Training tip: available in the scheduler at 3 days after signup.
- Onboarding follow-up: available in the scheduler at 7 days after signup.
- Inactivity nudge: available in the scheduler after 14 days without activity.
- Product updates: created and sent manually from the Admin `Emails` tab.

## Safety Controls

- Every delivery is logged in `EmailDelivery`.
- Per-user `eventKey` uniqueness prevents repeated sends for the same lifecycle event or campaign.
- Every user has `EmailPreference` toggles for lifecycle, training, inactivity, and product update emails.
- Email footers include a public unsubscribe link.
- Scheduler sends are capped by `LIFECYCLE_EMAIL_BATCH_LIMIT`, default `50`.
- Delayed lifecycle automation is off unless `LIFECYCLE_EMAIL_AUTOMATION_ENABLED=true`.

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
LIFECYCLE_EMAIL_AUTOMATION_ENABLED=true
LIFECYCLE_EMAIL_BATCH_LIMIT=50
```
