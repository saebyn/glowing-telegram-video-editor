# 100 — Align ruler hit-testing after a fractional pan

Status: needs-triage
Review priority: P2
Related: [81 — Pan the sequence timeline directly](81-pan-the-sequence-timeline-directly.md),
[84 — Keep keyboard focus and the viewport aligned](84-keep-keyboard-focus-and-viewport-aligned.md)

## Problem

[`SequenceTimeline`](../../../src/components/organisms/SequenceTimeline.tsx#L326)
rounds Keplar's scroll offset to whole pixels while overlays and pointer
mapping use the unrounded origin. With a ten-minute, 30 fps sequence in a
1,001 px timeline viewport, pan right once from Fit. Clicking the visible
tick for sequence frame 13,487 seeks to frame 13,478.

## Acceptance criteria

- Ruler rendering, placement positions, overlays, and pointer hit-testing
  agree on the effective viewport origin after panning.
- Preserve fractional pan input so repeated small movements still
  accumulate. Do not change zoom or edits as a side effect of panning.
- Add an odd-width, long-sequence browser regression that clicks a visible
  tick after panning and verifies its sequence frame.
