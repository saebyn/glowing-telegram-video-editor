# 67 — Reduce main-thread work during warm Preview playback

Status: ready-for-agent
Resolution: profiled warm production playback; keep the current compositor and investigate Timeline updates first if warm playback becomes a problem.
Review priority: P3
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
- Triage: ready for profiling, not a preselected optimization. Warm the
  fixture and measure ready-frame work independently of #66; a decoder
  reuse change is not a prerequisite.
- Profiled production Storybook at `0b3bfaa` in Chromium 158. The local
  60 fps, 144-frame edit has two straight placements and a 24-frame
  same-rendition dissolve over a 10 fps MPEG-TS fixture. Played once,
  returned to frame zero, then recorded the replay at 1× and 4× CPU
  throttling with and without the Timeline. Cold runs configured five
  picture and six sound decoders; none of the replays configured any.
  The warm loading indicators lasted 1–7 ms each on the baseline, compared
  with 14–83 ms for the first cold indicator, depending on the run.
- Warm baseline CPU samples attributed about 168 ms to React DOM and
  Keplar together with the Timeline at 1×, versus 50 ms without it.
  At 4× the counts were 523 ms versus 104 ms. The individually attributed
  Preview JavaScript and canvas/audio API work was smaller. These are
  single-run sampled wall-time estimates, not exact exclusive costs.
  All four baseline replays had zero display ticks over 25 ms and no
  uncovered scheduled-audio interval over 1 ms.
- Prototyped skipping straight-frame redraws when the same unblended
  canvas is already displayed. Draws fell from 169 to 69 in both 1×
  replays, with no repeatable main-thread or playback improvement.
  Throttled prototype runs varied and showed late ticks; there is no
  clear benefit to justify shipping it. The picture seek and recorded
  60 fps tone-continuity tests passed against the isolated prototype.
  The interval probe measures scheduled coverage, not perceived sound.
- Profiles, fixture, and runner: `/tmp/opencode/gtve-preview-perf.peHFGT/`.
