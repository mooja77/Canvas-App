# Activation funnel

The protected QualCanvas admin portal includes an **Activation** tab for weekly product-growth review. It reports server-owned product milestones rather than accepting browser-submitted claims.

## Cohort definition

The selected 7, 30 or 90-day period defines a signup cohort. Internal, test, demo, smoke, QA and seeded accounts are excluded using the same filters as the rest of the admin reporting system.

The funnel follows each real account through:

1. Signed up.
2. Created a project.
3. Added a transcript.
4. Created a first coding.

Each milestone is counted once per user at its earliest stored timestamp. The dashboard shows the percentage of the original signup cohort, conversion from the previous step and median elapsed time from signup. “Activation rate” currently means the share of the cohort that has created at least one coding.

Milestones can occur after the selected signup window. This makes the report a cohort view rather than a count of actions performed only inside the date range. The separate output cards count real-user projects, transcripts, codings and analysis runs created during the selected period.

## Privacy and trust boundaries

- The API response contains aggregate counts and timestamps only; the activation payload contains no names, emails or research content.
- Browser events such as training-video starts remain consent-controlled in GA4 and Plausible. They are not accepted as authoritative product milestones.
- Deleted database records cannot contribute to a stored-record milestone. Use the audit log when investigating an individual deletion history.
- Lifecycle-email automation remains separately release-gated and is not enabled by this dashboard.

## Weekly review

Review the 30-day cohort first, then compare it with 7 and 90 days:

- A large signup-to-project drop points to account or first-project friction.
- A project-to-transcript drop points to import guidance, data-format or privacy uncertainty.
- A transcript-to-coding drop points to coding ergonomics, terminology or onboarding guidance.
- Rising median time with a stable conversion rate suggests users eventually succeed but need a shorter path.

Do not optimize a step from a one-user sample. Record the cohort size beside any conclusion and compare at least two reporting windows.
