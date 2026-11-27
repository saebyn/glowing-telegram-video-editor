# 77 — Bound decoded Preview media across renditions

Status: ready-for-agent
Resolution: each Preview reader retains at most four rendition handles and bounds both cached results and in-flight frame preparation.
Review priority: P2
Related: [49 — Sequence Preview HLS playback](49-design-hls-playback-for-sequence-preview.md),
[66 — Reuse sequential Preview decoders](66-reuse-sequential-preview-decoders.md),
[67 — Profile warm Preview playback](67-profile-warm-preview-playback.md)

## Problem

[Preview](../../../src/components/molecules/SequencePreview.tsx#L25) retains
every rendition it has opened until the reader is disposed. Each rendition
has a window limit, but the Preview as a whole does not. In a mock-reader
run across twelve short 60 fps renditions, 2,160 decoded canvas objects
remained reachable until disposal. This is a retained object count, not a
browser memory measurement.

## Acceptance criteria

- The total retained decoded media is bounded as the user visits more
  renditions in one Preview session. Document the budget and release resources
  for evicted renditions.
- Playback still handles both sides of a dissolve, including two positions in
  one rendition, without losing needed media to eviction. Revisiting an
  evicted rendition can reopen and decode it.
- Verify retention across many renditions and disposal during in-flight reads.
  Keep this separate from the decoder reuse and warm-playback performance work.

## Comments

- Red → green with controlled decoder outputs: visiting twelve renditions
  formerly retained all twelve handles; it now peaks at four and reopens
  evicted URLs. Rapid seeks used to let 40 pictures wait behind delayed
  sound; this is now bounded at 11 at the test's 10 fps. Tests also cover
  lease pressure, two positions in one rendition, separate picture and sound
  contributors, closing during active reads, and ignoring late probes.
- The [design](../../../docs/sequence-editor-design.md#sequence-preview-target)
  documents retention and concurrency budgets. These are counts of cache
  entries and outstanding preparations, not browser heap measurements.
- 186 unit and 17 Chromium Preview tests passed. Six targeted mutations were
  caught. Typecheck, build, formatting, and `git diff --check` passed. Lint
  reported only the existing `VideoPlayer` captions warning.
