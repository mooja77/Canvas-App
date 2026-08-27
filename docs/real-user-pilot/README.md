# QualCanvas real-user pilot

This package turns the public `/pilot` page into a repeatable usability study. It is designed for 5–10 academic,
postgraduate, UX/service, or applied researchers and focuses on observed behaviour rather than feature opinions.

## What is live

- Participant route: `https://qualcanvas.com/pilot`
- Five-task first-use journey: project → transcript → coding → memo/analysis → export
- Structured, anonymous-by-default feedback form
- Explicit synthetic-data and privacy boundary
- Optional, consented one-time follow-up email
- Admin review: `/admin` → **Pilot feedback**
- Automatic deletion of pilot responses after 365 days

## Suggested sample

Recruit 5–10 people across at least two of the product's intended audiences. Include at least three first-time users and,
where possible, one participant who describes themselves as non-technical. Do not recruit only colleagues who already
know the interface.

## Success thresholds

Use these as release signals, not as claims of statistical significance:

- At least 80% complete project creation, transcript entry, and first coding without facilitator help.
- At least 70% complete the memo/analysis and export tasks.
- No participant uploads real or confidential research material.
- No repeated severe accessibility or data-loss problem.
- Median recommendation score is 7/10 or above.
- Any problem repeated by three or more participants enters the next release backlog.

See [FACILITATOR-GUIDE.md](./FACILITATOR-GUIDE.md) for the session script and [SCORECARD.csv](./SCORECARD.csv) for
observation notes. Participants submit their own outcome data on the public page; the scorecard is for observations they
may not articulate afterwards.
