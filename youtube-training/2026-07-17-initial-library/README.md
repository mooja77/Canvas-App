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

## Live YouTube presence

- Channel: https://www.youtube.com/@QualCanvas
- Start with QualCanvas: https://www.youtube.com/playlist?list=PLCrDpx1xmA1U
- Everyday QualCanvas Training: https://www.youtube.com/playlist?list=PLCIvfQECYZZc
- Analysis, Collaboration & Control: https://www.youtube.com/playlist?list=PLO7hzf3lVeSU
- QualCanvas for Researchers, Teams & Teaching: https://www.youtube.com/playlist?list=PLTEqAy8MO9D8

The channel uses the product owner's existing Google account and existing `@QualCanvas` channel. Its description, website links, channel keywords, Ireland setting, not-made-for-kids default, original banner, original profile image, full-video watermark and Home tab are configured. The four public playlists are intentionally empty until their masters can be uploaded and verified.

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

For an authenticated publishing session, launch a dedicated Chrome profile with remote debugging and attach the local-only Studio controller. The controller never stores a credential and does not bypass Google or YouTube verification.

```powershell
$studioProfile = Join-Path $env:LOCALAPPDATA 'Temp\codex-qualcanvas-youtube'
$profileArgument = "--user-data-dir=$studioProfile"
& 'C:\Program Files\Google\Chrome\Application\chrome.exe' `
  '--remote-debugging-port=9333' `
  '--disable-extensions' `
  $profileArgument `
  '--no-first-run' `
  '--no-default-browser-check' `
  'https://studio.youtube.com/channel/UC_h18dZMNrsHym-bjboLndA'

$env:QUALCANVAS_CDP_URL = 'http://127.0.0.1:9333'
node youtube-training/2026-07-17-initial-library/production/studio-controller.mjs
```

The controller listens only on `127.0.0.1:9444`. `GET /state` returns a concise page snapshot; `POST /action` runs the documented Playwright steps used by the publishing workflow. When attached over CDP, stopping the controller leaves the owner's browser open.

Large captures, audio, intermediates, frame extracts and final masters stay local and are ignored by Git. Source configuration, scripts, upload metadata, captions, thumbnails, channel assets and the QA report are retained for repeatability.

## Publishing boundary

All uploads are configured as English (Ireland), not made for kids and public only after final QA. YouTube publishing must use the owner’s existing Google account; this workflow must not create a separate Google account or duplicate an existing suitable QualCanvas channel.

On 19 July 2026, YouTube Studio reported `Daily upload limit reached` and offered either one-time phone verification or waiting 24 hours. The owner's number is not currently eligible for another verification. No workaround, alternate account or duplicate channel is used: all eighteen masters remain ready for upload after YouTube resets the channel's limit. Until each public watch page and uploaded subtitle track are verified, the website correctly labels the videos `Publishing shortly`.
