# 67 — Reduce main-thread work during warm Preview playback

Status: needs-triage
Related: [49 — HLS playback in `SequencePreview`](49-design-hls-playback-for-sequence-preview.md),
[66 — Reuse decoders across sequential Preview reads](66-reuse-sequential-preview-decoders.md)

## Opportunity

Preview now prepares a short run of sequence frames ahead of the playhead,
so it no longer depends on one display tick per sequence frame. Profile what
still takes time when the required media is already decoded. In particular,
compare presentation resolution, timeline updates, canvas draws, and Web
Audio scheduling. Don't assume which one dominates.

If a hotspot shows up, prototype one targeted change: for example, avoid
redrawing an unchanged picture outside transitions, limit unrelated timeline
updates, or schedule longer contiguous audio runs instead of many short
blocks. Keep authored timing, blend weights, and audio continuity unchanged.

## Evidence to collect

- Trace a warmed local HLS fixture in Chromium at 60 sequence fps, with and
  without an attached sequence timeline. Include a straight placement, a
  dissolve, and runs with and without CPU throttling. Separate time spent
  waiting for media from time spent on ready frames; decoder reuse is #66.
- Compare time spent on the main thread, late display ticks, and audible
  dropouts before and after any prototype. Check that scrubbing and
  picture–sound alignment still work and a paused or hidden Preview
  doesn't leave sound queued.
- Record a recommendation, including no change if the improvement is small
  or the work shifts cost elsewhere.

## Comments

- Current performance is acceptable. Profile before choosing an implementation;
  this is not a release blocker for #49.
