# QualCanvas YouTube training and marketing library

This package produces eighteen 1920×1080 QualCanvas videos from a fresh, isolated Chromium context using the public synthetic demo workspace. It contains no customer records, persistent browser profile, private email, credential or production token.

## Library

1. QualCanvas in 2 Minutes — product overview.
2. Start Your First Project — confidence-building beginner path.
3. Add Interview Transcripts — source import and privacy boundaries.
4. Code Your First Passage — everyday coding and codebook refinement.
5. Find Patterns with Analysis Tools — queries, clusters and frameworks.
6. Research Memos and Audit Trail — analytical reasoning and ethics.
7. Share and Check Intercoder Agreement — collaboration and calibration.
8. AI Privacy and Control — optional AI, data flow and human review.
9. Export for Dissertation or Handoff — formats, readability and security.
10. Complete Qualitative Workflow — end-to-end transcript-to-report path.
11. QualCanvas for PhD Research — doctoral and dissertation workflow.
12. Methods Teaching and Research Teams — teaching and team calibration.
13. Import Open-Text Survey Data — CSV mapping, verification and respondent privacy.
14. Cases and Cross-Case Analysis — participant, site or group comparison.
15. Move Projects with QDPX — controlled exchange and round-trip verification.
16. Organise a Busy Visual Canvas — layout, navigation and shortcuts.
17. Research Repository Across Projects — curated insight records and governance.
18. UX, Service and Applied Research — evidence-to-decision workflow and handoff.

Every master uses original QualCanvas interface captures, an Irish-English neural narration, timed English subtitles and a custom thumbnail. No stock footage, third-party music or customer data is used.

## Reproduce

Requirements: Node 20+, the repository dependencies, Python 3.11+, Pillow, FFmpeg/FFprobe and `edge-tts`.

```powershell
node youtube-training/2026-07-17-initial-library/production/capture-app.mjs
python youtube-training/2026-07-17-initial-library/production/render_series.py
python youtube-training/2026-07-17-initial-library/production/qa_series.py
```

Optional environment variables:

- `QUALCANVAS_CAPTURE_SITE` — defaults to `https://qualcanvas.com`.
- `QUALCANVAS_DEMO_CODE` — defaults to the documented synthetic demo access code.
- `QUALCANVAS_VIDEO_PACKAGE` — overrides this package directory.

Large captures, audio, intermediates, frame extracts and final masters stay local and are ignored by Git. Source configuration, scripts, upload metadata, captions, thumbnails, channel assets and the QA report are retained for repeatability.

## Publishing boundary

All uploads are configured as English (Ireland), not made for kids and public only after final QA. YouTube publishing must use the owner’s existing Google account; this workflow must not create a separate Google account or duplicate an existing suitable QualCanvas channel.
