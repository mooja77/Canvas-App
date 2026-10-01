# First-code lesson for the onboarding Help menu

The existing QualCanvas YouTube lesson `hzt6Rbmf0Fg` (original master
`youtube-training/2026-07-17-initial-library/videos/04-code-your-first-passage.mp4`)
is 93.13 seconds, above the 90-second onboarding target. This branch adds a
self-hosted 88.70-second version at `/help/first-code.html`, linked from the
canvas Help menu. It preserves every scene and the narration; video PTS and
audio tempo are both accelerated by 1.05×. The 26 original `en-IE` subtitle
cues were scaled by the same factor and served as a separate VTT track.

Local verification on 26 Sep:

- `ffprobe`: 88.700s, H.264 1920×1080 and AAC, 2,475,112 bytes.
- Caption audit: 26 ordered, non-overlapping cues; last cue ends at 88.305s.
- Sampled the 25-second video frame visually; the on-screen instruction and
  canvas capture remain intact.
- Help-menu unit test checks the point-of-need link.

This does **not** claim a full human listening review, YouTube upload, or
production playback. Those are release checks before declaring the wider
onboarding programme live. The original public YouTube lesson is unchanged.
